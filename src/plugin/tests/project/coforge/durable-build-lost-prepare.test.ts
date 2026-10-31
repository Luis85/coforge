import { expect, it, vi } from 'vitest';
import { StudioService } from '../../../features/coforge/application/studio';
import { durableFixture } from './durable-build-fixture';

it('cleans a lost unpaid preparation by stable job ID on reopen without replaying it or occupying the next Build slot', async () => {
  const f = await durableFixture(); const prepare = f.worker.prepare.getMockImplementation()!;
  f.worker.prepare.mockImplementationOnce(async request => { await prepare(request); return new Promise(() => {}); });
  let studio: StudioService | undefined;
  try {
    await f.engine.startWorkflow(f.id); await vi.waitFor(() => expect(f.worker.requests).toHaveLength(1));
    const originalJob = f.store.snapshot().jobs[0]!; const originalRef = f.worker.snapshots.get(originalJob.id)!.ref;
    expect(originalJob.durable).toBeUndefined(); await f.engine.stop();
    studio = new StudioService(f.storage, { ...f.options, probeRuntime: async () => ({ cliAvailable: true, projectPath: '/synthetic/game', allowImplementation: true }) });
    await studio.start({ deferAutomation: true }); await studio.engine.cleanupUnstartedBackground();
    expect(f.worker.cancelUnstarted).toHaveBeenCalledWith(originalJob.id);
    expect(f.worker.providerLaunches).toEqual([]);
    expect((await f.worker.start(originalRef)).phase).toBe('cancelled');
    expect(f.worker.providerLaunches).toEqual([]);
    await studio.startWorkflow('CF-999'); studio.engine.start(); await studio.engine.waitUntilIdle();
    expect(f.worker.providerLaunches).toHaveLength(1); expect(f.worker.providerLaunches).not.toContain(originalJob.id);
  } finally { await studio?.stop(); await f.engine.stop(); }
});
