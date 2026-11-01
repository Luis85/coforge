import { expect, it, vi } from 'vitest';
import { ai, fixture } from './configured-workflow-fixture';
import { acknowledgeNativeWorkflowProcess, nativeWorkflowAcknowledgementReview } from '../../../features/coforge/application/native-workflow-acknowledgement';
import { assertVerificationSettled } from '../../../features/coforge/application/verification-admission';
import { recordWorkflowNativeProcess } from '../../../features/coforge/application/native-workflow-process';

async function orphan() {
  const f = await fixture([{ ...ai('analysis'), provider: 'claude', nativeTools: { delegation: { maxConcurrent: 2 } } }]);
  await f.engine.startWorkflow(f.idea.id); await f.engine.waitUntilIdle();
  const jobId = f.store.snapshot().jobs[0]!.id;
  await f.store.transaction(state => {
    const job = state.jobs[0]!; job.status = 'failed';
    job.nativeProcess = { runId: job.workflow!.runId, attemptId: job.workflow!.attemptId, projectId: job.projectId!, identity: { pid: 123, platform: 'win32', birth: 'captured-birth', image: 'a'.repeat(64) }, phase: 'unknown', observedAt: '2026-11-01T08:00:00Z' };
    state.workflowStopHolds = [f.idea.id];
  });
  return { ...f, jobId };
}

it('records explicit operator cessation acknowledgement without fabricating OS proof or releasing execution/review gates', async () => {
  const f = await orphan();
  const expected = nativeWorkflowAcknowledgementReview(f.store.snapshot(), f.jobId);
  await expect(acknowledgeNativeWorkflowProcess(f.store, f.jobId, expected, false)).rejects.toThrow('Confirm');
  expect(() => assertVerificationSettled(f.store.snapshot(), f.idea.id)).toThrow('original native');
  await acknowledgeNativeWorkflowProcess(f.store, f.jobId, expected, true);
  const state = f.store.snapshot();
  expect(state.jobs[0]!.nativeProcess).toMatchObject({ phase: 'unknown', operatorAcknowledgedAt: expect.any(String) });
  expect(state.workflowStopHolds).toContain(f.idea.id);
  expect(state.jobs).toHaveLength(1);
  expect(() => assertVerificationSettled(state, f.idea.id)).not.toThrow();
  expect(f.runner).toHaveBeenCalledTimes(1);
  const acknowledged = state.jobs[0]!.nativeProcess!;
  await expect(recordWorkflowNativeProcess(f.store, f.jobId, { ...acknowledged, phase: 'terminated', operatorAcknowledgedAt: '2026-11-01T09:00:00Z' })).rejects.toThrow();
  await recordWorkflowNativeProcess(f.store, f.jobId, { ...acknowledged, phase: 'terminated', operatorAcknowledgedAt: undefined, observedAt: new Date(Date.parse(acknowledged.observedAt) + 1000).toISOString() });
  expect(f.store.snapshot().jobs[0]!.nativeProcess?.operatorAcknowledgedAt).toBe(acknowledged.operatorAcknowledgedAt);
  await f.engine.stop();
});
it('keeps secondary operator acknowledgement available for an unresolved managed session without native tool preferences', async () => {
  const f = await orphan();
  await f.store.transaction(state => {
    const snapshot = state.jobs[0]!.workflow!; delete snapshot.step.nativeTools;
    snapshot.lifecycle = { version: 1, mode: 'managed-session' };
  });
  try {
    const review = nativeWorkflowAcknowledgementReview(f.store.snapshot(), f.jobId);
    await expect(acknowledgeNativeWorkflowProcess(f.store, f.jobId, review, false)).rejects.toThrow('Confirm');
    await acknowledgeNativeWorkflowProcess(f.store, f.jobId, review, true);
    expect(f.store.snapshot().jobs[0]!.nativeProcess).toMatchObject({ phase: 'unknown', operatorAcknowledgedAt: expect.any(String) });
    expect(f.store.snapshot().workflowStopHolds).toContain(f.idea.id); expect(f.runner).toHaveBeenCalledTimes(1);
  } finally { await f.engine.stop(); }
});

it.each(['container', 'concurrent', 'identity', 'running', 'durable'] as const)('rejects acknowledgement when %s evidence changed or is unresolved', async reason => {
  const f = await orphan();
  const expected = nativeWorkflowAcknowledgementReview(f.store.snapshot(), f.jobId);
  await f.store.transaction(state => {
    const job = state.jobs[0]!;
    if (reason === 'container') job.verificationRuntime = [{ verificationId: 'test', commandId: 'test', runId: job.workflow!.runId, attemptId: job.workflow!.attemptId, projectId: job.projectId!, dockerBin: 'docker', endpoint: 'npipe:////./pipe/docker_engine', imageId: `sha256:${'a'.repeat(64)}`, containerName: 'coforge-owned', ownerToken: 'private', sourceDirectory: '/private/source', sourceHash: 'b'.repeat(64), phase: 'started', startedAt: '2026-11-01T08:00:00Z' }];
    if (reason === 'concurrent') state.jobs.push({ ...job, id: 'new-attempt', status: 'queued', nativeProcess: undefined });
    if (reason === 'identity') job.nativeProcess!.identity.birth = 'changed-birth';
    if (reason === 'running') job.status = 'running';
    if (reason === 'durable') job.durable = { intent: 'start', ref: { version: 1, executionId: 'e', workerId: 'w', epoch: 1, inputHash: 'a'.repeat(64) }, policy: { mode: 'background' } };
  });
  await expect(acknowledgeNativeWorkflowProcess(f.store, f.jobId, expected, true)).rejects.toThrow();
  expect(f.store.snapshot().jobs[0]!.nativeProcess?.operatorAcknowledgedAt).toBeUndefined();
  await f.engine.stop();
});

it.each(['missing', 'failed', 'success'] as const)('requires attributable private runtime cleanup before %s acknowledgement can release ownership', async outcome => {
  const f = await orphan();
  const runtime = { directory: '/synthetic/private-runtime', ownerToken: 'a'.repeat(64), runId: f.store.snapshot().jobs[0]!.workflow!.runId, attemptId: f.store.snapshot().jobs[0]!.workflow!.attemptId, projectId: f.store.snapshot().jobs[0]!.projectId! };
  await f.store.transaction(state => { state.jobs[0]!.nativeProcess!.privateRuntime = runtime; });
  const expected = nativeWorkflowAcknowledgementReview(f.store.snapshot(), f.jobId);
  const purge = vi.fn(async () => { if (outcome === 'failed') throw new Error('Fixture cleanup failure'); });
  if (outcome === 'success') {
    await acknowledgeNativeWorkflowProcess(f.store, f.jobId, expected, true, purge);
    expect(purge).toHaveBeenCalledWith(runtime);
    expect(f.store.snapshot().jobs[0]!.nativeProcess?.privateRuntime).toBeUndefined();
    expect(f.store.snapshot().jobs[0]!.nativeProcess?.operatorAcknowledgedAt).toEqual(expect.any(String));
    expect(f.store.snapshot().jobs[0]!.nativeProcess?.phase).toBe('unknown');
  } else {
    await expect(acknowledgeNativeWorkflowProcess(f.store, f.jobId, expected, true, outcome === 'missing' ? undefined : purge)).rejects.toThrow('cleanup');
    expect(f.store.snapshot().jobs[0]!.nativeProcess?.operatorAcknowledgedAt).toBeUndefined();
    expect(f.store.snapshot().jobs[0]!.nativeProcess?.privateRuntime).toEqual(runtime);
    expect(() => assertVerificationSettled(f.store.snapshot(), f.idea.id)).toThrow();
  }
  await f.engine.stop();
});
