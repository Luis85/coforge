import { expect, it } from 'vitest';
import { durableFixture } from './durable-build-fixture';

it('can revoke the original worker after request metadata disappears, retaining private evidence without manufacturing success', async () => {
  const f = await durableFixture();
  try {
    await f.engine.startWorkflow(f.id); await f.engine.waitUntilIdle();
    const job = f.store.snapshot().jobs[0]!;
    await f.store.transaction(state => { delete state.ideas[0]!.workflowRun; });
    await f.engine.cancel(job.id);
    expect(f.worker.cancel).toHaveBeenCalledTimes(1); expect(f.worker.acknowledge).toHaveBeenCalledTimes(1);
    expect(f.store.snapshot().jobs[0]?.status).toBe('cancelled');
    expect(f.store.snapshot().jobs[0]?.durable?.snapshot?.phase).toBe('cancelled');
    expect(f.store.snapshot().workflowStopHolds).toContain(f.id); expect(f.store.snapshot().ideas[0]?.status).toBe('inbox');
    expect(f.store.snapshot().ideas[0]?.workflowRun).toBeUndefined(); expect(f.worker.providerLaunches).toHaveLength(1);
    await expect(f.engine.restartWorkflowFromOperator(f.id)).rejects.toThrow('Restore the original managed workflow');
    expect(f.store.snapshot().workflowStopHolds).toContain(f.id); expect(f.store.snapshot().ideas[0]?.workflowRun).toBeUndefined();
  } finally { await f.engine.stop(); }
});
