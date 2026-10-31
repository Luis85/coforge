import { expect, it } from 'vitest';
import { StudioStore } from '../../../features/coforge/application/studio-store';
import { WorkflowEngine } from '../../../features/coforge/application/engine';
import { ai, definition } from './configured-workflow-fixture';
import { durableFixture } from './durable-build-fixture';

it('persists worker admission, survives detach/reload and applies/acknowledges completion once', async () => {
  const f = await durableFixture();
  try {
    await f.engine.startWorkflow(f.id); await f.engine.waitUntilIdle();
    const job = f.store.snapshot().jobs[0]!;
    expect(job.durable?.ref.executionId).toBe(job.id);
    expect(f.worker.start).toHaveBeenCalledTimes(1); expect(f.foreground).not.toHaveBeenCalled();
    await f.engine.stop(); expect(f.worker.cancel).not.toHaveBeenCalled();
    const reloaded = new StudioStore(f.storage); await reloaded.init();
    expect(reloaded.snapshot().jobs[0]?.status).toBe('running');
    expect(reloaded.snapshot().ideas[0]?.workflowRun?.state).toBe('running');
    const engine = new WorkflowEngine(reloaded, f.options);
    try {
      f.worker.complete(job.id);
      await engine.reconcileDurableBuild(f.id); await engine.reconcileDurableBuild(f.id);
      expect(reloaded.snapshot().jobs[0]?.status).toBe('succeeded');
      expect(reloaded.snapshot().ideas[0]?.workflowRun?.cursor).toBe(1);
      expect(reloaded.snapshot().ideas[0]?.status).toBe('review');
      expect(f.worker.start).toHaveBeenCalledTimes(1);
      expect(f.worker.acknowledge).toHaveBeenCalledTimes(1);
    } finally { await engine.stop(); }
  } finally { await f.engine.stop(); }
});

it('runs a short task beside a100hour Build without using its legacy timer or spinning on a second Build', async () => {
  const f = await durableFixture();
  try {
    await f.engine.startWorkflow(f.id); await f.engine.waitUntilIdle();
    const job = f.store.snapshot().jobs[0]!; f.worker.snapshots.get(job.id)!.elapsedSeconds = 360001;
    await f.engine.reconcileDurableBuild(f.id);
    expect(f.store.snapshot().jobs[0]?.status).toBe('running');
    await f.store.transaction(state => { state.settings.workflow = definition([ai('short')]); });
    await f.engine.startWorkflow('CF-999'); await f.engine.waitUntilIdle();
    expect(f.foreground).toHaveBeenCalledTimes(1); expect(f.worker.prepare).toHaveBeenCalledTimes(1);
    expect(f.store.snapshot().jobs[0]?.status).toBe('running');
  } finally { await f.engine.stop(); }
});

it('persists Stop before cancellation, retains Inbox and never accepts late success as completion', async () => {
  const f = await durableFixture();
  try {
    await f.engine.startWorkflow(f.id); await f.engine.waitUntilIdle();
    const job = f.store.snapshot().jobs[0]!;
    f.storage.failNextSave = true;
    await expect(f.engine.stopWorkflow(f.id)).rejects.toThrow('Disk full');
    expect(f.worker.cancel).not.toHaveBeenCalled();
    await f.engine.stopWorkflow(f.id);
    expect(f.worker.cancel).toHaveBeenCalledTimes(1);
    expect(f.store.snapshot().ideas[0]?.status).toBe('inbox');
    expect(f.store.snapshot().jobs[0]?.status).toBe('cancelled');
    f.worker.complete(job.id); await f.engine.reconcileDurableBuild(f.id);
    expect(f.store.snapshot().ideas[0]?.status).toBe('inbox');
    expect(f.store.snapshot().ideas[0]?.workflowRun?.cursor).toBe(0);
  } finally { await f.engine.stop(); }
});
