import type { ScheduledTask, TaskDraft } from '../../../features/coforge/domain/scheduled-task';

export interface TaskForm {
  id: string; revision: number; title: string; projectId: string; teamId: string; kind: 'agent' | 'team' | 'council'; recipient: string;
  prompt: string; contexts: string; timing: 'once' | 'interval' | 'daily' | 'weekly'; at: string;
  every: number; unit: number; time: string; timeZone: string; weekdays: number[]; enabled: boolean; acknowledge: boolean;
}
export const localTaskTime = (value: number): string => {
  const date = new Date(value); const two = (number: number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}T${two(date.getHours())}:${two(date.getMinutes())}:${two(date.getSeconds())}`;
};
export function newTaskForm(projectId = '', now = Date.now()): TaskForm {
  return { id: '', revision: 0, title: '', projectId, teamId: '', kind: 'agent', recipient: '', prompt: '', contexts: '', timing: 'interval',
    at: localTaskTime(now + 60000), every: 1, unit: 60, time: '09:00', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    weekdays: [1], enabled: false, acknowledge: false };
}
export function editTaskForm(task: ScheduledTask): TaskForm {
  const form = { ...newTaskForm(task.projectId), id: task.id, revision: task.revision, title: task.title, teamId: task.destination.teamId, kind: task.destination.kind,
    recipient: task.destination.kind === 'team' ? task.destination.assigneeId ?? '' : task.destination.id,
    prompt: task.prompt, contexts: task.contextPaths.join('\n'), enabled: task.enabled };
  const timing = task.timing;
  if (timing.kind === 'calendar') { form.timing = timing.weekdays.length === 7 ? 'daily' : 'weekly'; form.time = timing.time; form.timeZone = timing.timeZone; form.weekdays = [...timing.weekdays]; }
  else { form.timing = timing.kind; form.at = localTaskTime(Date.parse(timing.kind === 'once' ? timing.at : timing.startsAt)); if (timing.kind === 'interval') { form.unit = timing.everySeconds % 3600 === 0 ? 3600 : timing.everySeconds % 60 === 0 ? 60 : 1; form.every = timing.everySeconds / form.unit; } }
  return form;
}
export function taskFormInput(form: TaskForm): TaskDraft {
  const at = () => { const value = new Date(form.at); if (!Number.isFinite(value.getTime())) throw new Error('Choose a valid local date and time.'); return value.toISOString(); };
  const timing = form.timing === 'once' ? { kind: 'once' as const, at: at() }
    : form.timing === 'interval' ? { kind: 'interval' as const, startsAt: at(), everySeconds: Number(form.every) * Number(form.unit) }
      : { kind: 'calendar' as const, time: form.time, timeZone: form.timeZone.trim(), weekdays: form.timing === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : [...form.weekdays] };
  return { title: form.title, projectId: form.projectId, prompt: form.prompt, contextPaths: form.contexts.split('\n').map(value => value.trim()).filter(Boolean),
    destination: { kind: form.kind, teamId: form.teamId, id: form.kind === 'team' ? form.teamId : form.recipient, ...(form.kind === 'team' ? { assigneeId: form.recipient } : {}) }, timing, enabled: form.enabled };
}
export function taskTimingLabel(task: ScheduledTask): string {
  const timing = task.timing;
  if (timing.kind === 'once') return 'One-time timer';
  if (timing.kind === 'interval') return `Every ${timing.everySeconds} seconds`;
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${timing.weekdays.length === 7 ? 'Daily' : timing.weekdays.map(day => days[day]).join(', ')} at ${timing.time} · ${timing.timeZone}`;
}
