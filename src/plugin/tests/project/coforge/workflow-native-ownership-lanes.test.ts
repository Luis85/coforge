import { expect, it, vi } from 'vitest';
import { seededStore } from './memory-storage';
import { WorkflowJobLanes } from '../../../features/coforge/application/workflow-job-lanes';
import type { AgentJob } from '../../../features/coforge/domain/types';
import { assertVerificationSettled } from '../../../features/coforge/application/verification-admission';

it('retains one short-task slot for an orphan foreground provider until explicit acknowledgement', async () => {
  const { store } = await seededStore(); const ideas = store.internalSnapshot().ideas;
  const orphan: AgentJob = { id: 'orphan-build', ideaId: ideas[0]!.id, stage: 'implement', provider: 'claude', status: 'failed', startedAt: new Date().toISOString(), logs: [],
    nativeProcess: { runId: 'run', attemptId: 'attempt', projectId: 'CFP-001', identity: { pid: 123, platform: process.platform, birth: 'original', image: 'a'.repeat(64) }, phase: 'unknown', observedAt: new Date().toISOString() } };
  const queued: AgentJob = { id: 'queued-analysis', ideaId: ideas[1]!.id, stage: 'plan', provider: 'claude', status: 'queued', startedAt: orphan.startedAt, logs: [] };
  const build: AgentJob = { ...queued, id: 'healthy-build', ideaId: ideas[2]!.id, stage: 'implement' };
  await store.transaction(state => { state.jobs.push(orphan, queued, build); });
  const run = vi.fn(async (job: AgentJob) => { await store.transaction(state => { state.jobs.find(item => item.id === job.id)!.status = 'succeeded'; }); });
  const lanes = new WorkflowJobLanes(store, run); lanes.kick(); await lanes.idle();
  expect(run.mock.calls.map(([job]) => job.id)).toEqual(['healthy-build']);
  await store.transaction(state => { state.jobs.find(item => item.id === orphan.id)!.nativeProcess!.operatorAcknowledgedAt = new Date().toISOString(); });
  lanes.poke(); await lanes.idle();
  expect(run.mock.calls.map(([job]) => job.id)).toEqual(['healthy-build', 'queued-analysis']);
});

it('blocks same-request private preparation without consuming a fictitious paid-provider lane', async () => {
  const { store } = await seededStore(); const ideas = store.internalSnapshot().ideas;
  const prepared: AgentJob = { id: 'prepared-only', ideaId: ideas[0]!.id, stage: 'plan', provider: 'codex', status: 'failed', startedAt: new Date().toISOString(), logs: [],
    nativeRuntime: { runId: 'run', attemptId: 'attempt', projectId: 'CFP-001', directory: '/private/native', ownerToken: 'a'.repeat(64) } };
  const queued: AgentJob = { id: 'healthy-analysis', ideaId: ideas[1]!.id, stage: 'plan', provider: 'claude', status: 'queued', startedAt: prepared.startedAt, logs: [] };
  const sameRequest = { ...queued, id: 'blocked-same-request', ideaId: prepared.ideaId };
  await store.transaction(state => { state.jobs.push(prepared, queued, sameRequest); });
  const run = vi.fn(async (job: AgentJob) => { await store.transaction(state => { state.jobs.find(item => item.id === job.id)!.status = 'succeeded'; }); });
  const lanes = new WorkflowJobLanes(store, run); lanes.kick(); await lanes.idle();
  expect(run.mock.calls.map(([job]) => job.id)).toEqual(['healthy-analysis']);
  expect(() => assertVerificationSettled(store.snapshot(), prepared.ideaId)).toThrow('private runtime preparation');
  expect(store.snapshot().jobs.find(job => job.id === prepared.id)?.nativeProcess).toBeUndefined();
});
