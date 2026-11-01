import type { AppState } from '../domain/types';
import { contextEventId } from '../domain/integrity';
import type { StudioStore } from './studio-store';
import { addEvent } from './studio-store';
import type { NativeWorkflowPrivateRuntime } from '../domain/native-workflow-process';

/** A reviewed operator statement can release an orphan hold, never fabricate OS termination. */
export function nativeWorkflowAcknowledgementReview(state: Pick<AppState, 'jobs'>, jobId: string): string {
  const job = state.jobs.find(job => job.id === jobId);
  if (!job?.workflow?.step.nativeTools || job.durable || !['claude', 'codex'].includes(job.provider) || !['failed', 'cancelled'].includes(job.status) || job.nativeProcess?.phase !== 'unknown' || job.nativeProcess.operatorAcknowledgedAt) throw new Error('Only an unresolved failed or cancelled native provider can be acknowledged. Check the original execution first.');
  if (job.nativeProcess.runId !== job.workflow.runId || job.nativeProcess.attemptId !== job.workflow.attemptId || job.nativeProcess.projectId !== job.projectId) throw new Error('Restore the original provider ownership metadata before acknowledging this attempt.');
  if (job.verificationRuntime?.some(record => record.phase !== 'terminal')) throw new Error('Check the original Docker engine until every owned verification container is proven stopped. Provider acknowledgement cannot bypass container recovery.');
  const concurrent = state.jobs.filter(item => item.ideaId === job.ideaId && ['queued', 'running'].includes(item.status));
  if (concurrent.length) throw new Error('Settle the active request attempt before acknowledging an earlier provider.');
  return contextEventId(JSON.stringify([job.id, job.ideaId, job.projectId, job.status, job.finishedAt, job.workflow.runId, job.workflow.attemptId, job.nativeProcess, job.verificationRuntime ?? [], concurrent]));
}

export async function acknowledgeNativeWorkflowProcess(store: StudioStore, jobId: string, expectedIdentity: string, confirmed: boolean,
  purgePrivateRuntime?: (runtime: NativeWorkflowPrivateRuntime) => Promise<void>): Promise<void> {
  if (confirmed !== true) throw new Error('Confirm that you inspected the original provider and its native assistants and they have stopped.');
  const current = store.snapshot();
  if (nativeWorkflowAcknowledgementReview(current, jobId) !== expectedIdentity) throw new Error('The original execution changed. Review its current recovery state again.');
  const runtime = current.jobs.find(job => job.id === jobId)?.nativeProcess?.privateRuntime;
  if (runtime) {
    if (!purgePrivateRuntime) throw new Error('Private native runtime cleanup is unavailable in this host. Reopen the contained desktop host before acknowledging ownership.');
    try { await purgePrivateRuntime(runtime); }
    catch { throw new Error('Private native runtime cleanup could not be verified. Original ownership remains quarantined; check the original runtime and retry cleanup.'); }
  }
  await store.transaction(state => {
    if (nativeWorkflowAcknowledgementReview(state, jobId) !== expectedIdentity) throw new Error('The original execution changed. Review its current recovery state again.');
    const job = state.jobs.find(job => job.id === jobId)!;
    job.nativeProcess!.operatorAcknowledgedAt = new Date().toISOString();
    delete job.nativeProcess!.privateRuntime;
    job.logs.push('Operator acknowledged that the original provider and its native assistants stopped. This is not OS termination proof.');
    addEvent(state, 'system', 'Original provider cessation acknowledged by the operator. Stop, review and explicit retry gates remain.', job.ideaId);
  });
}
