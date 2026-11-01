import type { StageInput } from '../../../features/coforge/application/ports';
import type { WorkflowWorkspaces } from '../../../features/coforge/application/workflow-workspace-ports';
import { defaultIntegration } from '../../../features/coforge/domain/seed';
import { runBackgroundClaude } from './claude';
import { runCodexStage } from '../codex-runner';
import { ProcessOwnershipUnknown, type ProcessOptions } from '../process';
import { WorkerOwnershipUnknown, type BuildExecutor } from './service';
import { workerCapture } from './process';
import type { WorkerStore } from './store';
import { inputHash } from './protocol';
import { reviewedBuildSeed, importReviewedBuildSeed } from '../background-build-seed/import';

/** Reuse restricted transports and host-owned file policy; never serialize renderer callbacks. */
export function nativeBuildExecutor(store: WorkerStore, workspaces: WorkflowWorkspaces, captureFactory: typeof workerCapture = workerCapture): BuildExecutor {
  return async (request, hooks) => {
    const job = store.all().find(row => row.snapshot.ref.inputHash === inputHash(request));
    if (!job) throw new Error('The native worker job identity disappeared.');
    const files = store.get(job.snapshot.ref).files;
    const seed = await reviewedBuildSeed(store.files.directory, request);
    const provider = request.input.workflow.step.provider;
    const protectedPaths = request.protectedProjectPaths; if (!protectedPaths) throw new Error('The captured managed-folder authority is unavailable.');
    if (provider !== 'claude' && provider !== 'codex') throw new Error('Background Build supports only captured native Claude or Codex providers.');
    let uncertain = false;
    const capture = captureFactory(files, hooks, provider);
    const restrictedCapture = async (executable: string, args: readonly string[], options: ProcessOptions) => {
      const restricted = [...args];
      if (provider === 'claude') {
        const at = restricted.indexOf('--disallowedTools');
        if (at < 0) throw new Error('The restricted Claude tool policy is unavailable.');
        restricted[at + 1] += ',Read(**/.coforge/**),Edit(**/.coforge/**),Write(**/.coforge/**)';
      }
      try { return await capture(executable, restricted, { ...options, timeoutMs: undefined }); }
      catch (error) {
        if (error instanceof WorkerOwnershipUnknown) { uncertain = true; throw new ProcessOwnershipUnknown(''); }
        throw error;
      }
    };
    const scoped: WorkflowWorkspaces = { start: () => workspaces.start(), assertReviewable: (id, expected) => workspaces.assertReviewable(id, expected),
      acknowledge: (id, attemptId, reusable) => workspaces.acknowledge(id, attemptId, reusable), acquire: async input => {
        const lease = await workspaces.acquire({ ...input, ...(seed ? { workspaceId: undefined, workspaceEpoch: request.input.workflow.backgroundRetryId ?? request.input.workflow.polishingId, baseCommit: seed.manifest.identity.baseCommit } : {}) });
        if (seed) {
          try { await importReviewedBuildSeed(seed, lease, request, hooks.signal); }
          catch (error) { await lease.release(true); throw error; }
        }
        return { ...lease, release: unknown => lease.release(unknown || uncertain) };
      } };
    const input: StageInput = { ...request.input, settings: { ...request.input.settings,
      maxTurns: request.policy.maxTurns ?? request.input.settings.maxTurns, maxBudgetUsd: request.policy.maxBudgetUsd ?? request.input.settings.maxBudgetUsd },
      integration: { ...defaultIntegration(), ...request.input.integration }, signal: hooks.signal,
      onConversation: hooks.conversation, onWorkspace: hooks.workspace, onChanges: hooks.changes, onUsage: hooks.cost, onTokenUsage: hooks.usage,
      onVerification: hooks.verification, onVerificationRuntime: hooks.verificationRuntime,
      onNativeRuntime: hooks.nativeRuntime, onNativeProcess: hooks.nativeProcess,
      onSessionEvent: hooks.sessionEvent,
      onLog: message => { void hooks.log(message).catch(() => undefined); },
    };
    try { return provider === 'claude' ? await runBackgroundClaude(input, scoped, files, restrictedCapture, protectedPaths, hooks.activity) : await runCodexStage(input, scoped, restrictedCapture, protectedPaths, hooks.activity); }
    catch (error) { if (uncertain || error instanceof ProcessOwnershipUnknown) throw new WorkerOwnershipUnknown('Provider termination remains unverified.'); throw error; }
  };
}
