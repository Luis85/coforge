import { expect, it, vi } from 'vitest';
import { PolishingCopyRetainedError } from '../../../features/coforge/application/polishing-ports';
import { polishingCodeFixture } from './polishing-code-fixture';
import { standalonePolishingFixture } from './polishing-standalone-fixture';
import { consent, retryFixture } from './background-build-retry-fixture';

it.each([true, false])('renews an operator copy only after a typed settled failure (known idle=%s)', async retained => {
  const f = await polishingCodeFixture();
  try {
    f.worker.complete(f.job.id); await f.engine.reconcileDurableBuild(f.ideaId, f.job.workflow!.runId);
    const pass = f.current().polishingRuns![0]!;
    vi.mocked(f.code.materialize).mockRejectedValueOnce(retained ? new PolishingCopyRetainedError() : new Error('The original reply was lost.'));
    await expect(f.engine.applyPolishingResult(f.ideaId, pass.id, pass.workflow.revision)).rejects.toThrow();
    const first = f.current().polishingRuns![0]!.applyIntent!;
    expect(f.current().polishingRuns![0]?.applyFailure?.code).toBe(retained ? 'POLISHING_COPY_RETAINED' : undefined);
    if (!retained) await expect(f.engine.rejectPolishingResult(f.ideaId, pass.id, pass.workflow.revision)).rejects.toThrow('original Apply receipt');
    await f.engine.applyPolishingResult(f.ideaId, pass.id, pass.workflow.revision);
    const after = f.current().polishingRuns![0]!; const ids = vi.mocked(f.code.materialize).mock.calls.map(call => call[0].id);
    if (retained) { expect(ids[1]).not.toBe(ids[0]); expect(after.applyIntentHistory).toEqual([first]); }
    else { expect(ids).toEqual([first.id, first.id]); expect(after.applyIntentHistory).toBeUndefined(); }
    expect(after.review).toBe('applied'); expect(f.worker.providerLaunches).toHaveLength(1);
  } finally { await f.engine.stop(); }
});

it('preserves the existing logical code owner across repeated polishing of a shipped result with no primary run', async () => {
  const f = await standalonePolishingFixture(true);
  try {
    let owner: string | undefined;
    for (const feedback of ['Polish the accepted current code.', 'Polish the reviewed version again.']) {
      const preview = await f.engine.previewPolishingPass(f.ideaId, feedback);
      await f.engine.confirmPolishingPass(f.ideaId, preview.id, consent); await f.engine.waitUntilIdle();
      const job = f.store.snapshot().jobs.at(-1)!; f.worker.complete(job.id); await f.engine.reconcileDurableBuild(f.ideaId, job.workflow!.runId);
      const pass = f.current().polishingRuns!.at(-1)!; owner ??= pass.id;
      await f.engine.applyPolishingResult(f.ideaId, pass.id, pass.workflow.revision);
      expect(f.current().status).toBe('shipped'); expect(f.current().workflowRun).toBeUndefined();
      expect(vi.mocked(f.copies.materialize).mock.calls.at(-1)?.[0].target.runId).toBe(owner);
    }
    expect(f.current().polishingRuns).toHaveLength(2); expect(f.worker.providerLaunches).toHaveLength(2);
  } finally { await f.engine.stop(); }
});

it('requires restoration of missing managed primary metadata rather than treating it as a legacy Inbox', async () => {
  const f = await retryFixture(false);
  try {
    await f.store.transaction(state => {
      state.settings.workflow!.improvementPass = { provider: 'demo', model: 'sonnet', instructions: 'Polish.', limits: { timeoutSeconds: 60, maxTurns: 3, maxBudgetUsd: 0.5 } };
      delete state.ideas.find(idea => idea.id === f.ideaId)!.workflowRun;
    });
    await expect(f.engine.previewPolishingPass(f.ideaId, 'Improve this result.')).rejects.toThrow('Restore the original managed workflow');
    expect(f.worker.prepare).not.toHaveBeenCalled();
  } finally { await f.engine.stop(); }
});

it('keeps a pending standalone result behind review gates even when workflow settings are removed', async () => {
  const f = await standalonePolishingFixture();
  try {
    const preview = await f.engine.previewPolishingPass(f.ideaId, 'Make the request clear.');
    await f.engine.confirmPolishingPass(f.ideaId, preview.id, consent); await f.engine.waitUntilIdle();
    await f.store.transaction(state => { delete state.settings.workflow; state.ideas = state.ideas.filter(idea => idea.id === f.ideaId); });
    const count = f.store.snapshot().jobs.length;
    await expect(f.engine.submit(f.ideaId, 'screen')).rejects.toThrow('polish');
    expect(await f.engine.tick(true)).toBeNull(); expect(f.store.snapshot().jobs).toHaveLength(count);
  } finally { await f.engine.stop(); }
});

it.each([false, true])('retains a completed copy receipt across Stop during Apply, then lets explicit held review reconcile it (already held=%s)', async alreadyHeld => {
  const f = await polishingCodeFixture();
  try {
    f.worker.complete(f.job.id); await f.engine.reconcileDurableBuild(f.ideaId, f.job.workflow!.runId);
    const inspected = vi.mocked(f.resources.inspect).getMockImplementation()!;
    vi.mocked(f.resources.inspect).mockImplementation(async source => ({ ...await inspected(source), evidenceHash: source.runRevision.toString(16).padStart(64, '0') }));
    const materialize = vi.mocked(f.code.materialize).getMockImplementation()!;
    let release!: () => Promise<void>;
    vi.mocked(f.code.materialize).mockImplementationOnce(request => new Promise(resolve => { release = async () => resolve(await materialize(request)); }));
    if (alreadyHeld) await f.engine.stopWorkflow(f.ideaId);
    const pass = f.current().polishingRuns![0]!;
    const applying = f.engine.applyPolishingResult(f.ideaId, pass.id, pass.workflow.revision); const rejected = expect(applying).rejects.toThrow();
    await vi.waitFor(() => expect(f.code.materialize).toHaveBeenCalledTimes(1));
    await f.engine.stopWorkflow(f.ideaId); await release(); await rejected;
    const stopped = f.current().polishingRuns![0]!; const intent = stopped.applyIntent!;
    expect(stopped.workflow.revision).toBe(pass.workflow.revision); expect(stopped.stopVersion).toBe((pass.stopVersion ?? 0) + 1);
    expect(stopped.review).toBe('pending'); expect(f.current().workflowRun?.workspaceId).not.toBe('wf-polished');
    await f.engine.applyPolishingResult(f.ideaId, stopped.id, stopped.workflow.revision);
    expect(vi.mocked(f.code.materialize).mock.calls.map(call => call[0].id)).toEqual([intent.id, intent.id]);
    expect(f.current().polishingRuns![0]?.review).toBe('applied'); expect(f.store.snapshot().workflowStopHolds).toContain(f.ideaId);
    expect(f.worker.providerLaunches).toHaveLength(1);
  } finally { await f.engine.stop(); }
});
