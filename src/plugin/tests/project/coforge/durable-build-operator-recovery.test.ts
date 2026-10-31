import { expect, it } from 'vitest';
import { durableFixture } from './durable-build-fixture';

it('requires actual retained evidence and current explicit consent before qualified recovery; never dispatches a provider', async () => {
  const f = await durableFixture();
  try {
    await f.engine.startWorkflow(f.id); await f.engine.waitUntilIdle();
    const job = f.store.snapshot().jobs[0]!; const revision = f.store.snapshot().ideas[0]!.workflowRun!.revision;
    await expect(f.engine.recoverDurableBuild(f.id, revision, false)).rejects.toThrow('inspection');
    await expect(f.engine.recoverDurableBuild(f.id, revision, true)).rejects.toThrow('Inspect retained');
    expect(f.worker.recover).not.toHaveBeenCalled(); expect(f.store.snapshot().workflowStopHolds ?? []).not.toContain(f.id);
    const writes = f.storage.saves;
    await f.engine.inspectDurableBuildEvidence(f.id, revision);
    expect(f.storage.saves).toBe(writes);
    expect(f.store.snapshot().runtime.durableBuildInspections?.[job.id]).toMatchObject({ runRevision: revision, evidenceHash: 'b'.repeat(64) });
    await f.engine.recoverDurableBuild(f.id, revision, true);
    expect(f.store.snapshot().workflowStopHolds).toContain(f.id); expect(f.store.snapshot().ideas[0]?.status).toBe('inbox');
    expect(f.store.snapshot().jobs[0]?.status).toBe('cancelled');
    expect(f.worker.recover).toHaveBeenCalledWith(job.durable!.ref, true, 1, 'b'.repeat(64));
    expect(f.worker.start).toHaveBeenCalledTimes(1); expect(f.foreground).not.toHaveBeenCalled();
    await expect(f.engine.startWorkflow(f.id)).rejects.toThrow('Restart workflow');
  } finally { await f.engine.stop(); }
});

it('keeps unknown proof in attention/Inbox with the lane held and requires fresh inspection after a failed recovery', async () => {
  const f = await durableFixture();
  try {
    await f.engine.startWorkflow(f.id); await f.engine.waitUntilIdle();
    const job = f.store.snapshot().jobs[0]!; const revision = f.store.snapshot().ideas[0]!.workflowRun!.revision;
    await f.engine.inspectDurableBuildEvidence(f.id, revision);
    f.worker.recover.mockImplementationOnce(async () => ({ ...f.worker.snapshots.get(job.id)!, sequence: 2, phase: 'attention', error: 'Process identity remains unknown.' }));
    await expect(f.engine.recoverDurableBuild(f.id, revision, true)).rejects.toThrow('unknown');
    expect(f.store.snapshot().ideas[0]?.status).toBe('inbox'); expect(f.store.snapshot().jobs[0]?.status).toBe('running');
    expect(f.worker.acknowledge).not.toHaveBeenCalled();
    await expect(f.engine.restartWorkflowFromOperator(f.id)).rejects.toThrow('active attempt');
    await expect(f.engine.recoverDurableBuild(f.id, f.store.snapshot().ideas[0]!.workflowRun!.revision, true)).rejects.toThrow('Inspect retained');
    expect(f.worker.start).toHaveBeenCalledTimes(1);
  } finally { await f.engine.stop(); }
});

it('recovers a lost completion acknowledgement without changing its original terminal result or advancing again', async () => {
  const f = await durableFixture();
  try {
    await f.engine.startWorkflow(f.id); await f.engine.waitUntilIdle();
    const job = f.store.snapshot().jobs[0]!; f.worker.complete(job.id);
    f.worker.acknowledge.mockRejectedValueOnce(new Error('Worker disconnected after canonical completion'));
    await expect(f.engine.reconcileDurableBuild(f.id)).rejects.toThrow('could not be contacted');
    const completed = f.store.snapshot().jobs[0]!.durable!;
    const revision = f.store.snapshot().ideas[0]!.workflowRun!.revision;
    await f.engine.inspectDurableBuildEvidence(f.id, revision); await f.engine.recoverDurableBuild(f.id, revision, true);
    expect(f.store.snapshot().jobs[0]?.status).toBe('succeeded');
    expect(f.store.snapshot().jobs[0]?.durable?.appliedSequence).toBe(completed.appliedSequence);
    expect(f.store.snapshot().jobs[0]?.durable?.snapshot?.result).toEqual(completed.snapshot?.result);
    expect(f.store.snapshot().ideas[0]?.workflowRun?.cursor).toBe(1);
    expect(f.store.snapshot().workflowStopHolds).toContain(f.id); expect(f.store.snapshot().ideas[0]?.status).toBe('inbox');
    expect(f.worker.providerLaunches).toHaveLength(1); expect(f.worker.acknowledge).toHaveBeenCalledTimes(2);
  } finally { await f.engine.stop(); }
});
