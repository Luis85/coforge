import { expect, it } from 'vitest';
import { increment } from './configured-workflow-fixture';
import { durableFixture } from './durable-build-fixture';

it.each([true, false])('only clears a prior pending diff for a qualified empty terminal capture (attested=%s)', async attested => {
  const f = await durableFixture();
  try {
    await f.engine.startWorkflow(f.id); await f.engine.waitUntilIdle(); const job = f.store.snapshot().jobs[0]!;
    const snapshot = f.worker.snapshots.get(job.id)!; snapshot.sequence++; snapshot.phase = 'attention'; snapshot.workspaceId = 'bg-retained'; snapshot.workspaceCaptured = true; snapshot.increment = { ...increment, simulated: false };
    await f.engine.reconcileDurableBuild(f.id);
    expect(f.store.snapshot().ideas[0]?.increment?.diff).toBe(increment.diff);
    f.worker.cancel.mockImplementationOnce(async () => { snapshot.sequence++; snapshot.phase = 'cancelled'; snapshot.workspaceCaptured = attested; delete snapshot.increment; return structuredClone(snapshot); });
    await f.engine.stopWorkflow(f.id);
    expect(f.store.snapshot().ideas[0]?.status).toBe('inbox');
    if (attested) {
      expect(f.store.snapshot().ideas[0]?.increment).toBeUndefined();
      expect(f.store.snapshot().ideas[0]?.workflowRun?.state).toBe('stopped');
      expect(f.store.snapshot().ideas[0]?.workflowRun?.artifacts.some(artifact => artifact.increment?.diff === increment.diff)).toBe(true);
    } else {
      expect(f.store.snapshot().ideas[0]?.increment?.diff).toBe(increment.diff);
      expect(f.store.snapshot().ideas[0]?.workflowRun?.state).toBe('awaiting-review');
    }
    expect(f.store.snapshot().workflowStopHolds).toContain(f.id); expect(f.worker.providerLaunches).toHaveLength(1);
  } finally { await f.engine.stop(); }
});
