import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { StageInput } from '../../features/coforge/application/ports';
import type { WorkflowWorkspaceLease } from '../../features/coforge/application/workflow-workspace-ports';
import { executionAccess, executionTaskPrompt } from '../../features/coforge/application/workflow-execution';
import { codexWorkflowTools } from './codex-workflow-tools';
import { backgroundClaudeArgs } from './durable-worker/claude';
import { captureProcess, ProcessFailure } from './process';
import { captureObservedClaude } from './claude-observed-capture';
import { persistProviderEvidence, validateProviderWorkspace } from './provider-evidence';
import { assignProviderFailure, providerFailureFor, providerFailureInfo, providerFailureMessage } from '../../features/coforge/domain/provider-failure';
import { ProcessOwnershipUnknown } from './process';
import { diagnoseProviderFailure } from './provider-failure';
import { isManagedWorkflowSession } from '../../features/coforge/domain/workflow-lifecycle';

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
  input.signal?.throwIfAborted(); await validateProviderWorkspace(() => lease.validate!());
  if (lease.id) await persistProviderEvidence(() => input.onWorkspace?.(lease.id!));
  const directory = await mkdtemp(join(tmpdir(), 'coforge-claude-reader-'));
  let bridge: Awaited<ReturnType<typeof codexWorkflowTools>> | undefined;
  let uncertain = false;
  try {
    bridge = await codexWorkflowTools(input, lease, lease.protectedProjectPaths);
    const config = join(directory, 'broker.json');
    await writeFile(config, JSON.stringify({ mcpServers: { coforge: { type: 'http', url: bridge.url,
      headers: { Authorization: `Bearer ${bridge.token}` } } } }), { mode: 0o600 });
    const args = backgroundClaudeArgs(input, config);
    args[args.indexOf('--allowedTools') + 1] = READ_TOOLS.map(name => `mcp__coforge__${name}`).join(',');
    const prompt = executionTaskPrompt(input);
    input.onLog?.(`Claude ${input.workflow.step.name}: validated read-only Build broker; native filesystem, shell and agent tools are unavailable.`);
    await persistProviderEvidence(() => input.onConversation?.({ kind: 'request', instructions: args[args.indexOf('--system-prompt') + 1] ?? '', prompt }));
    input.signal?.throwIfAborted(); await validateProviderWorkspace(() => lease.validate!());
    const raw = await captureObservedClaude(input, command, args, { cwd: directory, input: prompt, timeoutMs: isManagedWorkflowSession(input.workflow) ? undefined : input.settings.timeoutSeconds * 1000,
      ...(input.signal ? { signal: input.signal } : {}) }, capture, { COFORGE_SESSION_TOKEN: bridge.token });
    await bridge.dispose();
    try { bridge.assertBudget(); }
    catch (error) {
      if (error instanceof ProcessOwnershipUnknown) throw new ProcessOwnershipUnknown(raw, error.diagnostic, providerFailureInfo(error), error.ownership);
      const info = providerFailureFor('tool_limit'); throw assignProviderFailure(new ProcessFailure(providerFailureMessage(info), raw), info);
    }
    try { input.signal?.throwIfAborted(); await validateProviderWorkspace(() => lease.validate!()); }
    catch (error) {
      const info = providerFailureInfo(diagnoseProviderFailure('claude', error, input.signal)) ?? providerFailureFor('workspace_validation');
      throw assignProviderFailure(new ProcessFailure(providerFailureMessage(info), raw), info);
    }
    return raw;
  } catch (error) {
    uncertain = isManagedWorkflowSession(input.workflow) && error instanceof ProcessOwnershipUnknown;
    throw error;
  } finally {
    try { await bridge?.dispose(); }
    finally { if (!uncertain) await rm(directory, { recursive: true, force: true }); }
  }
}
