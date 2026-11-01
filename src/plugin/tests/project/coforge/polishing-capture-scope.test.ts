import { expect, it, vi } from 'vitest';
import { standalonePolishingFixture } from './polishing-standalone-fixture';
import { retryFixture, consent } from './background-build-retry-fixture';

it('rejects a standalone preview after its project model context changes without silently adopting live instructions', async () => {
  const f = await standalonePolishingFixture();
  try {
    const preview = await f.engine.previewPolishingPass(f.ideaId, 'Make the request clearer.');
    await f.store.transaction(state => { state.settings.agentPrompt = 'Different live project instructions'; });
    await expect(f.engine.confirmPolishingPass(f.ideaId, preview.id, consent)).rejects.toThrow('stale');
    expect(f.runner).not.toHaveBeenCalled(); expect(f.current().polishingRuns).toBeUndefined();
  } finally { await f.engine.stop(); }
});

it('records the actual private source owner while keeping a later pre-acquire failed Build as separate executor provenance', async () => {
  const f = await retryFixture(false, true);
  try {
    const owner = f.current().workflowRun!.attempts[0]!;
    f.runner.mockRejectedValueOnce(new Error('Build failed before workspace acquisition'));
    await f.engine.runWorkflowStep(f.ideaId); await f.engine.waitUntilIdle();
    const failed = f.current().workflowRun!.attempts.at(-1)!;
    const inspect = vi.mocked(f.resources.inspect).getMockImplementation()!;
    vi.mocked(f.resources.inspect).mockImplementation(async source => ({ ...await inspect(source), sourceOwner: { kind: 'attempt', jobId: owner.jobId!, attemptId: owner.id } }));
    const preview = await f.engine.previewBackgroundBuildRetry(f.ideaId);
    expect(preview.source).toMatchObject({ sourceJobId: owner.jobId, sourceAttemptId: owner.id, executorJobId: failed.jobId, executorAttemptId: failed.id });
    expect(preview.previousAttemptId).toBe(failed.id);
    await f.engine.confirmBackgroundBuildRetry(f.ideaId, preview.id, consent); await f.engine.waitUntilIdle();
    expect(f.current().workflowRun?.backgroundRetries?.[0]).toMatchObject({ sourceJobId: owner.jobId, sourceAttemptId: owner.id, previousJobId: failed.jobId, previousAttemptId: failed.id });
    expect(vi.mocked(f.resources.verify).mock.calls[0]?.[0].sourceJobId).toBe(owner.jobId);
  } finally { await f.engine.stop(); }
});
