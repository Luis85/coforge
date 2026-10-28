import { afterEach, expect, it } from 'vitest';
import { TaskScheduler } from '../../../features/coforge/application/task-scheduler';
import { emptyTaskScheduler, type TaskDraft, type TaskSchedulerState } from '../../../features/coforge/domain/scheduled-task';
import { nodeTimers } from './memory-storage';

const stops: Array<() => Promise<void>> = [];
afterEach(async () => { for (const stop of stops.splice(0)) await stop(); });
async function fixture(initial = emptyTaskScheduler()) {
  let now = Date.parse('2026-10-28T10:00:00Z'); let data: TaskSchedulerState = structuredClone(initial);
  let available = true; let failSave = false; let unknown = false; let owned = true;
  const active = new Set<string>(); const calls: Array<{ task: TaskDraft; dueAt: number }> = [];
  const scheduler = new TaskScheduler({ load: async () => structuredClone(data), save: async state => { if (failSave) throw new Error('Disk full'); data = structuredClone(state); } }, {
    owned: () => owned, configure: async () => { if (!owned) throw new Error('Not the designated desktop'); }, validate: async () => {}, readiness: () => ({ ready: available, reason: 'Executor is paused' }), active: id => active.has(id), openSource: async () => {},
    dispatch: async (task, occurrence) => { calls.push({ task: structuredClone(task), dueAt: occurrence.dueAt }); if (unknown) throw new Error('Unknown admission'); const runId = `run-${calls.length}`; active.add(runId); return { runId, sourcePath: `CoForge/Scheduled/${occurrence.id}.md` }; },
  }, nodeTimers(), () => now);
  await scheduler.start(); stops.push(() => scheduler.dispose());
  const draft: TaskDraft = { title: 'Daily review', projectId: 'CFP-001', prompt: 'Review the game notes.', contextPaths: ['Private/Notes.md'], destination: { kind: 'team', id: 'team-one', teamId: 'team-one', assigneeId: 'architect' },
    timing: { kind: 'interval', everySeconds: 60, startsAt: new Date(now + 60000).toISOString() }, enabled: true };
  return { scheduler, draft, calls, active, data: () => data, advance: (ms: number) => { now += ms; }, unavailable: () => { available = false; }, unowned: () => { owned = false; }, failSave: () => { failSave = true; }, unknown: () => { unknown = true; } };
}
it('persists an occurrence before dispatch, routes its frozen task and prevents duplicate/overlapping execution', async () => {
  const f = await fixture(); const task = await f.scheduler.save(f.draft);
  f.advance(60000); await f.scheduler.tick(); await f.scheduler.tick();
  expect(f.calls).toHaveLength(1); expect(f.calls[0]?.task.destination).toMatchObject({ kind: 'team', assigneeId: 'architect' });
  expect(f.scheduler.snapshot().occurrences[0]).toMatchObject({ taskId: task.id, status: 'submitted', runId: 'run-1', snapshot: { prompt: f.draft.prompt } });
  f.advance(60000); await f.scheduler.tick();
  expect(f.calls).toHaveLength(1); expect(f.scheduler.snapshot().occurrences.at(-1)).toMatchObject({ status: 'skipped' });
  f.active.clear(); f.advance(60000); await f.scheduler.tick(); expect(f.calls).toHaveLength(2);
});
it('respects paused execution and skips missed occurrences after reopening', async () => {
  const f = await fixture(); await f.scheduler.save(f.draft);
  f.advance(60000); await f.scheduler.tick(); f.active.clear(); f.advance(60000); await f.scheduler.tick(); expect(f.calls).toHaveLength(2);
  f.unavailable(); f.advance(60000); await f.scheduler.tick(); expect(f.calls).toHaveLength(2);
  const reopened = await fixture(f.data());
  reopened.advance(600000); await reopened.scheduler.refresh(); await reopened.scheduler.tick();
  expect(reopened.calls).toEqual([]); expect(reopened.scheduler.snapshot().occurrences.at(-1)?.status).toBe('skipped');
});
it('does not dispatch or mutate scheduling state from a non-designated desktop', async () => {
  const f = await fixture(); await f.scheduler.save(f.draft); f.unowned(); const before = f.data();
  f.advance(60000); await f.scheduler.tick(); expect(f.calls).toEqual([]); expect(f.data()).toEqual(before);
  await expect(f.scheduler.save(f.draft)).rejects.toThrow('designated');
});
it('fails closed before dispatch on persistence errors and holds unknown outcomes across reload', async () => {
  const failed = await fixture(); await failed.scheduler.save(failed.draft); failed.failSave(); failed.advance(60000);
  await expect(failed.scheduler.tick()).rejects.toThrow(); expect(failed.calls).toEqual([]); expect(failed.scheduler.snapshot().ready).toBe(false);
  const f = await fixture(); const task = await f.scheduler.save(f.draft); f.unknown(); f.advance(60000); await f.scheduler.tick();
  expect(f.scheduler.snapshot().tasks.find(item => item.id === task.id)?.enabled).toBe(false);
  expect(f.scheduler.snapshot().occurrences[0]?.status).toBe('attention');
  const reopened = await fixture(f.data()); reopened.advance(60000); await reopened.scheduler.tick(); expect(reopened.calls).toEqual([]);
  await expect(reopened.scheduler.enable(task.id, true, task.revision)).rejects.toThrow('acknowledge');
  await expect(reopened.scheduler.runNow(task.id)).rejects.toThrow('acknowledge');
  await reopened.scheduler.enable(task.id, true, task.revision, true);
  expect(reopened.scheduler.snapshot().tasks.find(item => item.id === task.id)?.enabled).toBe(true);
});
it('rejects stale edits, preserves earlier occurrence snapshots and archives only future scheduling', async () => {
  const f = await fixture(); const task = await f.scheduler.save(f.draft); f.advance(60000); await f.scheduler.tick();
  const updated = await f.scheduler.save({ ...f.draft, prompt: 'A new prompt' }, task.id, task.revision);
  await expect(f.scheduler.save(f.draft, task.id, task.revision)).rejects.toThrow();
  expect(f.scheduler.snapshot().occurrences[0]?.snapshot?.prompt).toBe(f.draft.prompt);
  await f.scheduler.archive(updated.id, updated.revision); f.advance(60000); await f.scheduler.tick(); expect(f.calls).toHaveLength(1);
});
it('consumes a one-time timer once and never replays an interrupted reservation on restart', async () => {
  const f = await fixture(); await f.scheduler.save({ ...f.draft, timing: { kind: 'once', at: '2026-10-28T10:01:00Z' } });
  f.advance(60000); await f.scheduler.tick(); f.advance(60000); await f.scheduler.tick(); expect(f.calls).toHaveLength(1);
  expect(f.scheduler.snapshot().tasks[0]).toMatchObject({ enabled: false, nextDueAt: null });
  const original = await fixture(); const task = await original.scheduler.save(original.draft); const crashed = structuredClone(original.data());
  crashed.occurrences.push({ id: 'interrupted-one', taskId: task.id, taskRevision: task.revision, dueAt: Date.parse('2026-10-28T10:01:00Z'), createdAt: Date.parse('2026-10-28T10:00:00Z'), status: 'reserved', message: 'Reserved', snapshot: original.draft });
  const reopened = await fixture(crashed); reopened.advance(3600000); await reopened.scheduler.tick();
  expect(reopened.calls).toEqual([]); expect(reopened.scheduler.snapshot().tasks[0]?.enabled).toBe(false); expect(reopened.scheduler.snapshot().occurrences[0]?.status).toBe('attention');
});
