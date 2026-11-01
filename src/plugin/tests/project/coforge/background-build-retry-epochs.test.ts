import { expect, it } from 'vitest';
import { workflowRunCheck } from '../../../features/coforge/domain/configured-workflow-run';
import { increment } from './configured-workflow-fixture';
import { consent, retryFixture } from './background-build-retry-fixture';

it('binds follow-up inputs to the current cumulative workspace rather than late evidence from an older epoch', async () => {
  const f = await retryFixture(true, false, true);
  try {
    const oldInput = f.runner.mock.calls[1]![0];
    const preview = await f.engine.previewBackgroundBuildRetry(f.ideaId); await f.engine.confirmBackgroundBuildRetry(f.ideaId, preview.id, consent); await f.engine.waitUntilIdle();
    const job = f.store.snapshot().jobs.at(-1)!; f.worker.complete(job.id);
    const snapshot = f.worker.snapshots.get(job.id)!;
    snapshot.increment!.diff = '+actual cumulative completed Build'; snapshot.result!.increment = structuredClone(snapshot.increment);
    await f.engine.reconcileDurableBuild(f.ideaId);
    await oldInput.onChanges?.({ ...increment, diff: '+older workspace only', simulated: false });
    await f.engine.runWorkflowStep(f.ideaId); await f.engine.waitUntilIdle();
    const followup = f.runner.mock.calls.at(-1)![0];
    expect(followup.workflow?.step.id).toBe('followup');
    expect(followup.workflow?.inputArtifacts.find(artifact => artifact.output === 'codechange')?.increment?.diff).toBe('+actual cumulative completed Build');
  } finally { await f.engine.stop(); }
});

it('never treats the retained original pointer as proof that a new retry owns a captured workspace', async () => {
  const f = await retryFixture();
  try {
    const before = f.current().workflowRun!;
    const preview = await f.engine.previewBackgroundBuildRetry(f.ideaId); await f.engine.confirmBackgroundBuildRetry(f.ideaId, preview.id, consent); await f.engine.waitUntilIdle();
    const job = f.store.snapshot().jobs.at(-1)!; const snapshot = f.worker.snapshots.get(job.id)!;
    snapshot.phase = 'completed'; snapshot.sequence++; snapshot.workspaceCaptured = true; snapshot.increment = { ...increment, simulated: false }; snapshot.result = { summary: 'Unbound capture', increment: snapshot.increment };
    await expect(f.engine.reconcileDurableBuild(f.ideaId)).rejects.toThrow();
    expect(f.current().workflowRun?.cursor).toBe(1); expect(f.current().workflowRun?.workspaceId).toBe(before.workspaceId);
    expect(f.current().workflowRun?.artifacts).toEqual(before.artifacts); expect(f.worker.acknowledge).not.toHaveBeenCalled();
  } finally { await f.engine.stop(); }
});

it('keeps reviewed original files reachable when unpaid worker preparation fails before binding the new workspace', async () => {
  const f = await retryFixture();
  try {
    const original = f.current().workflowRun!;
    const preview = await f.engine.previewBackgroundBuildRetry(f.ideaId);
    f.worker.prepare.mockRejectedValueOnce(new Error('Reviewed seed import unavailable.'));
    await f.engine.confirmBackgroundBuildRetry(f.ideaId, preview.id, consent); await f.engine.waitUntilIdle();
    expect(f.current().workflowRun?.state).toBe('attention'); expect(f.worker.providerLaunches).toHaveLength(0);
    const again = await f.engine.previewBackgroundBuildRetry(f.ideaId);
    expect(again.source).toMatchObject({ sourceKind: 'workspace', sourceWorkspaceId: original.workspaceId });
    await f.engine.confirmBackgroundBuildRetry(f.ideaId, again.id, consent); await f.engine.waitUntilIdle();
    expect(f.worker.requests[0]?.input.workflow.workspaceId).toBeUndefined(); expect(f.worker.providerLaunches).toHaveLength(1);
  } finally { await f.engine.stop(); }
});

it('retains late original capture under its original workspace without replacing the new cumulative diff', async () => {
  const f = await retryFixture();
  try {
    const oldInput = f.runner.mock.calls[1]![0]; const oldJob = f.store.snapshot().jobs.at(-1)!;
    const preview = await f.engine.previewBackgroundBuildRetry(f.ideaId); await f.engine.confirmBackgroundBuildRetry(f.ideaId, preview.id, consent); await f.engine.waitUntilIdle();
    const currentJob = f.store.snapshot().jobs.at(-1)!; const snapshot = f.worker.snapshots.get(currentJob.id)!;
    snapshot.phase = 'finalizing'; snapshot.sequence++; snapshot.workspaceId = 'bg-new'; snapshot.workspaceCaptured = true;
    snapshot.increment = { ...increment, diff: '+reviewed partial\n+continued', simulated: false };
    await f.engine.reconcileDurableBuild(f.ideaId);
    const beforeLate = f.current().increment;
    await oldInput.onChanges?.({ ...increment, diff: '+late original capture', simulated: false });
    expect(f.current().workflowRun?.workspaceId).toBe('bg-new'); expect(f.current().increment).toEqual(beforeLate);
    expect(f.current().workflowRun?.artifacts.some(artifact => artifact.attemptId === oldJob.workflow!.attemptId && artifact.increment?.diff === '+late original capture')).toBe(true);
    expect(f.store.snapshot().jobs.find(job => job.id === oldJob.id)).toEqual(oldJob);
    await expect(oldInput.onWorkspace?.('different-old-workspace')).rejects.toThrow('changed');
    expect(workflowRunCheck(f.current().workflowRun).backgroundRetries).toHaveLength(1);
  } finally { await f.engine.stop(); }
});

it('does not silently return to foreground after a failed approved background attempt', async () => {
  const f = await retryFixture();
  try {
    const preview = await f.engine.previewBackgroundBuildRetry(f.ideaId); await f.engine.confirmBackgroundBuildRetry(f.ideaId, preview.id, consent); await f.engine.waitUntilIdle();
    const job = f.store.snapshot().jobs.at(-1)!; const snapshot = f.worker.snapshots.get(job.id)!;
    snapshot.phase = 'failed'; snapshot.sequence++; snapshot.workspaceId = 'bg-new'; snapshot.workspaceCaptured = true; snapshot.increment = { ...increment, simulated: false };
    await f.engine.reconcileDurableBuild(f.ideaId); const retained = f.current(); const jobs = f.store.snapshot().jobs;
    await expect(f.engine.runWorkflowStep(f.ideaId)).rejects.toThrow('foreground fallback is disabled');
    expect(f.current()).toEqual(retained); expect(f.store.snapshot().jobs).toEqual(jobs); expect(f.runner).toHaveBeenCalledTimes(2);
    const again = await f.engine.previewBackgroundBuildRetry(f.ideaId);
    expect(again.source.sourceWorkspaceId).toBe('bg-new');
    await f.engine.confirmBackgroundBuildRetry(f.ideaId, again.id, consent); await f.engine.waitUntilIdle();
    expect(f.current().workflowRun?.backgroundRetries).toHaveLength(2); expect(f.worker.providerLaunches).toHaveLength(2);
    expect(workflowRunCheck(f.current().workflowRun).attempts).toHaveLength(4);
  } finally { await f.engine.stop(); }
});
