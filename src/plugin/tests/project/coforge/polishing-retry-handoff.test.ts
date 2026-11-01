import { expect, it, vi } from 'vitest';
import { polishingCodeFixture } from './polishing-code-fixture';
import { consent } from './background-build-retry-fixture';
import { increment } from './configured-workflow-fixture';

it('uses the operator resource for a reviewed background retry after failed BG Build and code polish, with no foreground fallback', async () => {
  const f = await polishingCodeFixture(true);
  try {
    f.worker.complete(f.job.id); await f.engine.reconcileDurableBuild(f.ideaId, f.job.workflow!.runId);
    const pass = f.current().polishingRuns![0]!; await f.engine.applyPolishingResult(f.ideaId, pass.id, pass.workflow.revision);
    const before = f.current().workflowRun!; const resource = before.polishingResources![0]!;
    await expect(f.engine.runWorkflowStep(f.ideaId)).rejects.toThrow('foreground fallback');
    const preview = await f.engine.previewBackgroundBuildRetry(f.ideaId);
    expect(preview.source).toMatchObject({ sourceKind: 'workspace', sourceWorkspaceId: 'wf-polished', sourceMaterializationId: resource.id });
    expect(preview.source.sourceJobId).toBeUndefined(); expect(preview.inspection.humanCessationRequired).toBe(true);
    await f.engine.confirmBackgroundBuildRetry(f.ideaId, preview.id, consent); await f.engine.waitUntilIdle();
    expect(f.current().workflowRun?.id).toBe(before.id); expect(f.current().workflowRun?.definition).toEqual(before.definition);
    expect(f.current().workflowRun?.attempts.slice(0, before.attempts.length)).toEqual(before.attempts);
    const request = f.worker.requests.at(-1)!; expect(request.input.workflow.workspaceId).toBeUndefined();
    expect(request.reviewedSnapshot).toEqual(preview.inspection.snapshot); expect(f.worker.providerLaunches).toHaveLength(3);
  } finally { await f.engine.stop(); }
});

it('supplies real lease candidates plus a pre-acquire failed request without pretending the latest request acquired the operator resource', async () => {
  const f = await polishingCodeFixture();
  try {
    f.worker.complete(f.job.id); await f.engine.reconcileDurableBuild(f.ideaId, f.job.workflow!.runId);
    const pass = f.current().polishingRuns![0]!; await f.engine.applyPolishingResult(f.ideaId, pass.id, pass.workflow.revision);
    f.runner.mockImplementationOnce(async input => { await input.onWorkspace?.('wf-polished'); await input.onChanges?.({ ...increment, simulated: false, diff: '+actual primary writer', branch: 'polished-primary', worktree: '/synthetic/polished-primary' }); throw new Error('Writer failed after capture'); });
    await f.engine.runWorkflowStep(f.ideaId); await f.engine.waitUntilIdle(); const writer = f.store.snapshot().jobs.at(-1)!;
    f.runner.mockRejectedValueOnce(new Error('Failed before workspace acquisition'));
    await f.engine.runWorkflowStep(f.ideaId); await f.engine.waitUntilIdle(); const unpaid = f.store.snapshot().jobs.at(-1)!;
    const inspect = vi.mocked(f.resources.inspect).getMockImplementation()!;
    vi.mocked(f.resources.inspect).mockImplementation(async source => ({ ...await inspect(source), sourceOwner: { kind: 'attempt', jobId: writer.id, attemptId: writer.workflow!.attemptId } }));
    const preview = await f.engine.previewBackgroundBuildRetry(f.ideaId);
    expect(preview.source.sourceMaterializationId).toBeUndefined();
    expect(preview.source.executorJobId).toBe(unpaid.id); expect(preview.source.sourceJobId).toBe(writer.id);
    expect(preview.source.executorCandidates?.map(candidate => candidate.jobId)).toEqual([writer.id, unpaid.id]);
    expect(preview.source.expectedIncrement?.diff).toBe('+actual primary writer'); expect(f.worker.providerLaunches).toHaveLength(1);
  } finally { await f.engine.stop(); }
});
