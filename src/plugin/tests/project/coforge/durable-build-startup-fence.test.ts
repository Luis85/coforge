import { expect, it, vi } from 'vitest';
import { StudioService } from '../../../features/coforge/application/studio';
import { ai, definition } from './configured-workflow-fixture';
import { durableFixture } from './durable-build-fixture';

it('projects a completed original Build while deferred without dispatching its automatic next step before host readiness', async () => {
  vi.useFakeTimers(); const f = await durableFixture();
  let studio: StudioService | undefined;
  try {
    await f.store.transaction(state => { state.settings.workflow = { ...definition([{ ...ai('build', 'codechange', 'editworktree'), provider: 'claude', execution: { mode: 'background' } }, ai('follow-up')]), startupMode: 'play' }; });
    await f.engine.startWorkflow(f.id); await f.engine.waitUntilIdle();
    const job = f.store.snapshot().jobs[0]!; await f.engine.stop(); f.worker.complete(job.id);
    studio = new StudioService(f.storage, { ...f.options, probeRuntime: async () => ({ cliAvailable: true, projectPath: '/synthetic/game', allowImplementation: true }) });
    await studio.start({ deferAutomation: true }); await studio.reconcileDurableBuild(f.id); await studio.engine.waitUntilIdle();
    expect(studio.state().ideas[0]?.workflowRun?.cursor).toBe(1);
    expect(studio.state().jobs.find(item => item.workflow?.step.id === 'follow-up')?.status).toBe('queued');
    expect(f.foreground).not.toHaveBeenCalled();
    studio.engine.start(); await studio.engine.waitUntilIdle();
    expect(f.foreground).toHaveBeenCalledTimes(1); expect(f.worker.start).toHaveBeenCalledTimes(1);
    expect(studio.state().ideas[0]?.workflowRun?.cursor).toBe(2);
  } finally { await studio?.stop(); await f.engine.stop(); vi.useRealTimers(); }
});

it('saves desired concurrency even when post-save worker confirmation is unavailable', async () => {
  const f = await durableFixture();
  const studio = new StudioService(f.storage, { ...f.options, probeRuntime: async () => ({ cliAvailable: true, projectPath: '/synthetic/game', allowImplementation: true }) });
  try {
    await studio.start({ deferAutomation: true });
    f.worker.configureConcurrency.mockRejectedValueOnce(new Error('Original worker unavailable'));
    await expect(studio.updateIntegration({ executionConcurrency: { builds: 2, shortTasks: 3 } })).resolves.toMatchObject({ executionConcurrency: { builds: 2, shortTasks: 3 } });
    expect(studio.integration().executionConcurrency).toEqual({ builds: 2, shortTasks: 3 });
    expect(studio.state().runtime.durableBuild?.ready).toBe(false);
    expect(f.worker.prepare).not.toHaveBeenCalled(); expect(f.foreground).not.toHaveBeenCalled();
  } finally { await studio.stop(); await f.engine.stop(); }
});
