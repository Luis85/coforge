import type { StudioStore } from '../../../features/coforge/application/studio-store';
import { recoverVerificationRuntime } from './runtime';
import { stopOwnedProcessTree } from '../durable-worker/process-identity';
import type { NativeWorkflowProcessRecord } from '../../../features/coforge/domain/native-workflow-process';
import { purgeCodexPrivateRuntime } from '../codex-private-runtime';

const recoverNativeProvider = async (record: NativeWorkflowProcessRecord): Promise<'terminal' | 'unknown'> => {
  const proof = await stopOwnedProcessTree(record.identity);
  return proof.state === 'terminated' && proof.treeConfirmed ? 'terminal' : 'unknown';
};

/** Reopening never replays a test. Only the original private container identity may be stopped. */
export async function recoverForegroundVerification(store: StudioStore, recover = recoverVerificationRuntime, recoverNative = recoverNativeProvider, jobId?: string, purgePrivate = purgeCodexPrivateRuntime): Promise<void> {
  for (const retained of store.internalSnapshot().jobs) {
    if (retained.durable || jobId !== undefined && retained.id !== jobId || !['failed', 'cancelled'].includes(retained.status)) continue;
    if (retained.nativeProcess && retained.nativeProcess.phase !== 'terminated' && (!retained.nativeProcess.operatorAcknowledgedAt || jobId !== undefined)) {
      const original = retained.nativeProcess;
      let proven = false;
      try { proven = await recoverNative(original) === 'terminal'; } catch { /* An absent or changed root does not prove descendants stopped. */ }
      await store.transaction(state => {
        const job = state.jobs.find(item => item.id === retained.id);
        if (!job?.nativeProcess || JSON.stringify(job.nativeProcess) !== JSON.stringify(original)) throw new Error('Original provider ownership changed during recovery.');
        job.nativeProcess.phase = proven ? 'terminated' : 'unknown'; job.nativeProcess.observedAt = new Date().toISOString();
        if (!proven) {
          job.error = 'Original native provider process-tree termination remains unverified. No paid invocation was replayed.';
          state.workflowStopHolds ??= [];
          if (!state.workflowStopHolds.includes(job.ideaId)) state.workflowStopHolds.push(job.ideaId);
          const run = state.ideas.find(idea => idea.id === job.ideaId)?.workflowRun;
          if (run && run.id === original.runId) { run.state = 'attention'; run.error = job.error; run.revision++; run.updatedAt = job.nativeProcess.observedAt; }
        }
      });
    }
    for (const original of retained.verificationRuntime ?? []) {
      if (original.phase === 'terminal') {
        if (retained.verification?.some(record => record.id === original.verificationId && record.status === 'running')) await store.transaction(state => {
          const job = state.jobs.find(item => item.id === retained.id);
          const runtime = job?.verificationRuntime?.find(item => item.verificationId === original.verificationId);
          const record = job?.verification?.find(item => item.id === original.verificationId);
          if (!runtime || JSON.stringify(runtime) !== JSON.stringify(original)) throw new Error('Original stopped verification ownership changed during recovery.');
          if (record?.status === 'running' && record.runId === runtime.runId && record.attemptId === runtime.attemptId && record.projectId === runtime.projectId && record.sourceHash === runtime.sourceHash && record.commandId === runtime.commandId) {
            record.status = 'unknown'; record.finishedAt = new Date().toISOString();
            record.output = 'The original container stopped, but its result was not durably observed. No command was replayed.';
          }
        });
        continue;
      }
      let outcome: 'terminal' | 'unknown' = 'unknown';
      try { outcome = await recover(original); } catch { /* Retain original ownership and block another admission. */ }
      await store.transaction(state => {
        const job = state.jobs.find(item => item.id === retained.id);
        const runtime = job?.verificationRuntime?.find(item => item.verificationId === original.verificationId);
        if (!job || !runtime || JSON.stringify(runtime) !== JSON.stringify(original)) throw new Error('The original verification ownership changed during recovery.');
        const at = new Date().toISOString();
        if (outcome === 'terminal') { runtime.phase = 'terminal'; runtime.terminalAt = at; }
        const evidence = job.verification?.find(item => item.id === runtime.verificationId);
        if (evidence?.status === 'running') {
          evidence.status = outcome === 'terminal' ? 'interrupted' : 'unknown'; evidence.finishedAt = at;
          evidence.output = outcome === 'terminal' ? 'The original test container was stopped during recovery; no command was replayed.' : 'Original test-container termination remains unverified. No command was replayed.';
        }
        if (outcome === 'unknown') {
          job.error = 'Original verification-container termination is unverified. Inspect its private ownership before starting another attempt.';
          state.workflowStopHolds ??= [];
          if (!state.workflowStopHolds.includes(job.ideaId)) state.workflowStopHolds.push(job.ideaId);
          const run = state.ideas.find(idea => idea.id === job.ideaId)?.workflowRun;
          if (run && run.id === runtime.runId) { run.state = 'attention'; run.error = job.error; run.revision++; run.updatedAt = at; }
        }
      });
    }
    const current = store.internalSnapshot().jobs.find(job => job.id === retained.id);
    const process = current?.nativeProcess; const prepared = !process && current?.nativeRuntime;
    const privateRuntime = process?.privateRuntime ?? prepared;
    if (privateRuntime && (!process || process.phase === 'terminated' || process.operatorAcknowledgedAt)) {
      let purged = false;
      try { await purgePrivate(privateRuntime); purged = true; } catch { /* Preserve the exact private receipt for explicit cleanup recovery. */ }
      await store.transaction(state => {
        const job = state.jobs.find(job => job.id === retained.id);
        const reference = prepared ? job?.nativeRuntime : job?.nativeProcess?.privateRuntime;
        if (!job || JSON.stringify(reference) !== JSON.stringify(privateRuntime) || prepared && job.nativeProcess) throw new Error('Private native runtime ownership changed during cleanup.');
        if (!prepared && job.nativeProcess?.phase !== 'terminated' && !job.nativeProcess?.operatorAcknowledgedAt) throw new Error('Original provider cessation must be checked before private runtime cleanup.');
        if (purged) { if (prepared) delete job.nativeRuntime; else if (job.nativeProcess) delete job.nativeProcess.privateRuntime; }
        else {
          job.error = 'Private native credentials and sessions remain quarantined. Check original execution and retry verified cleanup before starting another attempt.';
          state.workflowStopHolds ??= [];
          if (!state.workflowStopHolds.includes(job.ideaId)) state.workflowStopHolds.push(job.ideaId);
        }
      });
    }
  }
}
