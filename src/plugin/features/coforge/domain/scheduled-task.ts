import { boolean, list, number, oneOf, optional, record, shape, text } from './check';
import { taskTimingCheck, type TaskTiming } from './task-timing';
import { normalizeVaultFolder } from './vault-folder-policy';

export interface TaskDestination { kind: 'agent' | 'team' | 'council'; id: string; teamId: string; assigneeId?: string }
export interface TaskDraft {
  title: string; projectId: string; prompt: string; contextPaths: string[]; destination: TaskDestination;
  timing: TaskTiming; enabled: boolean;
}
export interface ScheduledTask extends TaskDraft { id: string; revision: number; nextDueAt: number | null; updatedAt: number; archived?: boolean }
export interface TaskOccurrence {
  id: string; taskId: string; taskRevision: number; dueAt: number; createdAt: number;
  status: 'reserved' | 'submitted' | 'skipped' | 'attention'; message: string;
  runId?: string; sourcePath?: string; snapshot: TaskDraft;
  acknowledgedAt?: number;
}
export interface TaskSchedulerState { format: 'coforge-task-scheduler/v1'; revision: number; tasks: ScheduledTask[]; occurrences: TaskOccurrence[] }
const id = text({ min: 1, max: 100 });
const integer = number({ integer: true, min: 0 });
const destination = shape({ kind: oneOf(['agent', 'team', 'council'] as const), id, teamId: id, assigneeId: optional(id) }, { strict: true });
const fields = { title: text({ trim: true, min: 1, max: 100 }), projectId: text({ pattern: /^CFP-\d+$/u }),
  prompt: text({ trim: true, min: 1, max: 8000 }), contextPaths: list(text({ min: 1, max: 1000 }), { max: 10 }), destination,
  timing: taskTimingCheck, enabled: boolean };
export function taskDraftCheck(value: unknown): TaskDraft {
  const checked = shape(fields, { strict: true })(value);
  if (checked.destination.kind === 'team' && (!checked.destination.assigneeId || checked.destination.id !== checked.destination.teamId)) throw new Error('Choose one team member to handle this task.');
  if (checked.destination.kind !== 'team' && checked.destination.assigneeId) throw new Error('Only a team destination has an assigned member.');
  const paths = checked.contextPaths.map(path => normalizeVaultFolder(path));
  if (paths.some(path => !path.endsWith('.md')) || new Set(paths).size !== paths.length) throw new Error('Choose distinct Markdown context notes.');
  return { ...checked, contextPaths: paths };
}
function taskCheck(value: unknown): ScheduledTask {
  const raw = record(value);
  const metadata = shape({ id, revision: integer, nextDueAt: (value: unknown) => value === null ? null : integer(value), updatedAt: integer, archived: optional(boolean) }) (raw);
  const draft = taskDraftCheck(Object.fromEntries(Object.entries(raw).filter(([key]) => !['id', 'revision', 'nextDueAt', 'updatedAt', 'archived'].includes(key))));
  return { ...draft, ...metadata };
}
const occurrence = shape({ id, taskId: id, taskRevision: integer, dueAt: integer, createdAt: integer,
  status: oneOf(['reserved', 'submitted', 'skipped', 'attention'] as const), message: text({ max: 1000 }), runId: optional(id),
  sourcePath: optional(text({ max: 1000 })), snapshot: taskDraftCheck, acknowledgedAt: optional(integer) }, { strict: true });
export function taskSchedulerStateCheck(value: unknown): TaskSchedulerState {
  const state = shape({ format: oneOf(['coforge-task-scheduler/v1'] as const), revision: integer, tasks: list(taskCheck, { max: 200 }), occurrences: list(occurrence, { max: 500 }) }, { strict: true })(value);
  if (new Set(state.tasks.map(task => task.id)).size !== state.tasks.length || new Set(state.occurrences.map(item => item.id)).size !== state.occurrences.length || state.occurrences.some(item => !state.tasks.some(task => task.id === item.taskId))) throw new Error('Task scheduler identities are inconsistent.');
  return state;
}
export const emptyTaskScheduler = (): TaskSchedulerState => ({ format: 'coforge-task-scheduler/v1', revision: 0, tasks: [], occurrences: [] });
export const SCHEDULED_TASK_FOLDER = 'CoForge/Scheduled Tasks';
export function scheduledOccurrencePath(id: string): string {
  text({ min: 1, max: 100, pattern: /^[a-zA-Z0-9-]+$/u })(id);
  return `${SCHEDULED_TASK_FOLDER}/${id}.md`;
}
