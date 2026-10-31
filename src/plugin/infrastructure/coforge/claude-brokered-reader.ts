import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { StageInput } from '../../features/coforge/application/ports';
import type { WorkflowWorkspaceLease } from '../../features/coforge/application/workflow-workspace-ports';
import { executionAccess, executionTaskPrompt } from '../../features/coforge/application/workflow-execution';
import { codexWorkflowTools } from './codex-workflow-tools';
import { backgroundClaudeArgs } from './durable-worker/claude';
import { captureProcess, ProcessFailure } from './process';

const READ_TOOLS = ['coforge_list_files', 'coforge_read_file', 'coforge_search_files'];

/** A partial private read grant must fail closed rather than reaching the native cwd path. */
export function hasBrokeredReadScope(lease: WorkflowWorkspaceLease | undefined): boolean {
  return lease?.readOnly === true || lease?.protectedProjectPaths !== undefined;
}

/** Read an inherited Build through its validated broker; never recapture or alter that Build. */
export async function captureBrokeredClaudeRead(input: StageInput, lease: WorkflowWorkspaceLease, command: string,
  capture: typeof captureProcess = captureProcess): Promise<string> {
  if (!input.workflow || executionAccess(input) !== 'readproject' || lease.readOnly !== true
    || lease.protectedProjectPaths === undefined || !lease.validate) {
    throw new Error('Inherited Build access requires a qualified read-only readproject lease with protected paths and validation. No native filesystem fallback is available.');
  }
  input.signal?.throwIfAborted(); await lease.validate();
  if (lease.id) await input.onWorkspace?.(lease.id);
  const directory = await mkdtemp(join(tmpdir(), 'coforge-claude-reader-'));
  let bridge: Awaited<ReturnType<typeof codexWorkflowTools>> | undefined;
  try {
    bridge = await codexWorkflowTools(input, lease, lease.protectedProjectPaths);
    const config = join(directory, 'broker.json');
    await writeFile(config, JSON.stringify({ mcpServers: { coforge: { type: 'http', url: bridge.url,
      headers: { Authorization: `Bearer ${bridge.token}` } } } }), { mode: 0o600 });
    const args = backgroundClaudeArgs(input, config);
    args[args.indexOf('--allowedTools') + 1] = READ_TOOLS.map(name => `mcp__coforge__${name}`).join(',');
    const prompt = executionTaskPrompt(input);
    input.onLog?.(`Claude ${input.workflow.step.name}: validated read-only Build broker; native filesystem, shell and agent tools are unavailable.`);
    await input.onConversation?.({ kind: 'request', instructions: args[args.indexOf('--system-prompt') + 1] ?? '', prompt });
    input.signal?.throwIfAborted(); await lease.validate();
    const raw = await capture(command, args, { cwd: directory, input: prompt, timeoutMs: input.settings.timeoutSeconds * 1000,
      ...(input.signal ? { signal: input.signal } : {}) });
    await bridge.dispose();
    try { bridge.assertBudget(); }
    catch { throw new ProcessFailure('Claude reached its captured CoForge read-tool call limit. Retry explicitly after reviewing the run.', raw); }
    try { input.signal?.throwIfAborted(); await lease.validate(); }
    catch (error) { throw new ProcessFailure(error instanceof Error ? error.message : 'Original Build validation failed after reading.', raw); }
    return raw;
  } finally {
    try { await bridge?.dispose(); }
    finally { await rm(directory, { recursive: true, force: true }); }
  }
}
