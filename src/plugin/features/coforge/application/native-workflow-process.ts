import { nativeWorkflowPrivateRuntimeCheck, nativeWorkflowProcessRecordCheck, type NativeWorkflowPrivateRuntime, type NativeWorkflowProcessRecord } from '../domain/native-workflow-process';
import type { StudioStore } from './studio-store';

/** Retain the cleanup capability before native runtime state preparation. */
export async function recordWorkflowNativeRuntime(store: StudioStore, jobId: string, input: NativeWorkflowPrivateRuntime | undefined): Promise<void> {
  const runtime = input ? nativeWorkflowPrivateRuntimeCheck(input) : undefined;
  await store.transaction(state => {
    const job = state.jobs.find(item => item.id === jobId);
    if (!job?.workflow?.step.nativeTools || job.durable || job.provider !== 'codex') throw new Error('Private native preparation does not match a foreground Codex attempt.');
    if (runtime) {
      if (job.workflow.runId !== runtime.runId || job.workflow.attemptId !== runtime.attemptId || job.projectId !== runtime.projectId || job.nativeProcess || job.nativeRuntime && JSON.stringify(job.nativeRuntime) !== JSON.stringify(runtime))
        throw new Error('Original private native preparation cannot change or attach to a started provider.');
      job.nativeRuntime = runtime;
    } else {
      if (job.nativeProcess && job.nativeRuntime) throw new Error('Recover the original provider before clearing private preparation.');
      delete job.nativeRuntime;
    }
  });
}

/** Commit original OS identity before the provider receives task input. */
export async function recordWorkflowNativeProcess(store: StudioStore, jobId: string, input: NativeWorkflowProcessRecord): Promise<void> {
  const record = nativeWorkflowProcessRecordCheck(input);
  if (record.operatorAcknowledgedAt !== undefined) throw new Error('Only explicit operator review can acknowledge unknown native ownership.');
  await store.transaction(state => {
    const job = state.jobs.find(item => item.id === jobId);
    if (!job?.workflow?.step.nativeTools || job.durable || !['claude', 'codex'].includes(job.provider) || job.workflow.runId !== record.runId || job.workflow.attemptId !== record.attemptId || job.projectId !== record.projectId)
      throw new Error('Native provider ownership does not match the captured foreground attempt.');
    const previous = job.nativeProcess;
    if (job.provider === 'codex' && !previous && (!record.privateRuntime || JSON.stringify(job.nativeRuntime) !== JSON.stringify(record.privateRuntime))) throw new Error('Private native runtime ownership must be prepared before the original provider starts.');
    if (previous) {
      const immutable = (item: NativeWorkflowProcessRecord) => JSON.stringify({ ...item, phase: undefined, observedAt: undefined, operatorAcknowledgedAt: undefined, privateRuntime: undefined });
      const runtimeChanged = JSON.stringify(previous.privateRuntime) !== JSON.stringify(record.privateRuntime);
      if (runtimeChanged && !(previous.privateRuntime && !record.privateRuntime && previous.phase === 'terminated' && record.phase === 'terminated')) throw new Error('Private native runtime ownership can only clear after confirmed provider cessation and host cleanup.');
      if (immutable(previous) !== immutable(record) || Date.parse(record.observedAt) < Date.parse(previous.observedAt) || previous.phase === 'terminated' && record.phase !== 'terminated' || record.phase === 'launched' && previous.phase !== 'launched')
        throw new Error('Original native provider ownership cannot change or regress.');
    } else if (record.phase !== 'launched') throw new Error('Native provider ownership must be captured before execution.');
    job.nativeProcess = { ...record, ...(previous?.operatorAcknowledgedAt ? { operatorAcknowledgedAt: previous.operatorAcknowledgedAt } : {}) };
    if (job.nativeRuntime) {
      if (JSON.stringify(job.nativeRuntime) !== JSON.stringify(record.privateRuntime)) throw new Error('The original private native preparation changed.');
      delete job.nativeRuntime;
    }
  });
}
