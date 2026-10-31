import { expect, it, vi } from 'vitest';
import { WorkflowEngine } from '../../../features/coforge/application/engine';
import { durableFixture } from './durable-build-fixture';

it('honors a Stop committed while original prepared inspection was pending and never dispatches that paid start', async () => {
  const f = await durableFixture(); let release = () => {};
  const held = new Promise<void>(resolve => { release = resolve; });
  f.worker.inspect.mockImplementationOnce(async ref => { const prepared = structuredClone(f.worker.snapshots.get(ref.executionId)!); await held; return prepared; });
  try {
    await f.engine.startWorkflow(f.id); await vi.waitFor(() => expect(f.worker.inspect).toHaveBeenCalledTimes(1));
    const job = f.store.snapshot().jobs[0]!; expect(job.durable?.intent).toBe('start');
    const stopping = f.engine.stopWorkflow(f.id);
    await vi.waitFor(() => expect(f.store.snapshot().jobs[0]?.durable?.intent).toBe('cancel'));
    release(); await stopping; await f.engine.waitUntilIdle();
    expect(f.worker.start).not.toHaveBeenCalled(); expect(f.worker.providerLaunches).toEqual([]);
    expect(f.worker.cancel).toHaveBeenCalledWith(job.durable!.ref);
    expect(f.store.snapshot().jobs[0]?.durable?.ref).toEqual(job.durable!.ref);
    expect(f.store.snapshot().jobs[0]?.status).toBe('cancelled');
    expect(f.store.snapshot().workflowStopHolds).toContain(f.id); expect(f.store.snapshot().ideas[0]?.status).toBe('inbox');
  } finally { release(); await f.engine.stop(); }
});

it('can cancel an original reference despite unavailable capacity configuration without preparing another execution', async () => {
  const f = await durableFixture(); let reopened: WorkflowEngine | undefined;
  try {
    await f.engine.startWorkflow(f.id); await f.engine.waitUntilIdle(); await f.engine.stop();
    f.worker.configureConcurrency.mockRejectedValue(new Error('Capacity could not contact the old generation'));
    reopened = new WorkflowEngine(f.store, f.options); await reopened.stopWorkflow(f.id);
    expect(f.worker.cancel).toHaveBeenCalledTimes(1); expect(f.worker.prepare).toHaveBeenCalledTimes(1); expect(f.worker.providerLaunches).toHaveLength(1);
    expect(f.store.snapshot().jobs[0]?.status).toBe('cancelled'); expect(f.store.snapshot().ideas[0]?.status).toBe('inbox');
  } finally { await reopened?.stop(); await f.engine.stop(); }
});

it('sends cancellation for a Stop committed while an already-authorized start reply was pending', async () => {
  const f = await durableFixture(); let release = () => {};
  const held = new Promise<void>(resolve => { release = resolve; }); const start = f.worker.start.getMockImplementation()!;
  f.worker.start.mockImplementationOnce(async ref => { const started = await start(ref); await held; return started; });
  try {
    await f.engine.startWorkflow(f.id); await vi.waitFor(() => expect(f.worker.start).toHaveBeenCalledTimes(1));
    const stopping = f.engine.stopWorkflow(f.id);
    await vi.waitFor(() => expect(f.store.snapshot().workflowStopHolds).toContain(f.id));
    release(); await stopping; await f.engine.waitUntilIdle();
    expect(f.worker.cancel).toHaveBeenCalledTimes(1); expect(f.worker.providerLaunches).toHaveLength(1);
    expect(f.store.snapshot().jobs[0]?.status).toBe('cancelled'); expect(f.store.snapshot().ideas[0]?.status).toBe('inbox');
  } finally { release(); await f.engine.stop(); }
});

it('retries the original applied completion ACK after detach even if new capacity configuration cannot be confirmed', async () => {
  const f = await durableFixture(); let reopened: WorkflowEngine | undefined;
  try {
    await f.engine.startWorkflow(f.id); await f.engine.waitUntilIdle(); const job = f.store.snapshot().jobs[0]!; f.worker.complete(job.id);
    f.worker.acknowledge.mockRejectedValueOnce(new Error('Original ACK reply lost'));
    await expect(f.engine.reconcileDurableBuild(f.id)).rejects.toThrow('could not be contacted'); await f.engine.stop();
    f.worker.configureConcurrency.mockRejectedValue(new Error('The old supervisor is dead'));
    reopened = new WorkflowEngine(f.store, f.options); await reopened.reconcileDurableBuild(f.id);
    expect(f.store.snapshot().jobs[0]?.durable?.acknowledged).toBe(true); expect(f.worker.acknowledge).toHaveBeenCalledTimes(2);
    expect(f.store.snapshot().ideas[0]?.workflowRun?.cursor).toBe(1); expect(f.worker.prepare).toHaveBeenCalledTimes(1); expect(f.worker.providerLaunches).toHaveLength(1);
  } finally { await reopened?.stop(); await f.engine.stop(); }
});
