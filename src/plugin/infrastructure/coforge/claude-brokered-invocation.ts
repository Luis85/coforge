import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { StageInput } from '../../features/coforge/application/ports';
import type { WorkflowWorkspaceLease } from '../../features/coforge/application/workflow-workspace-ports';
import { executionAccess, executionTaskPrompt } from '../../features/coforge/application/workflow-execution';
import { brokeredClaudeArgs, prepareNativeClaude } from './claude-native-tools';
import { codexWorkflowTools } from './codex-workflow-tools';
import { captureProcess, ProcessFailure, ProcessOwnershipUnknown } from './process';
import { assignProviderFailure, providerFailureFor, providerFailureInfo, providerFailureMessage } from '../../features/coforge/domain/provider-failure';
import type { NativeWorkflowProcessRecord } from '../../features/coforge/domain/native-workflow-process';
import { usesNativeClaudeTools } from './claude-native-tools';
import { ideaProjectId } from '../../features/coforge/domain/projects';
import type { NativeProcessIdentity } from './durable-worker/process-identity';
import { captureObservedClaude } from './claude-observed-capture';
import { persistProviderEvidence, validateProviderWorkspace } from './provider-evidence';
import { isManagedWorkflowSession } from '../../features/coforge/domain/workflow-lifecycle';
import type { NativeWorkflowLifetimeRef } from '../../features/coforge/domain/native-workflow-lifetime';

/** Native Agent children share this invocation's broker, lease and cumulative tool/test limits. */
export async function openBrokeredClaude(input: StageInput, lease: WorkflowWorkspaceLease, command: string, capture: typeof captureProcess) {
  if (!input.workflow) throw new Error('Native tools require a captured workflow.');
  if (usesNativeClaudeTools(input) && !input.onNativeProcess) throw new Error('Native workflow execution requires durable original-provider ownership capture.');
  if (lease.readOnly && executionAccess(input) !== 'readproject') throw new Error('A qualified read-only lease cannot be adopted for editing or a different access profile.');
  if ((lease.readOnly || lease.protectedProjectPaths !== undefined) && executionAccess(input) === 'readproject'
    && (!lease.readOnly || !lease.validate || lease.protectedProjectPaths === undefined))
    throw new Error('Inherited Build access requires a qualified read-only lease with protected paths and validation.');
  input.signal?.throwIfAborted(); await validateProviderWorkspace(() => lease.validate?.());
  if (lease.id) await persistProviderEvidence(() => input.onWorkspace?.(lease.id!));
  const directory = await mkdtemp(join(tmpdir(), 'coforge-claude-native-'));
  let bridge: Awaited<ReturnType<typeof codexWorkflowTools>> | undefined;
  let disposed = false;
  let processRecord: NativeWorkflowProcessRecord | undefined;
  const observe = async (identity: NativeProcessIdentity, phase: NativeWorkflowProcessRecord['phase'], lifetime?: NativeWorkflowLifetimeRef) => {
    if (!usesNativeClaudeTools(input) && !isManagedWorkflowSession(input.workflow)) return;
    const original = lifetime ?? processRecord?.lifetime;
    const record: NativeWorkflowProcessRecord = { runId: input.workflow!.runId, attemptId: input.workflow!.attemptId, projectId: ideaProjectId(input.idea), identity, phase, observedAt: new Date().toISOString(), ...(original ? { lifetime: original } : {}) };
    processRecord = record; await persistProviderEvidence(() => input.onNativeProcess!(record));
  };
  const dispose = async () => {
    if (disposed) return; disposed = true;
    try {
      await bridge?.dispose();
      if (processRecord && processRecord.phase !== 'terminated') await observe(processRecord.identity, 'unknown');
    }
    finally { if (!isManagedWorkflowSession(input.workflow) || !processRecord || processRecord.phase === 'terminated') await rm(directory, { recursive: true, force: true }); }
  };
  try {
    bridge = await codexWorkflowTools(input, lease, lease.protectedProjectPaths);
    const scoped = bridge;
    const config = join(directory, 'broker.json');
    await writeFile(config, JSON.stringify({ mcpServers: { coforge: { type: 'http', url: bridge.url,
      headers: { Authorization: `Bearer ${bridge.token}` } } } }), { mode: 0o600, flag: 'wx' });
    await prepareNativeClaude(input, config, command, capture);
    return { bridge: scoped, dispose, uncertain: () => Boolean(processRecord && processRecord.phase !== 'terminated'),
      complete: async () => {
        if (!usesNativeClaudeTools(input)) return;
        if (!processRecord || processRecord.phase === 'unknown') throw new Error('The original provider completion identity is unverified.');
        if (isManagedWorkflowSession(input.workflow) && process.platform === 'win32') {
          if (processRecord.phase !== 'terminated' || !processRecord.lifetime) throw new ProcessOwnershipUnknown('');
          return;
        }
        // Qualified Agent workers are in-process and synchronous. This is provider-contract completion,
        // combined with root close and closed broker/container cleanup, not an independent OS-tree receipt.
        await observe(processRecord.identity, 'terminated');
      }, run: async () => {
      const args = brokeredClaudeArgs(input, config); const prompt = executionTaskPrompt(input);
      await persistProviderEvidence(() => input.onConversation?.({ kind: 'request', instructions: args[args.indexOf('--system-prompt') + 1] ?? '', prompt }));
      input.signal?.throwIfAborted(); await validateProviderWorkspace(() => lease.validate?.());
      const raw = await captureObservedClaude(input, command, args, { cwd: directory, input: prompt, signal: input.signal,
        timeoutMs: isManagedWorkflowSession(input.workflow) ? undefined : input.settings.timeoutSeconds * 1000, ownedTree: true, onOwnedProcess: observe }, capture, { COFORGE_SESSION_TOKEN: scoped.token });
      await scoped.dispose();
      try { scoped.assertBudget(); input.signal?.throwIfAborted(); await validateProviderWorkspace(() => lease.validate?.()); }
      catch (error) {
        if (error instanceof ProcessOwnershipUnknown) throw new ProcessOwnershipUnknown(raw, error.diagnostic, providerFailureInfo(error), error.ownership);
        const info = providerFailureInfo(error) ?? providerFailureFor('execution_failed');
        throw assignProviderFailure(new ProcessFailure(providerFailureMessage(info), raw), info);
      }
      return raw;
    } };
  } catch (error) { await dispose(); throw error; }
}
