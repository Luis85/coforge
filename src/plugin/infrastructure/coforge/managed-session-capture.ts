import type { StageInput } from '../../features/coforge/application/ports';
import type { NativeWorkflowProcessRecord } from '../../features/coforge/domain/native-workflow-process';
import { isManagedWorkflowSession } from '../../features/coforge/domain/workflow-lifecycle';
import { ideaProjectId } from '../../features/coforge/domain/projects';
import { ProviderFailureError, providerFailureFor, providerFailureInfo } from '../../features/coforge/domain/provider-failure';
import { captureProcess, ProcessOwnershipUnknown, type ProcessOptions } from './process';
import { ClaudeSessionResult } from './claude-stream-result';
import { CodexOutput } from './codex-output';
import { persistProviderEvidence } from './provider-evidence';

/** OS lifetime ownership is independent of coding permission. Restricted tools/cwd remain unchanged. */
export function managedSessionCapture(input: StageInput, provider: 'claude' | 'codex', capture: typeof captureProcess = captureProcess): typeof captureProcess {
  if (!isManagedWorkflowSession(input.workflow)) return capture;
  const snapshot = input.workflow;
  if (process.platform !== 'win32') return async (command, args, options) => {
    if (options.input === undefined) return capture(command, args, options);
    let observed: 'launched' | 'terminated' | 'unknown' | undefined;
    const originalObserve = options.onOwnedProcess;
    const modelOptions: ProcessOptions = { ...options, timeoutMs: undefined, managedSession: true,
      // Preserve restricted POSIX capabilities and callbacks. No independent Windows lifetime is claimed.
      stdoutResult: provider === 'claude' ? new ClaudeSessionResult(options.maxBytes, true) : new CodexOutput(),
    };
    if (originalObserve) modelOptions.onOwnedProcess = async (identity, phase, lifetime) => { await originalObserve(identity, phase, lifetime); observed = phase; };
    try {
      return await capture(command, args, modelOptions);
    } catch (error) {
      if (error instanceof ProcessOwnershipUnknown && error.originalIdentity && snapshot) {
        const original = error.originalIdentity;
        const observe: ProcessOptions['onOwnedProcess'] = originalObserve ?? (input.onNativeProcess ? async (identity, phase) => persistProviderEvidence(() => input.onNativeProcess!({
          runId: snapshot.runId, attemptId: snapshot.attemptId, projectId: ideaProjectId(input.idea), identity, phase, observedAt: new Date().toISOString(),
        })) : undefined);
        try {
          if (observed === undefined) await observe?.(original, 'launched');
          if (observed !== 'unknown') await observe?.(original, 'unknown');
        } catch (cause) { throw new ProcessOwnershipUnknown(error.output, error.diagnostic, providerFailureInfo(cause) ?? providerFailureFor('persistence', true), error.ownership, original); }
      }
      throw error;
    }
  };
  if (!snapshot || !input.onNativeProcess) throw new ProviderFailureError(providerFailureFor('configuration'));
  const save = input.onNativeProcess;
  return async (command, args, options) => {
    // Capability/version queries stay bounded and never start a model session.
    if (options.input === undefined) return capture(command, args, options);
    let record: NativeWorkflowProcessRecord | undefined;
    const raw = await capture(command, args, { ...options, timeoutMs: undefined, ownedTree: true, managedSession: true,
      // This internal field selects the shared OS supervisor, not a tool/access grant.
      nativeCoding: { runId: snapshot.runId, attemptId: snapshot.attemptId, projectId: ideaProjectId(input.idea) },
      stdoutResult: provider === 'claude' ? new ClaudeSessionResult(options.maxBytes, true) : new CodexOutput(),
      onOwnedProcess: async (identity, phase, lifetime) => {
        const original = lifetime ?? record?.lifetime;
        record = { runId: snapshot.runId, attemptId: snapshot.attemptId, projectId: ideaProjectId(input.idea), identity, phase,
          observedAt: new Date().toISOString(), ...(original ? { lifetime: original } : {}) };
        if (options.onOwnedProcess) await options.onOwnedProcess(identity, phase, original);
        else await persistProviderEvidence(() => save(record!));
      },
    });
    if (!record?.lifetime || record.phase !== 'terminated')
      throw new ProcessOwnershipUnknown(raw, undefined, providerFailureFor('ownership_unknown'), record?.lifetime ? { identity: record.identity, lifetime: record.lifetime } : undefined);
    return raw;
  };
}
