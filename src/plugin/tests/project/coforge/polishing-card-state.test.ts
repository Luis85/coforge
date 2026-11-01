import { describe, expect, it } from 'vitest';
import { polishingCardState } from '../../../presentation/composables/coforge/polishing-card-state';
import { polishingCardFixture } from './polishing-card-fixture';

describe('polishing state on request cards', () => {
  it('projects queued and running auxiliary work without changing the request', () => {
    const f = polishingCardFixture(); const before = JSON.stringify(f.idea);
    expect(polishingCardState(f.idea, [f.job])).toMatchObject({ status: 'running', label: 'Polishing in progress', spin: true });
    expect(JSON.stringify(f.idea)).toBe(before);
    f.job.status = 'queued'; f.pass.workflow.attempts[0]!.status = 'queued';
    expect(polishingCardState(f.idea, [f.job])).toMatchObject({ status: 'queued', label: 'Polishing queued', spin: false });
    expect(polishingCardState(f.idea, [])).toMatchObject({ status: 'checking', spin: false });
  });

  it('keeps a genuine completed result visible until Apply or Discard', () => {
    const f = polishingCardFixture(); f.complete();
    expect(polishingCardState(f.idea, [f.job])).toMatchObject({ status: 'review', label: 'Polishing ready for review', spin: false });
    f.pass.review = 'applied'; expect(polishingCardState(f.idea, [f.job])).toBeNull();
    f.pass.review = 'rejected'; expect(polishingCardState(f.idea, [f.job])).toBeNull();
    f.pass.review = 'pending'; f.pass.workflow.artifacts = [];
    expect(polishingCardState(f.idea, [f.job])).toMatchObject({ status: 'attention', spin: false });
  });

  it('does not present a failed or stopped pass as active polishing', () => {
    const f = polishingCardFixture(); f.pass.workflow.state = 'attention';
    expect(polishingCardState(f.idea, [f.job])).toMatchObject({ status: 'attention', label: 'Polishing needs attention', spin: false });
    f.pass.workflow.state = 'stopped'; f.job.status = 'cancelled';
    expect(polishingCardState(f.idea, [f.job])).toMatchObject({ status: 'stopped', label: 'Polishing stopped', spin: false });
    f.pass.workflow.state = 'running'; f.job.status = 'failed';
    expect(polishingCardState(f.idea, [f.job])).toMatchObject({ status: 'attention', spin: false });
  });

  it('uses matching worker snapshots and keeps cancellation and lost contact honest', () => {
    const f = polishingCardFixture(); const ref = { version: 1 as const, workerId: 'worker', epoch: 1, executionId: 'execution', inputHash: 'a'.repeat(64) };
    const snapshot = { version: 1 as const, ref, phase: 'running' as const, sequence: 2, createdAt: f.job.startedAt, lastContactAt: f.job.startedAt, elapsedSeconds: 10, logs: [] };
    f.job.durable = { intent: 'start', ref, policy: { mode: 'background' }, snapshot };
    f.job.status = 'queued';
    expect(polishingCardState(f.idea, [f.job])).toMatchObject({ status: 'running' });
    f.job.status = 'running'; f.pass.workflow.state = 'stopped';
    expect(polishingCardState(f.idea, [f.job])).toMatchObject({ status: 'stopping', spin: false });
    f.pass.workflow.state = 'running';
    const runtime = { durableBuildSnapshots: { [f.job.id]: { ...snapshot, sequence: 3, phase: 'finalizing' as const } } };
    expect(polishingCardState(f.idea, [f.job], runtime)).toMatchObject({ status: 'finalizing' });
    expect(polishingCardState(f.idea, [f.job], { durableBuildSnapshots: { [f.job.id]: { ...snapshot, sequence: 1, phase: 'failed' } } })).toMatchObject({ status: 'running' });
    runtime.durableBuildSnapshots[f.job.id]!.ref = { ...ref, executionId: 'unrelated' };
    expect(polishingCardState(f.idea, [f.job], runtime)).toMatchObject({ status: 'running' });
    expect(polishingCardState(f.idea, [f.job], { durableBuildErrors: { [f.job.id]: 'Disconnected' } })).toMatchObject({ status: 'disconnected', spin: false });
    f.job.durable.intent = 'cancel';
    expect(polishingCardState(f.idea, [f.job])).toMatchObject({ status: 'stopping', spin: false });
    f.complete(); f.job.durable.intent = 'start'; f.job.durable.snapshot = { ...snapshot, phase: 'completed' };
    expect(polishingCardState(f.idea, [f.job])).toMatchObject({ status: 'finalizing' });
    f.job.durable.acknowledged = true;
    expect(polishingCardState(f.idea, [f.job])).toMatchObject({ status: 'review' });
  });

  it('does not attach historical attempts or another request’s worker activity to the current pass', () => {
    const f = polishingCardFixture();
    const historical = { ...f.job, id: 'earlier-job', status: 'failed' as const, workflow: { ...f.job.workflow!, attemptId: 'earlier-attempt' } };
    expect(polishingCardState(f.idea, [historical, f.job])).toMatchObject({ status: 'running' });
    expect(polishingCardState(f.idea, [{ ...f.job, ideaId: 'CF-999' }])).toMatchObject({ status: 'checking', spin: false });
    delete f.pass.workflow.activeAttemptId; f.pass.workflow.attempts = []; f.pass.workflow.state = 'ready';
    expect(polishingCardState(f.idea, [])).toMatchObject({ status: 'queued', spin: false });
    delete f.idea.polishingRuns;
    expect(polishingCardState(f.idea, [f.job])).toBeNull();
  });
});
