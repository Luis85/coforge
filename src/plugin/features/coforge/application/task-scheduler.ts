import { emptyTaskScheduler, scheduledOccurrencePath, taskDraftCheck, taskSchedulerStateCheck, type ScheduledTask, type TaskDraft, type TaskOccurrence, type TaskSchedulerState } from '../domain/scheduled-task';
import { nextTaskTime } from '../domain/task-timing';
import { contextEventId } from '../domain/integrity';
import type { TaskSchedulerActions, TaskSchedulerHost, TaskSchedulerSnapshot, TaskSchedulerStorage } from './task-scheduler-ports';
import type { Timers } from './ports';

function draft(task: ScheduledTask): TaskDraft {
  return taskDraftCheck({ title: task.title, projectId: task.projectId, prompt: task.prompt, contextPaths: task.contextPaths,
    destination: task.destination, timing: task.timing, enabled: task.enabled });
}
/** Durable timer admission. Each occurrence is reserved before any note or execution is created. */
export class TaskScheduler implements TaskSchedulerActions {
  private state = emptyTaskScheduler();
  private ready = false;
  private error = '';
  private disposed = false;
  private timer: number | undefined;
  private tail: Promise<unknown> = Promise.resolve();
  private readonly controller = new AbortController();
  private readonly listeners = new Set<(state: TaskSchedulerSnapshot) => void>();
  private lastTick = 0;
  private wasOwned = false;
  constructor(private readonly storage: TaskSchedulerStorage, private readonly host: TaskSchedulerHost, private readonly timers: Timers, private readonly now = Date.now) {}
  snapshot(): TaskSchedulerSnapshot { return { ...structuredClone(this.state), ready: this.ready && !this.disposed, error: this.error }; }
  subscribe(listener: (state: TaskSchedulerSnapshot) => void): () => void { this.listeners.add(listener); listener(this.snapshot()); return () => { this.listeners.delete(listener); }; }
  private publish(): void { for (const listener of this.listeners) { try { listener(this.snapshot()); } catch { /* Observers cannot change persisted effects. */ } } }
  private serial<T>(work: () => Promise<T>): Promise<T> { const next = this.tail.then(work); this.tail = next.catch(() => undefined); return next; }
  private async commit(state: TaskSchedulerState): Promise<void> {
    state.revision++;
    try { await this.storage.save(taskSchedulerStateCheck(state)); this.state = structuredClone(state); this.error = ''; this.publish(); }
    catch { this.ready = false; this.error = 'Task scheduler storage failed. Restore its private journal and refresh before scheduling more work.'; this.publish(); throw new Error(this.error); }
  }
  private assertReady(): void { if (!this.ready || this.disposed) throw new Error(this.error || 'The task scheduler is unavailable. Refresh its private state.'); }
  private listen(): void {
    if (this.timer !== undefined || this.disposed) return;
    this.timer = this.timers.setInterval(() => { if (this.ready && !this.disposed) void this.tick().catch(() => { this.ready = false; this.error ||= 'Task scheduler needs attention. Inspect its saved state, resolve the issue and refresh before continuing.'; this.publish(); }); }, 1000);
  }
  private task(id: string, expected?: number): ScheduledTask {
    const task = this.state.tasks.find(task => task.id === id);
    if (!task || expected !== undefined && task.revision !== expected) throw new Error('This schedule changed. Refresh before saving.');
    return structuredClone(task);
  }
  private append(state: TaskSchedulerState, occurrence: TaskOccurrence): void {
    while (state.occurrences.length >= 500) {
      const index = state.occurrences.findIndex(item => item.status === 'skipped' || item.status === 'submitted' && item.runId && !this.host.active(item.runId) || item.status === 'attention' && item.acknowledgedAt !== undefined && (!item.runId || !this.host.active(item.runId)));
      if (index < 0) throw new Error('Scheduled occurrence evidence is full. Resolve active or uncertain runs before continuing.');
      state.occurrences.splice(index, 1);
    }
    state.occurrences.push(occurrence);
  }
  private skip(state: TaskSchedulerState, task: ScheduledTask, dueAt: number, message: string): void {
    const id = `schedule-${contextEventId(`${task.id}:${task.revision}:${dueAt}`)}`;
    if (!state.occurrences.some(item => item.id === id)) this.append(state, { id, taskId: task.id, taskRevision: task.revision, dueAt, createdAt: this.now(), status: 'skipped', message, snapshot: draft(task) });
    task.nextDueAt = nextTaskTime(task.timing, this.now());
    if (task.nextDueAt === null) task.enabled = false;
  }
  start(): Promise<void> {
    return this.serial(async () => {
      if (this.disposed) return;
      await this.load();
      if (this.disposed) return;
      this.lastTick = this.now();
      this.listen();
    });
  }
  private async load(): Promise<void> {
    this.ready = false;
    try {
      const state = taskSchedulerStateCheck(await this.storage.load());
      this.wasOwned = this.host.owned();
      if (!this.wasOwned) { this.state = state; this.ready = true; this.error = ''; this.publish(); return; }
      await this.host.configure();
      for (const item of state.occurrences.filter(item => item.status === 'reserved' || item.status === 'attention' && item.acknowledgedAt === undefined)) {
        if (item.status === 'reserved') { item.status = 'attention'; item.message = 'Admission was interrupted. Inspect the original source/run before enabling this schedule again; nothing was replayed.'; }
        const task = state.tasks.find(task => task.id === item.taskId); if (task) task.enabled = false;
      }
      for (const task of state.tasks) if (task.enabled && !task.archived && task.nextDueAt !== null && task.nextDueAt <= this.now())
        this.skip(state, task, task.nextDueAt, 'Missed while the scheduler was closed or unavailable; skipped.');
      await this.commit(state); this.ready = true; this.publish();
    } catch { this.error ||= 'Task scheduler state could not be loaded. Restore the private journal before continuing.'; this.publish(); throw new Error(this.error); }
  }
  refresh(): Promise<void> { return this.serial(async () => { if (this.disposed) throw new Error('Task scheduler is stopped.'); await this.load(); this.listen(); }); }
  save(input: unknown, id?: string, expectedRevision?: number, acknowledgeUnknown = false): Promise<ScheduledTask> {
    return this.serial(async () => {
      this.assertReady(); await this.host.configure();
      const checked = taskDraftCheck(input); await this.host.validate(checked);
      const previous = id ? this.task(id, expectedRevision) : undefined;
      if (id && expectedRevision === undefined) throw new Error('Refresh the schedule before editing it.');
      const uncertain = id ? this.state.occurrences.filter(item => item.taskId === id && item.status === 'attention' && item.acknowledgedAt === undefined) : [];
      if (checked.enabled && uncertain.length && !acknowledgeUnknown) throw new Error('Inspect the uncertain occurrence and its original run/source, then explicitly acknowledge recovery before enabling future work.');
      if (!id && this.state.tasks.length >= 200) throw new Error('This vault has reached its 200-schedule limit.');
      const nextDueAt = nextTaskTime(checked.timing, this.now());
      if (checked.enabled && nextDueAt === null) throw new Error('Choose a future time for this timer.');
      const task: ScheduledTask = { ...checked, id: previous?.id ?? crypto.randomUUID(), revision: (previous?.revision ?? 0) + 1, nextDueAt, updatedAt: this.now() };
      const state = structuredClone(this.state); state.tasks = [...state.tasks.filter(item => item.id !== task.id), task];
      if (checked.enabled && acknowledgeUnknown) for (const item of state.occurrences.filter(item => uncertain.some(previous => previous.id === item.id))) { item.acknowledgedAt = this.now(); item.message = 'Unknown admission inspected; no replay. Future scheduling explicitly enabled.'; }
      await this.commit(state); return structuredClone(task);
    });
  }
  enable(id: string, enabled: boolean, expectedRevision: number, acknowledgeUnknown = false): Promise<void> {
    const task = this.task(id, expectedRevision);
    return this.save({ ...draft(task), enabled }, id, expectedRevision, acknowledgeUnknown).then(() => undefined);
  }
  archive(id: string, expectedRevision: number): Promise<void> {
    return this.serial(async () => {
      this.assertReady(); await this.host.configure(); const task = this.task(id, expectedRevision);
      const state = structuredClone(this.state); const saved = state.tasks.find(item => item.id === task.id)!;
      saved.archived = true; saved.enabled = false; saved.revision++; saved.updatedAt = this.now(); await this.commit(state);
    });
  }
  private async dispatch(id: string, dueAt: number, manual = false): Promise<void> {
    const task = this.task(id);
    const state = structuredClone(this.state); const saved = state.tasks.find(item => item.id === id)!;
    const readiness = this.host.readiness(task.projectId);
    const busy = this.state.occurrences.some(item => item.taskId === id && item.runId && this.host.active(item.runId));
    if (!readiness.ready || busy) {
      this.skip(state, saved, dueAt, !readiness.ready ? readiness.reason : 'The previous occurrence is still active; skipped.'); await this.commit(state); return;
    }
    const occurrence: TaskOccurrence = { id: manual ? `manual-${crypto.randomUUID()}` : `schedule-${contextEventId(`${id}:${task.revision}:${dueAt}`)}`,
      taskId: id, taskRevision: task.revision, dueAt, createdAt: this.now(), status: 'reserved', message: 'Admission reserved.', snapshot: draft(task) };
    if (state.occurrences.some(item => item.id === occurrence.id)) return;
    occurrence.sourcePath = scheduledOccurrencePath(occurrence.id);
    this.append(state, occurrence);
    if (!manual) { saved.nextDueAt = nextTaskTime(saved.timing, this.now()); if (saved.nextDueAt === null) saved.enabled = false; }
    await this.commit(state);
    let receipt: { runId: string; sourcePath: string };
    try { this.controller.signal.throwIfAborted(); receipt = await this.host.dispatch(occurrence.snapshot, occurrence, this.controller.signal); }
    catch {
      const failed = structuredClone(this.state); const item = failed.occurrences.find(item => item.id === occurrence.id)!;
      item.status = 'attention'; item.message = 'Admission could not be confirmed. Inspect this occurrence and its source/run before enabling the schedule again; no automatic retry.';
      failed.tasks.find(task => task.id === id)!.enabled = false; await this.commit(failed); return;
    }
    const confirmed = structuredClone(this.state); Object.assign(confirmed.occurrences.find(item => item.id === occurrence.id)!, receipt, { status: 'submitted', message: 'Submitted to the shared execution kernel. Delivery is not completion.' });
    await this.commit(confirmed);
  }
  runNow(id: string): Promise<void> {
    return this.serial(async () => { this.assertReady(); await this.host.configure(); const task = this.task(id); if (task.archived) throw new Error('Archived schedules cannot run.'); if (this.state.occurrences.some(item => item.taskId === id && item.status === 'attention' && item.acknowledgedAt === undefined)) throw new Error('Inspect and acknowledge the uncertain occurrence before starting new work.'); await this.host.validate(draft(task)); await this.dispatch(id, this.now(), true); });
  }
  async openSource(occurrenceId: string): Promise<void> {
    this.assertReady();
    const occurrence = this.state.occurrences.find(item => item.id === occurrenceId);
    if (!occurrence?.sourcePath || occurrence.sourcePath !== scheduledOccurrencePath(occurrence.id)) throw new Error('This occurrence has no managed source note.');
    await this.host.openSource(occurrence.sourcePath);
  }
  tick(): Promise<void> {
    return this.serial(async () => {
      this.assertReady(); const at = this.now(); const suspended = this.lastTick > 0 && at - this.lastTick > 60000; this.lastTick = at;
      if (!this.host.owned()) { this.wasOwned = false; return; }
      if (!this.wasOwned) { await this.load(); return; }
      if (this.state.tasks.some(task => task.enabled && !task.archived && task.nextDueAt !== null && task.nextDueAt <= at)) await this.host.configure();
      for (const task of this.state.tasks) {
        if (this.disposed) return;
        if (!task.enabled || task.archived || task.nextDueAt === null || task.nextDueAt > at) continue;
        if (suspended && task.nextDueAt < at - 1000) {
          const state = structuredClone(this.state); this.skip(state, state.tasks.find(item => item.id === task.id)!, task.nextDueAt, 'The timer was suspended; missed occurrences were skipped.'); await this.commit(state);
        } else await this.dispatch(task.id, task.nextDueAt);
      }
    });
  }
  async dispose(): Promise<void> { this.disposed = true; this.controller.abort(); if (this.timer !== undefined) this.timers.clearInterval(this.timer); await this.tail; this.listeners.clear(); }
}
