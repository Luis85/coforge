import { expect, it } from 'vitest';
import { WorkflowEngine } from '../../../features/coforge/application/engine';
import { seededStore, nodeTimers } from './memory-storage';
import type { StageRunner } from '../../../features/coforge/application/ports';

it('retains cumulative provider token reports on a failed attempt without adding duplicate totals', async () => {
  const { store } = await seededStore();
  const runner: StageRunner = async input => {
    await input.onTokenUsage?.({ inputTokens: 10, outputTokens: 5, cacheReadInputTokens: 0 });
    await input.onTokenUsage?.({ inputTokens: 20 });
    await input.onTokenUsage?.({ inputTokens: 20 });
    throw new Error('Synthetic result validation failure after usage.');
  };
  const engine = new WorkflowEngine(store, { runners: { demo: runner, claude: runner }, timers: nodeTimers() });
  const idea = store.snapshot().ideas.find(idea => idea.status === 'inbox');
  if (!idea) throw new Error('Inbox fixture missing.');
  try {
    const queued = await engine.submit(idea.id, 'screen'); await engine.waitUntilIdle();
    const job = store.snapshot().jobs.find(job => job.id === queued.id);
    expect(job?.status).toBe('failed');
    expect(job?.usage).toEqual({ inputTokens: 20, outputTokens: 5, cacheReadInputTokens: 0 });
    expect(store.snapshot().population?.operations.filter(operation => operation.code === 'ai-usage-reported' && operation.entityId === queued.id)).toHaveLength(2);
  } finally { await engine.stop(); }
});
