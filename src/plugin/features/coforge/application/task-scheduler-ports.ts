import type { TaskDraft, ScheduledTask, TaskOccurrence, TaskSchedulerState } from '../domain/scheduled-task';
export interface TaskSchedulerSnapshot extends TaskSchedulerState { ready: boolean; error: string }
export interface TaskSchedulerStorage { load(): Promise<TaskSchedulerState>; save(state: TaskSchedulerState): Promise<void> }
export interface TaskSchedulerHost {
  owned(): boolean;
  configure(): Promise<void>;
  validate(task: TaskDraft): Promise<void>;
  readiness(projectId: string): { ready: boolean; reason: string };
  active(runId: string): boolean;
  openSource(path: string): Promise<void>;
  dispatch(task: TaskDraft, occurrence: TaskOccurrence, signal: AbortSignal): Promise<{ runId: string; sourcePath: string }>;
}
export interface TaskSchedulerActions {
  snapshot(): TaskSchedulerSnapshot;
  subscribe(listener: (state: TaskSchedulerSnapshot) => void): () => void;
  save(input: unknown, id?: string, expectedRevision?: number, acknowledgeUnknown?: boolean): Promise<ScheduledTask>;
  enable(id: string, enabled: boolean, expectedRevision: number, acknowledgeUnknown?: boolean): Promise<void>;
  archive(id: string, expectedRevision: number): Promise<void>;
  runNow(id: string): Promise<void>;
  openSource(occurrenceId: string): Promise<void>;
  refresh(): Promise<void>;
}
