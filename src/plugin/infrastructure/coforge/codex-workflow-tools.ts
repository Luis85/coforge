import { McpStepFiles } from './mcp-step-files';
import { LocalMcpServer, type McpTool } from './mcp-server';
import type { StageInput } from '../../features/coforge/application/ports';
import type { WorkflowWorkspaceLease } from '../../features/coforge/application/workflow-workspace-ports';
import { executionAccess } from '../../features/coforge/application/workflow-execution';

const path = { type: 'string', maxLength: 1000 };
const content = { type: 'string', maxLength: 200000 };
function tool(name: string, description: string, properties: Record<string, object>, readOnlyHint = true): McpTool {
  return { name, description, inputSchema: { type: 'object', properties, required: Object.keys(properties), additionalProperties: false }, annotations: { readOnlyHint, destructiveHint: !readOnlyHint, idempotentHint: readOnlyHint, openWorldHint: false } };
}
/** Codex never receives a local project path; every file operation rechecks the captured lease. */
export async function codexWorkflowTools(input: StageInput, lease: WorkflowWorkspaceLease, protectedPaths: readonly string[] = [], onActivity?: () => Promise<void>) {
  const access = executionAccess(input);
  const tools: McpTool[] = access === 'none' ? [] : [
    tool('coforge_list_files', 'List allowed repository files. Use an empty relative path for the root.', { path }),
    tool('coforge_read_file', 'Read one bounded UTF-8 repository file.', { path }),
    tool('coforge_search_files', 'Search allowed repository text for an exact string.', { query: { type: 'string', minLength: 1, maxLength: 200 } }),
    ...(access === 'editworktree' ? [
      tool('coforge_write_file', 'Create or replace a file in the isolated worktree. expectedContent must exactly match the previous read, or be null for a new file. Protected files are denied.', { path, content, expectedContent: { anyOf: [content, { type: 'null' }] } }, false),
      tool('coforge_delete_file', 'Delete a worktree file only after an exact content check. Protected files are denied.', { path, expectedContent: content }, false),
    ] : []),
  ];
  const files = new McpStepFiles(protectedPaths);
  let calls = 0;
  let exceeded = false;
  let closed = false;
  let closing: Promise<void> | undefined;
  let pending: Promise<unknown> = Promise.resolve();
  const server = new LocalMcpServer({ tools: () => tools, call: (name, args) => {
    const next = pending.then(async () => {
      if (closed) throw new Error('This captured Codex invocation is closed.');
      if (++calls > input.settings.maxTurns) { exceeded = true; throw new Error('The captured Codex tool-call limit was reached.'); }
      if (!tools.some(item => item.name === name)) throw new Error('This operation is not permitted for this invocation.');
      input.signal?.throwIfAborted();
      const result = await files.call(name, { input, lease }, args);
      await onActivity?.();
      return result;
    });
    pending = next.catch(() => undefined);
    return next;
  } });
  const dispose = () => closing ??= (async () => { closed = true; await server.close(); await pending; })();
  try {
    const token = server.allow();
    const url = await server.listen();
    return { url, token, assertBudget: () => { if (exceeded) throw new Error('Codex reached its captured tool-call limit. Review partial changes before explicitly retrying.'); }, dispose };
  } catch (error) { await dispose(); throw error; }
}
