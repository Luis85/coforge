import { expect, it, vi } from 'vitest';
import { StudioService } from '../../../features/coforge/application/studio';
import { durableFixture } from './durable-build-fixture';

it('requires explicit acknowledgement and never queues or starts work when repairing an unused startup generation', async () => {
  const f = await durableFixture();
  const repairBootstrap = vi.fn(async (_inspected: true) => ({ ready: true, message: 'Verified unused startup archived. No work was started.', repairable: false }));
  const studio = new StudioService(f.storage, { ...f.options, durableBuilds: { ...f.worker, repairBootstrap }, probeRuntime: async () => ({ cliAvailable: true, projectPath: '/synthetic/game', allowImplementation: true }) });
  try {
    await studio.start({ deferAutomation: true }); const saves = f.storage.saves;
    await expect(studio.repairDurableBuildRuntime(false)).rejects.toThrow('acknowledgement');
    expect(repairBootstrap).not.toHaveBeenCalled();
    await expect(studio.repairDurableBuildRuntime(true)).resolves.toMatchObject({ ready: true });
    expect(repairBootstrap).toHaveBeenCalledWith(true);
    expect(f.storage.saves).toBe(saves); expect(f.worker.prepare).not.toHaveBeenCalled(); expect(f.worker.start).not.toHaveBeenCalled();
  } finally { await studio.stop(); await f.engine.stop(); }
});
