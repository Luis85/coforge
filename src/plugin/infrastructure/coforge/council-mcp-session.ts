import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { TeamMessageDraft } from '../../features/coforge/domain/team-messages';
import { shape, text } from '../../features/coforge/domain/check';
import { LocalMcpServer, type McpTool } from './mcp-server';
import { McpToolError } from './mcp-errors';

export interface CouncilMcpScope {
  maxToolCalls?: number;
  prompt: string; instructions: string;
  identity?: { projectId: string; runId: string; attemptId: string; agentId: string; teamId: string; roundId: string };
  inputs: Array<{ id: string; agentId: string; roundId: string; markdown: string }>;
  recipients(): string[];
  recheck(): Promise<void>;
  signal?: AbortSignal;
}
export interface CouncilMcpSession {
  assertBudget?(): void;
  configPath: string;
  messageDrafts(): TeamMessageDraft[];
  dispose(): Promise<void>;
}
const id = text({ min: 1, max: 100 });
const object = (properties: Record<string, object>) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const identifier = { type: 'string', minLength: 1, maxLength: 100 };
function tool(name: string, description: string, inputSchema: object, readOnlyHint = true): McpTool {
  return { name, description, inputSchema, annotations: { readOnlyHint, destructiveHint: false, idempotentHint: true, openWorldHint: false } };
}
/** This endpoint cannot discover the vault, start workflows, approve code or inspect unbound opinions. */
export async function createCouncilMcpSession(directory: string, scope: CouncilMcpScope): Promise<CouncilMcpSession> {
  let closed = false; let closing: Promise<void> | undefined;
  const requests = new Map<string, TeamMessageDraft>();
  let pending: Promise<unknown> = Promise.resolve();
  let calls = 0;
  let exceeded = false;
  const assertBudget = () => { if (exceeded) throw new McpToolError('PERMISSION_DENIED', 'The captured Codex tool-call allowance was exhausted. Review retained work before an explicit retry.'); };
  const assert = async () => {
    if (closed || scope.signal?.aborted) throw new McpToolError('PERMISSION_DENIED', 'This invocation’s CoForge connection is closed.');
    await scope.recheck();
    if (closed || scope.signal?.aborted) throw new McpToolError('PERMISSION_DENIED', 'This invocation’s CoForge connection is closed.');
  };
  const server = new LocalMcpServer({
    tools: () => [
      tool('coforge_invocation', 'Read your captured task, invocation identity, authorized inputs and tool rules. This is the starting point for this isolated CoForge task.', object({})),
      tool('coforge_read_input', 'Read one explicitly bound input artifact. Other opinions, notes, runs and projects cannot be accessed.', object({ artifactId: identifier })),
      ...(scope.recipients().length ? [tool('coforge_nudge_agent', 'Stage a task request for an approved agent. It is validated and delivered only after your contribution is persisted. Reuse requestId for a retry; do not repeat it in final messageDrafts.', object({ requestId: identifier, recipientId: { ...identifier, enum: scope.recipients() }, prompt: { type: 'string', minLength: 1, maxLength: 16000 } }), false)] : []),
    ],
    call(name, raw) {
      const next = pending.then(async () => {
        if (scope.maxToolCalls !== undefined && ++calls > scope.maxToolCalls) exceeded = true;
        assertBudget();
        await assert();
        if (name === 'coforge_invocation') {
          shape({}, { strict: true })(raw);
          return { ...scope.identity, prompt: scope.prompt, instructions: scope.instructions, inputArtifacts: scope.inputs.map(({ id, agentId, roundId }) => ({ id, agentId, roundId })),
            allowedAgentRecipients: scope.recipients(), policy: 'CoForge MCP action tools only. Use captured inputs; no native file/shell/browser tools, other MCP servers, arbitrary workflow admission or code approval.',
            nextAction: scope.inputs.length ? 'Use coforge_read_input for bound artifacts, then return the required structured contribution.' : 'Assess the captured task independently, then return the required structured contribution.' };
        }
        if (name === 'coforge_read_input') {
          const { artifactId } = shape({ artifactId: id }, { strict: true })(raw);
          const artifact = scope.inputs.find(item => item.id === artifactId);
          if (!artifact) throw new McpToolError('PERMISSION_DENIED', 'This artifact is not bound to your invocation. Read coforge_invocation for allowed inputs.', 'coforge_invocation');
          return structuredClone(artifact);
        }
        if (name !== 'coforge_nudge_agent') throw new McpToolError('PERMISSION_DENIED', 'This tool is not available in an isolated Council invocation.', 'coforge_invocation');
        const input = shape({ requestId: id, recipientId: id, prompt: text({ min: 1, max: 16000 }) }, { strict: true })(raw);
        if (!scope.recipients().includes(input.recipientId)) throw new McpToolError('PERMISSION_DENIED', 'This agent is not an approved recipient for your invocation.', 'coforge_invocation');
        const draft: TeamMessageDraft = { purpose: 'request', recipientId: input.recipientId, body: input.prompt };
        const previous = requests.get(input.requestId);
        if (previous && JSON.stringify(previous) !== JSON.stringify(draft)) throw new McpToolError('CONFLICT', 'This requestId already identifies a different nudge. Inspect the original request before creating a new one.');
        if (!previous && requests.size >= 100) throw new McpToolError('PERMISSION_DENIED', 'This invocation reached its staged-message limit.');
        requests.set(input.requestId, draft);
        return { requestId: input.requestId, status: 'staged', nextAction: 'Finish your structured contribution. The host validates and delivers staged requests after persistence.' };
      });
      pending = next.catch(() => undefined); return next;
    },
  });
  const dispose = (): Promise<void> => closing ??= (async () => { closed = true; scope.signal?.removeEventListener('abort', abort); await server.close(); await pending; })();
  const abort = () => { void dispose().catch(() => undefined); };
  try {
    await assert(); const endpoint = await server.listen(); const token = server.allow();
    const configPath = join(directory, 'coforge-only-mcp.json');
    await writeFile(configPath, JSON.stringify({ mcpServers: { coforge: { type: 'http', url: endpoint, headers: { Authorization: `Bearer ${token}` } } } }), { flag: 'wx', mode: 0o600 });
    scope.signal?.addEventListener('abort', abort, { once: true });
    await assert();
    return { configPath, messageDrafts: () => structuredClone([...requests.values()]), assertBudget, dispose };
  } catch (error) { await dispose(); throw error; }
}
