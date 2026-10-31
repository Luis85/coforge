import { expect, it, vi } from 'vitest';
import { WorkflowEngine } from '../../../features/coforge/application/engine';
import { StudioService } from '../../../features/coforge/application/studio';
import { durableFixture } from './durable-build-fixture';

it('rejects an assigned profile that now resolves to Herdr rather than falling back to a native preview', async () => {
  const f = await durableFixture();
  await f.store.transaction(state => { const step = state.settings.workflow!.steps[0]!; if (step.kind === 'ai') step.coworkerId = 'worker'; });
  const prepareCoworker = vi.fn(async () => ({ format: 'coforge-workflow-coworker/v1' as const, id: 'worker', name: 'Changed provider', revision: 'herdr-now', role: 'Builder', instructions: 'Build carefully.', provider: 'herdr' as const, model: 'sonnet' }));
  const engine = new WorkflowEngine(f.store, { ...f.options, agentTasks: { prepareCoworker, create: async () => { throw new Error('No delegated task expected'); } } });
  try {
    await expect(engine.startWorkflow(f.id)).rejects.toThrow('native Claude or Codex worker');
    expect(prepareCoworker).toHaveBeenCalledTimes(1);
    expect(f.worker.prepare).not.toHaveBeenCalled(); expect(f.foreground).not.toHaveBeenCalled();
    expect(f.store.snapshot().jobs).toEqual([]); expect(f.store.snapshot().ideas[0]?.workflowRun).toBeUndefined();
  } finally { await engine.stop(); await f.engine.stop(); }
});

it('rejects external MCP admission for a saved background Build policy without creating a run or job', async () => {
  const f = await durableFixture();
  try {
    await expect(f.engine.startMcpWorkflow(f.id)).rejects.toThrow('No foreground/provider fallback');
    expect(f.store.snapshot().jobs).toEqual([]); expect(f.store.snapshot().ideas[0]?.workflowRun).toBeUndefined();
    expect(f.worker.start).not.toHaveBeenCalled(); expect(f.foreground).not.toHaveBeenCalled();
  } finally { await f.engine.stop(); }
});

it('invalidates readiness after a Node setting write, preserving original admitted references until an explicit probe', async () => {
  const f = await durableFixture(); await f.engine.startWorkflow(f.id); await f.engine.waitUntilIdle();
  const original = f.store.snapshot().jobs[0]!.durable!.ref;
  await f.engine.stop();
  const studio = new StudioService(f.storage, { ...f.options, probeRuntime: async () => ({ cliAvailable: true, projectPath: '/synthetic/game', allowImplementation: true }) });
  try {
    await studio.start({ deferAutomation: true }); expect(studio.state().runtime.durableBuild?.ready).toBe(true);
    await studio.updateIntegration({ workerNodeBin: '/synthetic/another-node' });
    expect(studio.state().runtime.durableBuild).toMatchObject({ ready: false });
    expect(studio.state().jobs[0]?.durable?.ref).toEqual(original);
    await expect(studio.startWorkflow('CF-999')).rejects.toThrow('Check the background worker');
    await studio.refreshDurableBuildRuntime(); expect(studio.state().runtime.durableBuild?.ready).toBe(true);
    expect(f.worker.start).toHaveBeenCalledTimes(1);
  } finally { await studio.stop(); }
});
