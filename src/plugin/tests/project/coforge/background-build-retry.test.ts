import { expect, it } from 'vitest';
import { consent, retryFixture } from './background-build-retry-fixture';

it('previews actual partial work without admission, then appends one background attempt while preserving completed prefix and old entries', async () => {
  const f = await retryFixture();
  try {
    const before = f.current().workflowRun!; const jobs = f.store.snapshot().jobs;
    const preview = await f.engine.previewBackgroundBuildRetry(f.ideaId);
    expect(preview).toMatchObject({ runId: before.id, runRevision: before.revision, inheritedLimits: { maxTurns: 7, maxBudgetUsd: 1.5 }, effectiveLimits: { maxTurns: 7, maxBudgetUsd: 1.5 }, policy: { mode: 'background', idleWarningSeconds: 1800 }, source: { sourceKind: 'workspace', sourceWorkspaceId: 'fg-original' } });
    expect(f.worker.prepare).not.toHaveBeenCalled(); expect(f.current().workflowRun).toEqual(before);
    await f.engine.confirmBackgroundBuildRetry(f.ideaId, preview.id, consent); await f.engine.waitUntilIdle();
    const after = f.current().workflowRun!;
    expect(after.id).toBe(before.id); expect(after.cursor).toBe(1); expect(after.definition).toEqual(before.definition);
    expect(after.attempts.slice(0, before.attempts.length)).toEqual(before.attempts); expect(after.artifacts).toEqual(before.artifacts);
    expect(f.store.snapshot().jobs.filter(job => jobs.some(old => old.id === job.id))).toEqual(jobs);
    expect(after.backgroundRetries).toHaveLength(1); expect(after.attempts).toHaveLength(before.attempts.length + 1);
    expect(f.worker.requests).toHaveLength(1); const request = f.worker.requests[0]!;
    expect(request.input.workflow.step.execution).toEqual(preview.policy); expect(request.input.workflow.workspaceId).toBeUndefined();
    expect(request.reviewedSnapshot).toEqual(preview.inspection.snapshot); expect(request.input.settings).toMatchObject({ maxTurns: 7, maxBudgetUsd: 1.5 });
    expect(request.input.workflow.backgroundRetryId).toBe(after.backgroundRetries![0]!.id);
    expect(f.runner).toHaveBeenCalledTimes(2); expect(f.worker.providerLaunches).toHaveLength(1);
  } finally { await f.engine.stop(); }
});

it('supports an explicit clean-repository preview at a ready Build cursor without requiring a foreground attempt', async () => {
  const f = await retryFixture(false);
  try {
    const preview = await f.engine.previewBackgroundBuildRetry(f.ideaId);
    expect(preview.source).toMatchObject({ sourceKind: 'repository' }); expect(preview.source.sourceAttemptId).toBeUndefined();
    expect(preview.inspection.humanCessationRequired).toBe(false);
    await f.engine.confirmBackgroundBuildRetry(f.ideaId, preview.id, { ...consent, oldExecutorStopped: false }); await f.engine.waitUntilIdle();
    expect(f.worker.providerLaunches).toHaveLength(1); expect(f.runner).toHaveBeenCalledTimes(1);
  } finally { await f.engine.stop(); }
});

it('attributes completed earlier edits to their actual workspace owner when the current Build has not yet attempted', async () => {
  const f = await retryFixture(false, true);
  try {
    const before = f.current().workflowRun!; const previous = before.attempts[0]!;
    const preview = await f.engine.previewBackgroundBuildRetry(f.ideaId);
    expect(preview.source).toMatchObject({ sourceKind: 'workspace', sourceWorkspaceId: 'fg-original', sourceJobId: previous.jobId, sourceAttemptId: previous.id });
    expect(preview.previousAttemptId).toBeUndefined(); expect(preview.inspection.increment?.files).toHaveLength(1);
    await f.engine.confirmBackgroundBuildRetry(f.ideaId, preview.id, consent); await f.engine.waitUntilIdle();
    expect(f.current().workflowRun?.attempts[0]).toEqual(previous); expect(f.worker.requests[0]?.reviewedSnapshot).toEqual(preview.inspection.snapshot);
  } finally { await f.engine.stop(); }
});

it('inspects a verified repository source after a Build failed before acquiring any workspace', async () => {
  const f = await retryFixture(false);
  try {
    await f.engine.runWorkflowStep(f.ideaId); await f.engine.waitUntilIdle();
    const failed = f.current().workflowRun!.attempts.at(-1)!;
    const preview = await f.engine.previewBackgroundBuildRetry(f.ideaId);
    expect(preview.source).toMatchObject({ sourceKind: 'repository', executorAttemptId: failed.id, executorJobId: failed.jobId });
    expect(preview.inspection.increment).toBeNull(); expect(preview.inspection.humanCessationRequired).toBe(true);
    await expect(f.engine.confirmBackgroundBuildRetry(f.ideaId, preview.id, { ...consent, oldExecutorStopped: false })).rejects.toThrow('old executor');
    await f.engine.confirmBackgroundBuildRetry(f.ideaId, preview.id, consent); await f.engine.waitUntilIdle();
    expect(f.worker.providerLaunches).toHaveLength(1);
  } finally { await f.engine.stop(); }
});
