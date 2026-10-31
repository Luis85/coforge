import { expect, it } from 'vitest';
import { createSeed } from '../../../features/coforge/domain/seed';
import { ai, definition } from './configured-workflow-fixture';
import { durableFixture } from './durable-build-fixture';

it('quarantines a worker rollback instead of starting the paid attempt again', async () => {
  const f = await durableFixture();
  try {
    await f.engine.startWorkflow(f.id); await f.engine.waitUntilIdle();
    const job = f.store.snapshot().jobs[0]!;
    const snapshot = f.worker.snapshots.get(job.id)!; snapshot.phase = 'prepared'; snapshot.sequence = 0;
    await expect(f.engine.reconcileDurableBuild(f.id)).rejects.toThrow('original background Build');
    expect(f.worker.start).toHaveBeenCalledTimes(1);
    expect(f.store.snapshot().jobs[0]?.status).toBe('running');
    expect(f.store.snapshot().jobs[0]?.durable?.snapshot?.phase).toBe('running');
    expect(f.worker.acknowledge).not.toHaveBeenCalled();
  } finally { await f.engine.stop(); }
});

it('holds the Build lane through lost acknowledgement while independent short work progresses', async () => {
  const f = await durableFixture();
  try {
    await f.engine.startWorkflow(f.id); await f.engine.waitUntilIdle();
    const first = f.store.snapshot().jobs[0]!; f.worker.complete(first.id);
    f.worker.acknowledge.mockRejectedValueOnce(new Error('Lost acknowledgement'));
    await expect(f.engine.reconcileDurableBuild(f.id)).rejects.toThrow('original background Build');
    expect(f.store.snapshot().jobs[0]?.status).toBe('succeeded');
    await f.engine.startWorkflow('CF-999'); await f.engine.waitUntilIdle();
    expect(f.worker.prepare).toHaveBeenCalledTimes(1);
    await f.store.transaction(state => {
      state.ideas.push({ ...createSeed().ideas.find(idea => idea.status === 'inbox')!, id: 'CF-998', number: 998, projectId: state.activeProjectId });
      state.settings.workflow = definition([ai('short')]);
    });
    await f.engine.startWorkflow('CF-998'); await f.engine.waitUntilIdle();
    expect(f.foreground).toHaveBeenCalledTimes(1);
    await f.engine.reconcileDurableBuild(f.id); await f.engine.waitUntilIdle();
    expect(f.worker.prepare).toHaveBeenCalledTimes(2);
    expect(f.store.snapshot().ideas[0]?.workflowRun?.cursor).toBe(1);
    expect(f.worker.acknowledge).toHaveBeenCalledTimes(2);
  } finally { await f.engine.stop(); }
});

it('retries a failed canonical completion write without ACK or duplicate artifacts/advancement', async () => {
  const f = await durableFixture();
  try {
    await f.engine.startWorkflow(f.id); await f.engine.waitUntilIdle();
    const job = f.store.snapshot().jobs[0]!; f.worker.complete(job.id); f.storage.failNextSave = true;
    await expect(f.engine.reconcileDurableBuild(f.id)).rejects.toThrow('original background Build');
    expect(f.worker.acknowledge).not.toHaveBeenCalled();
    expect(f.store.snapshot().ideas[0]?.workflowRun?.cursor).toBe(0);
    await f.engine.reconcileDurableBuild(f.id); await f.engine.reconcileDurableBuild(f.id);
    expect(f.store.snapshot().ideas[0]?.workflowRun?.cursor).toBe(1);
    expect(f.store.snapshot().ideas[0]?.workflowRun?.artifacts.filter(artifact => artifact.hostSnapshot)).toHaveLength(1);
    expect(f.worker.acknowledge).toHaveBeenCalledTimes(1); expect(f.worker.start).toHaveBeenCalledTimes(1);
  } finally { await f.engine.stop(); }
});

it('keeps unknown cancellation in Inbox with its lane reserved until termination is confirmed', async () => {
  const f = await durableFixture();
  try {
    await f.engine.startWorkflow(f.id); await f.engine.waitUntilIdle();
    const job = f.store.snapshot().jobs[0]!;
    f.worker.cancel.mockImplementationOnce(async () => ({ ...f.worker.snapshots.get(job.id)!, sequence: 2, phase: 'attention', cancellationRequested: true, error: 'Inspect the original process.' }));
    await f.engine.stopWorkflow(f.id);
    expect(f.store.snapshot().ideas[0]?.status).toBe('inbox');
    expect(f.store.snapshot().jobs[0]?.status).toBe('running');
    expect(f.worker.acknowledge).not.toHaveBeenCalled();
    await expect(f.engine.restartWorkflowFromOperator(f.id)).rejects.toThrow('active attempt');
    await f.engine.startWorkflow('CF-999'); await f.engine.waitUntilIdle();
    expect(f.worker.prepare).toHaveBeenCalledTimes(1);
    const snapshot = f.worker.snapshots.get(job.id)!; snapshot.sequence = 2;
    await f.engine.reconcileDurableBuild(f.id); await f.engine.waitUntilIdle();
    expect(f.store.snapshot().jobs[0]?.status).toBe('cancelled');
    expect(f.store.snapshot().workflowStopHolds).toContain(f.id);
    expect(f.worker.prepare).toHaveBeenCalledTimes(2);
  } finally { await f.engine.stop(); }
});

it('captures explicit Build-only overrides separately and accepts a verified empty final workspace', async () => {
  const f = await durableFixture();
  try {
    await f.store.transaction(state => { state.integration.ideasFolder = 'Private tasks'; state.integration.publicFolder = 'Viewer website'; state.settings.workflow!.limits.maxTurns = 7; state.settings.workflow!.limits.maxBudgetUsd = 1.5; const step = state.settings.workflow!.steps[0]!; if (step.kind === 'ai') step.execution = { mode: 'background', maxTurns: 9999, maxBudgetUsd: 321, idleWarningSeconds: 0 }; });
    const original = f.store.snapshot().settings.workflow!.limits;
    await f.engine.startWorkflow(f.id); await f.engine.waitUntilIdle();
    expect(f.worker.requests[0]?.policy).toMatchObject({ maxTurns: 9999, maxBudgetUsd: 321, idleWarningSeconds: 0 });
    expect(f.worker.requests[0]?.input.settings.maxTurns).toBe(original.maxTurns);
    expect(f.worker.requests[0]?.input.settings.maxBudgetUsd).toBe(original.maxBudgetUsd);
    expect(f.worker.requests[0]?.input.settings).toMatchObject({ maxTurns: 7, maxBudgetUsd: 1.5 });
    expect(f.worker.requests[0]?.input.integration).toMatchObject({ ideasFolder: 'Private tasks', publicFolder: 'Viewer website' });
    expect(f.worker.requests[0]?.input.integration).not.toHaveProperty('twitchTokenSecret');
    expect(f.worker.requests[0]?.input.idea).not.toHaveProperty('workflowRun');
    expect(f.worker.requests[0]?.input).not.toHaveProperty('signal');
    const job = f.store.snapshot().jobs[0]!; const snapshot = f.worker.snapshots.get(job.id)!;
    snapshot.phase = 'completed'; snapshot.sequence++; snapshot.workspaceId = 'bg-empty'; snapshot.workspaceCaptured = true; snapshot.result = { summary: 'Verified no code changes needed.' };
    await f.engine.reconcileDurableBuild(f.id);
    expect(f.store.snapshot().jobs[0]?.status).toBe('succeeded');
    expect(f.store.snapshot().ideas[0]?.workflowRun?.state).toBe('finished');
    expect(f.store.snapshot().ideas[0]?.status).not.toBe('shipped');
    expect(f.store.snapshot().settings.workflow!.limits).toEqual(original);
  } finally { await f.engine.stop(); }
});
