import { expect, it } from 'vitest';
import { collectCostTasks } from '../../../features/coforge/domain/ai-cost-snapshot';
import { createEmptyState } from '../../../features/coforge/domain/seed';
import type { HerdrAgent, HerdrRecord } from '../../../features/coforge/domain/herdr';

it('uses captured Herdr target identity without inventing catalog identities or provider costs', () => {
  const state = createEmptyState();
  state.jobs.push({ id: 'managed', ideaId: 'CF-101', projectId: 'CFP-001', stage: 'plan', provider: 'herdr', status: 'failed', model: 'sonnet', startedAt: '2026-10-28T12:00:00Z', logs: [] },
    { id: 'legacy', ideaId: 'CF-102', projectId: 'CFP-001', stage: 'plan', provider: 'claude', status: 'failed', startedAt: '2026-10-28T12:00:00Z', logs: [] });
  const target: HerdrAgent = { paneId: 'pane', terminalId: 'terminal', workspaceId: 'workspace', agent: 'claude', name: 'Captured Herdr worker', cwd: 'C:/private/project', status: 'ready', ready: true, sessionRef: 'verified-session' };
  const dispatch: HerdrRecord = { id: 'dispatch', kind: 'dispatch', session: 'local', at: '2026-10-28T12:00:00Z', status: 'delivered', ideaId: 'CF-103', projectId: 'CFP-001', target };
  const tasks = collectCostTasks(state, [dispatch], [{ jobId: 'managed', settings: { executable: 'herdr', session: 'local' }, target }]);
  expect(tasks).toHaveLength(3);
  expect(tasks[0]).toMatchObject({ attribution: { kind: 'herdr', agentNamespace: 'herdr', agentName: target.name } });
  expect(tasks[2]?.attribution?.agentId).toBe(tasks[0]?.attribution?.agentId);
  expect(tasks[1]?.attribution).toBeUndefined();
  expect(tasks.every(task => task.reportedUsd === undefined && task.usage === undefined)).toBe(true);
  expect(JSON.stringify(tasks)).not.toContain('C:/private/project');
});
