import { expect, it } from 'vitest';
import { DurableBuildCapacityError } from '../../../features/coforge/application/durable-build-ports';
import { durableFixture } from './durable-build-fixture';

it('cancels an unpaid prepared reservation after failed admission and persists the cancellation before ACK', async () => {
  const f = await durableFixture();
  const prepare = f.worker.prepare.getMockImplementation()!;
  f.worker.prepare.mockImplementationOnce(async request => { const ref = await prepare(request); f.storage.failNextSave = true; return ref; });
  f.worker.acknowledge.mockImplementation(async () => { expect(f.store.snapshot().jobs[0]?.durable?.intent).toBe('cancel'); expect(f.store.snapshot().jobs[0]?.status).toBe('cancelled'); });
  try {
    await f.engine.startWorkflow(f.id); await f.engine.waitUntilIdle();
    expect(f.worker.start).not.toHaveBeenCalled(); expect(f.foreground).not.toHaveBeenCalled();
    expect(f.worker.cancel).toHaveBeenCalledTimes(1); expect(f.worker.acknowledge).toHaveBeenCalledTimes(1);
    expect(f.store.snapshot().jobs[0]?.durable).toMatchObject({ intent: 'cancel', acknowledged: true });
  } finally { await f.engine.stop(); }
});

it('retains a capacity-blocked job in FIFO queue without immediately retrying or using a foreground fallback', async () => {
  const f = await durableFixture(); f.worker.prepare.mockRejectedValueOnce(new DurableBuildCapacityError());
  try {
    await f.engine.startWorkflow(f.id); await f.engine.waitUntilIdle();
    expect(f.store.snapshot().jobs[0]?.status).toBe('queued'); expect(f.worker.prepare).toHaveBeenCalledTimes(1);
    expect(f.worker.start).not.toHaveBeenCalled(); expect(f.foreground).not.toHaveBeenCalled();
    await f.engine.configureConcurrency(); await f.engine.waitUntilIdle();
    expect(f.worker.prepare).toHaveBeenCalledTimes(2); expect(f.worker.start).toHaveBeenCalledTimes(1);
    await f.engine.cancel(f.store.snapshot().jobs[0]!.id);
    expect(f.store.snapshot().workflowStopHolds).toContain(f.id); expect(f.store.snapshot().ideas[0]?.status).toBe('inbox');
  } finally { await f.engine.stop(); }
});
