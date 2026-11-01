import { expect, it } from 'vitest';
import { createSeed } from '../../../features/coforge/domain/seed';
import { appendAgentSessionEvent } from '../../../features/coforge/domain/agent-session';
import type { AgentJob } from '../../../features/coforge/domain/types';
import { observedSessionChildren, sessionObservation } from '../../../presentation/composables/coforge/agent-session-display';

it('uses only an original-ref current worker snapshot for live observations, preserving saved evidence for foreign or older snapshots', () => {
  const state = createSeed();
  const at = '2026-11-01T12:00:00Z';
  const saved = appendAgentSessionEvent(undefined, { kind: 'message', text: 'Saved observation' }, at);
  const live = appendAgentSessionEvent(saved, { kind: 'message', text: 'Hot observed output' }, at);
  const ref = { version: 1 as const, executionId: 'original', workerId: 'worker', epoch: 1, inputHash: 'a'.repeat(64) };
  const canonical = { version: 1 as const, ref, sequence: 5, phase: 'running' as const, createdAt: at, lastContactAt: at, elapsedSeconds: 1, logs: [] };
  const job: AgentJob = { id: 'job', ideaId: 'CF-800', projectId: 'CFP-001', provider: 'claude', stage: 'implement', status: 'running', startedAt: at, logs: [], sessionTrace: saved, durable: { intent: 'start', ref, policy: { mode: 'background' }, snapshot: canonical } };
  state.runtime.durableBuildSnapshots = { job: { ...canonical, sequence: 6, sessionTrace: live } };
  expect(sessionObservation(state, job).trace).toEqual(live);
  state.runtime.durableBuildSnapshots.job!.ref = { ...ref, executionId: 'foreign' };
  expect(sessionObservation(state, job).trace).toEqual(saved);
  state.runtime.durableBuildSnapshots.job!.ref = ref; state.runtime.durableBuildSnapshots.job!.sequence = 4;
  expect(sessionObservation(state, job).trace).toEqual(saved);
});

it('never infers children from assistant prose, tool names or duplicate/same-session identifiers', () => {
  const at = '2026-11-01T12:00:00Z';
  let trace = appendAgentSessionEvent(undefined, { kind: 'message', text: 'I launched three reviewers.' }, at);
  trace = appendAgentSessionEvent(trace, { kind: 'tool', tool: 'spawn_agent', status: 'completed' }, at);
  trace = appendAgentSessionEvent(trace, { kind: 'session', sessionId: 'same', parentSessionId: 'same', status: 'running' }, at);
  expect(observedSessionChildren(trace)).toEqual([]);
  trace = appendAgentSessionEvent(trace, { kind: 'session', sessionId: 'observed', parentSessionId: 'root', label: 'Reviewer', status: 'running' }, at);
  trace = appendAgentSessionEvent(trace, { kind: 'session', sessionId: 'observed', parentSessionId: 'root', status: 'completed' }, at);
  expect(observedSessionChildren(trace)).toEqual([{ id: 'observed', parentId: 'root', label: 'Reviewer', status: 'completed' }]);
});
