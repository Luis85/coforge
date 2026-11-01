import { McpStepFiles } from './mcp-step-files';
import { LocalMcpServer, type McpTool } from './mcp-server';
import type { StageInput } from '../../features/coforge/application/ports';
import { ProviderFailureError, providerFailureFor } from '../../features/coforge/domain/provider-failure';
import type { WorkflowWorkspaceLease } from '../../features/coforge/application/workflow-workspace-ports';
import { executionAccess } from '../../features/coforge/application/workflow-execution';
import type { Increment } from '../../features/coforge/domain/types';
import type { WorkflowVerificationRecord } from '../../features/coforge/domain/workflow-verification';
import { createWorkflowVerification } from './verification/session';

const path = { type: 'string', maxLength: 1000, description: 'Repository-relative path with forward slashes. Use an empty path to list the repository root. The native CLI working directory contains private transport files, not repository files; never pass its absolute paths.' };
const content = { type: 'string', maxLength: 200000 };
const query = { type: 'string', minLength: 1, maxLength: 200 };
function tool(name: string, description: string, properties: Record<string, object>, readOnlyHint = true, required = Object.keys(properties)): McpTool {
  return { name, description, inputSchema: { type: 'object', properties, required, additionalProperties: false }, annotations: { readOnlyHint, destructiveHint: !readOnlyHint, idempotentHint: readOnlyHint, openWorldHint: false } };
}
/** Codex never receives a local project path; every file operation rechecks the captured lease. */
export async function codexWorkflowTools(input: StageInput, lease: WorkflowWorkspaceLease, protectedPaths: readonly string[] = [], onActivity?: () => Promise<void>) {
  const access = executionAccess(input);
  const scopedLease: WorkflowWorkspaceLease = { ...lease, get protectedProjectPaths() { return [...new Set([...protectedPaths, ...(lease.protectedProjectPaths ?? [])])]; } };
  const verification = await createWorkflowVerification(input, scopedLease);
  const tools: McpTool[] = access === 'none' ? [] : [
    tool('coforge_list_files', 'Discover allowed repository file paths. Optional path narrows the directory; optional query filters paths by a case-insensitive literal substring before the result limit. Truncated results are incomplete; narrow path and retry.', { path, query }, true, []),
    tool('coforge_read_file', 'Read one bounded UTF-8 repository file using its repository-relative forward-slash path. Discover names with coforge_list_files; never prepend the native CLI working directory.', { path }),
    tool('coforge_search_files', 'Search allowed UTF-8 repository text for a case-sensitive literal string. Optional path narrows the directory. Truncated results are incomplete; narrow path and retry.', { query, path }, true, ['query']),
    ...(verification ? [tool('coforge_run_tests', 'Execute one captured approved command ID at the isolated snapshot root. Returns observed command outcome and source fingerprint. No arbitrary executable, arguments, environment, paths or network access can be supplied. Approved commands: ' + input.workflow!.verificationProfile!.commands.map(command => `${command.id} (${command.label})`).join('; '), { commandId: { type: 'string', minLength: 1, maxLength: 80, enum: input.workflow!.verificationProfile!.commands.map(command => command.id) } }, false)] : []),
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
      verification?.assertHealthy();
      if (++calls > input.settings.maxTurns) { exceeded = true; throw new Error('The captured Codex tool-call limit was reached.'); }
      if (!tools.some(item => item.name === name)) throw new Error('This operation is not permitted for this invocation.');
      input.signal?.throwIfAborted();
      const result = name === 'coforge_run_tests' && verification ? await verification.run(args) : await files.call(name, { input, lease: scopedLease }, args);
      await onActivity?.();
      return result;
    });
    pending = next.catch(() => undefined);
    return next;
  } });
  const dispose = () => closing ??= (async () => {
    closed = true; server.revoke();
    try { await verification?.dispose(); }
    finally { await server.close(); await pending; }
  })();
  try {
    const token = server.allow();
    const url = await server.listen();
    return { url, token, toolTimeoutSeconds: input.workflow?.verificationProfile ? (input.workflow.verificationProfile.timeoutSeconds + 60) * input.workflow.verificationProfile.maxRuns + 60 : undefined,
      verificationRecords: (): WorkflowVerificationRecord[] => verification?.records() ?? [], captureVerification: async (increment: Increment): Promise<Increment> => verification ? verification.capture(increment) : increment,
      assertBudget: () => { verification?.assertHealthy(); if (exceeded) throw new ProviderFailureError(providerFailureFor('tool_limit')); }, dispose };
  } catch (error) { await dispose(); throw error; }
}
