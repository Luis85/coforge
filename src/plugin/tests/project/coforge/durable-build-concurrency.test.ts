import { expect, it, vi } from 'vitest';
import { createSeed } from '../../../features/coforge/domain/seed';
import { executionConcurrency, executionConcurrencyCheck } from '../../../features/coforge/domain/execution-concurrency';
import { ai, definition } from './configured-workflow-fixture';
import { durableFixture } from './durable-build-fixture';

it('defaults to one slot per lane and validates independently saved global bounds', () => {
  expect(executionConcurrency({})).toEqual({ builds: 1, shortTasks: 1 });
  expect(executionConcurrencyCheck({ builds: 2, shortTasks: 16 })).toEqual({ builds: 2, shortTasks: 16 });
  expect(() => executionConcurrencyCheck({ builds: 0, shortTasks: 2 })).toThrow();
  expect(() => executionConcurrencyCheck({ builds: 2, shortTasks: 17 })).toThrow();
});

it('admits two background Builds and two actual concurrent short tasks while preserving same-idea ownership', async () => {
  const f = await durableFixture(); const releases: Array<() => void> = [];
  try {
    await f.store.transaction(state => {
      state.integration.executionConcurrency = { builds: 2, shortTasks: 2 };
      const source = createSeed().ideas.find(idea => idea.status === 'inbox')!;
      for (const number of [998, 997]) state.ideas.push({ ...structuredClone(source), id: `CF-${number}`, number, projectId: state.activeProjectId });
    });
    await f.engine.configureConcurrency();
    await Promise.all([f.engine.startWorkflow(f.id), f.engine.startWorkflow('CF-999')]); await f.engine.waitUntilIdle();
    expect(f.worker.prepare).toHaveBeenCalledTimes(2);
    await expect(f.engine.startWorkflow(f.id)).rejects.toThrow('existing workflow');
    await f.store.transaction(state => { state.settings.workflow = definition([ai('short')]); });
    f.foreground.mockImplementation(async () => { await new Promise<void>(resolve => releases.push(resolve)); return { markdown: 'Completed independent short task.' }; });
    await Promise.all([f.engine.startWorkflow('CF-998'), f.engine.startWorkflow('CF-997')]);
    await vi.waitFor(() => expect(releases).toHaveLength(2));
    expect(f.store.snapshot().jobs.filter(job => job.status === 'running')).toHaveLength(4);
    expect(f.worker.configureConcurrency).toHaveBeenLastCalledWith(2);
  } finally { for (const release of releases) release(); await f.engine.waitUntilIdle(); await f.engine.stop(); }
});

it('lowering capacity leaves active Builds untouched and admits the queued third only below the new limit', async () => {
  const f = await durableFixture();
  try {
    await f.store.transaction(state => { state.integration.executionConcurrency = { builds: 2, shortTasks: 1 }; state.ideas.push({ ...createSeed().ideas.find(idea => idea.status === 'inbox')!, id: 'CF-998', number: 998, projectId: state.activeProjectId }); });
    await f.engine.configureConcurrency();
    await Promise.all([f.engine.startWorkflow(f.id), f.engine.startWorkflow('CF-999')]); await f.engine.waitUntilIdle();
    await f.store.transaction(state => { state.integration.executionConcurrency = { builds: 1, shortTasks: 1 }; });
    await f.engine.configureConcurrency(); await f.engine.startWorkflow('CF-998'); await f.engine.waitUntilIdle();
    expect(f.worker.prepare).toHaveBeenCalledTimes(2); expect(f.worker.cancel).not.toHaveBeenCalled();
    const jobs = f.store.snapshot().jobs;
    f.worker.complete(jobs[0]!.id); await f.engine.reconcileDurableBuild(f.id); await f.engine.waitUntilIdle();
    expect(f.worker.prepare).toHaveBeenCalledTimes(2);
    f.worker.complete(jobs[1]!.id); await f.engine.reconcileDurableBuild('CF-999'); await f.engine.waitUntilIdle();
    expect(f.worker.prepare).toHaveBeenCalledTimes(3); expect(f.worker.cancel).not.toHaveBeenCalled();
  } finally { await f.engine.stop(); }
});
