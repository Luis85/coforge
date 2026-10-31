import { expect, it } from 'vitest';
import { durableFixture } from './durable-build-fixture';

it('keeps1000 same-phase observations fresh without rewriting canonical storage per heartbeat', async () => {
  const f = await durableFixture();
  try {
    await f.engine.startWorkflow(f.id); await f.engine.waitUntilIdle();
    const job = f.store.snapshot().jobs[0]!; const saves = f.storage.saves;
    const snapshot = f.worker.snapshots.get(job.id)!;
    for (let index = 1; index <= 1000; index++) {
      snapshot.sequence++; snapshot.elapsedSeconds = index; snapshot.lastContactAt = new Date(Date.UTC(2026, 9, 31, 12, 0, index)).toISOString(); snapshot.logs = [`Observation ${index}`];
      await f.engine.reconcileDurableBuild(f.id);
    }
    expect(f.storage.saves).toBe(saves);
    expect(f.store.snapshot().runtime.durableBuildSnapshots?.[job.id]).toMatchObject({ elapsedSeconds: 1000, logs: ['Observation 1000'] });
    expect(f.store.snapshot().jobs[0]?.durable?.snapshot?.elapsedSeconds).toBe(0);
    expect(f.worker.start).toHaveBeenCalledTimes(1);
  } finally { await f.engine.stop(); }
});

it('keeps repeated disconnect errors transient and clears them after a verified same-sequence response', async () => {
  const f = await durableFixture();
  try {
    await f.engine.startWorkflow(f.id); await f.engine.waitUntilIdle();
    const job = f.store.snapshot().jobs[0]!; const saves = f.storage.saves;
    f.worker.inspect.mockRejectedValueOnce(new Error('Disconnected'));
    await expect(f.engine.reconcileDurableBuild(f.id)).rejects.toThrow('original background Build');
    expect(f.store.snapshot().runtime.durableBuildErrors?.[job.id]).toContain('could not be contacted');
    expect(f.storage.saves).toBe(saves);
    await f.engine.reconcileDurableBuild(f.id);
    expect(f.store.snapshot().runtime.durableBuildErrors?.[job.id]).toBeUndefined(); expect(f.storage.saves).toBe(saves);
  } finally { await f.engine.stop(); }
});
