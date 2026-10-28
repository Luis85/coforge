// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import { AICostService } from '../../../features/coforge/application/ai-cost-service';
import { executionCostTasks } from '../../../features/coforge/application/execution-costs';
import type { AICostTask } from '../../../features/coforge/domain/ai-costs';
import { councilControlsFixture } from './council-controls-fixture';
import { nodeTimers } from './memory-storage';

it('archives just-finished attempt facts before pruning and blocks pruning when ledger persistence fails', async () => {
  vi.useFakeTimers();
  const fixture = await councilControlsFixture();
  let saved: AICostTask[] = [];
  let fail = true;
  const costs = new AICostService(fixture.studio.store, {
    load: async () => structuredClone(saved),
    save: async tasks => { if (fail) throw new Error('Cost ledger unavailable'); saved = structuredClone(tasks); },
  }, () => executionCostTasks(fixture.module.actions.snapshot().runs, fixture.studio.state().projects ?? []), nodeTimers());
  fixture.module.setCostArchiver(() => costs.refresh());
  try {
    const run = await fixture.module.actions.simulate(fixture.target, 'Private/Proposal.md', 'CoForge/Tests/Cost retention.md');
    await fixture.module.actions.resume(); await vi.advanceTimersByTimeAsync(1000);
    expect(fixture.module.actions.snapshot().runs.find(item => item.id === run.id)?.state).toBe('completed');
    expect(saved).toHaveLength(0);
    await expect(fixture.module.actions.pruneRun(run.id)).rejects.toThrow('Cost ledger unavailable');
    expect(fixture.module.actions.snapshot().runs.some(item => item.id === run.id)).toBe(true);
    fail = false;
    await fixture.module.actions.pruneRun(run.id);
    expect(fixture.module.actions.snapshot().runs.some(item => item.id === run.id)).toBe(false);
    expect(saved).toHaveLength(1);
    expect(saved[0]?.attribution).toMatchObject({ agentId: 'agent', agentName: 'Reviewer', teamId: 'team', teamName: 'Team' });
    await costs.refresh(); expect(costs.snapshot().tasks).toEqual(saved);
  } finally { await costs.dispose(); await fixture.dispose(); vi.useRealTimers(); }
});
