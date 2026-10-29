import { computed, inject, onBeforeUnmount, onMounted, provide, reactive, ref, type InjectionKey } from 'vue';
import { useCoforge } from '../../context/coforge-context';
import { useStudioStore } from '../../stores/coforge-studio';
import { useCouncilStore } from '../../stores/coforge-council';
import { useTaskSchedulerStore } from '../../stores/coforge-task-scheduler';
import { editTaskForm, localTaskTime, newTaskForm, taskFormInput, taskTimingLabel } from './task-scheduler-form';
import type { ScheduledTask, TaskOccurrence } from '../../../features/coforge/domain/scheduled-task';
import { useTemporaryExample } from './use-temporary-example';
import { resetTaskSchedulerExample } from './task-scheduler-example-reset';

function createTaskSchedulerModel() {
  const { host } = useCoforge(); const studio = useStudioStore(); const council = useCouncilStore(); const store = useTaskSchedulerStore();
  let service = store.example ? host.previewTaskScheduler?.() : host.taskScheduler; const available = ref(!!service); let closed = false; const stops: Array<() => void> = [];
  const councilService = () => host.council ?? (store.example ? host.previewCouncil?.() : undefined);
  const projects = computed(() => studio.state?.projects?.filter(project => !project.unavailable) ?? []);
  const definitions = computed(() => council.catalogue.valid.map(entry => entry.definition));
  const teams = computed(() => definitions.value.filter(definition => definition.schema === 'team/v1' && definition.projectId === store.form?.projectId && definition.enabled));
  const recipients = computed(() => {
    const form = store.form; const team = teams.value.find(team => team.id === form?.teamId);
    if (!form || !team || team.schema !== 'team/v1') return [];
    return definitions.value.filter(definition => definition.enabled && (form.kind === 'council' ? definition.schema === 'council/v1' && definition.teamId === team.id : definition.schema === 'agent/v1' && team.members.includes(definition.id)));
  });
  async function run(work: () => Promise<void>, message = '') {
    if (store.busy) return; store.busy = true; store.error = ''; store.notice = '';
    try { await work(); if (!closed) store.notice = message; }
    catch (error) { if (!closed) store.error = error instanceof Error ? error.message : 'The task action failed. Refresh and inspect the saved occurrence before retrying.'; }
    finally { store.busy = false; }
  }
  function requireService() { if (!service) throw new Error('Open CoForge in desktop Obsidian to manage scheduled tasks.'); return service; }
  async function catalogue() { const actions = councilService(); const current = service; if (actions) { const value = await actions.catalogue.list(); if (!closed && service === current) council.catalogue = value; } }
  onMounted(() => {
    if (service) { store.state = service.snapshot(); stops.push(service.subscribe(value => { if (!closed) store.state = value; })); }
    const actions = councilService(); if (actions) { council.state = actions.snapshot(); stops.push(actions.subscribe(value => { if (!closed) council.state = value; })); void run(catalogue); }
  });
  onBeforeUnmount(() => { closed = true; for (const stop of stops) stop(); });
  function exitExample() {
    if (!store.example) return;
    for (const stop of stops.splice(0)) stop();
    service = host.taskScheduler; available.value = !!service;
    resetTaskSchedulerExample(); host.discardPreview?.('task-scheduler');
    if (service) { store.state = service.snapshot(); stops.push(service.subscribe(value => { if (!closed) store.state = value; })); }
  }
  const beginExample = useTemporaryExample('task-scheduler', exitExample);
  const needsAcknowledgement = (id: string) => store.state?.occurrences.some(item => item.taskId === id && item.status === 'attention' && item.acknowledgedAt === undefined) ?? false;
  const edit = (task: ScheduledTask) => { if (store.form) { store.error = 'Save or discard the current draft before editing another schedule.'; return; } store.form = editTaskForm(task); store.error = ''; store.notice = ''; };
  const openMonitor = (runId = '') => { council.inspectedRun = runId; council.tab = 'monitor'; };
  const targetLabel = (task: ScheduledTask) => {
    const name = (id: string) => definitions.value.find(definition => definition.id === id)?.name ?? id;
    return task.destination.kind === 'team' ? `${name(task.destination.teamId)} → ${name(task.destination.assigneeId ?? '')}` : `${task.destination.kind === 'council' ? 'Council' : 'Agent'} · ${name(task.destination.id)}`;
  };
  const model = reactive({
    store, projects, teams, recipients, needsAcknowledgement, targetLabel, timingLabel: taskTimingLabel,
    available, canPreview: !!host.previewTaskScheduler, canManage: computed(() => !!council.state?.executor && !!store.state?.ready),
    executionPaused: computed(() => council.state?.paused ?? true), deviceZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    tasks: computed(() => (store.state?.tasks ?? []).filter(task => (!store.projectFilter || task.projectId === store.projectFilter) && (store.showArchived || !task.archived))),
    occurrences: computed(() => [...(store.state?.occurrences ?? [])].reverse().filter(item => !store.projectFilter || item.snapshot.projectId === store.projectFilter).slice(0, 30)),
    occurrenceLabel: (item: TaskOccurrence) => store.example && item.runId ? 'Simulated admission · no provider was invoked' : item.runId ? `${item.status} · ${council.state?.runs.find(run => run.id === item.runId)?.state ?? 'run no longer retained'}` : item.status,
    when: (at: number | null, task?: ScheduledTask) => at === null ? 'No future occurrence' : new Date(at).toLocaleString(undefined, task?.timing.kind === 'calendar' ? { timeZone: task.timing.timeZone, timeZoneName: 'short' } : undefined),
    create: () => { store.form = newTaskForm(studio.state?.activeProjectId ?? projects.value[0]?.id ?? ''); store.error = ''; store.notice = ''; }, edit,
    cancel: () => { store.form = null; store.error = ''; },
    projectChanged: () => { if (store.form) { store.form.teamId = ''; store.form.recipient = ''; } },
    recipientChanged: () => { if (store.form) store.form.recipient = ''; },
    setDelay: () => { const seconds = Number(store.delay) * Number(store.delayUnit); if (!Number.isFinite(seconds) || seconds < 1 || seconds > 31536000) { store.error = 'Choose a delay between one second and one year.'; return; } if (store.form) store.form.at = localTaskTime(Date.now() + seconds * 1000); },
    refresh: () => { void run(async () => { await requireService().refresh(); await catalogue(); }); },
    save: (event: Event) => { event.preventDefault(); void run(async () => { const form = store.form; if (!form) return; await requireService().save(taskFormInput(form), form.id || undefined, form.id ? form.revision : undefined, form.acknowledge); store.form = null; }, 'Schedule saved.'); },
    toggle: (task: ScheduledTask) => {
      if (!task.enabled && needsAcknowledgement(task.id)) { edit(task); store.notice = 'Inspect the original occurrence/source and run, acknowledge recovery, then enable future scheduling.'; return; }
      void run(() => requireService().enable(task.id, !task.enabled, task.revision), task.enabled ? 'Future occurrences paused.' : 'Future scheduling enabled. Missed work is not replayed.');
    },
    archive: (task: ScheduledTask) => { void run(() => requireService().archive(task.id, task.revision), 'Schedule archived. Existing runs and evidence remain.'); },
    restore: (task: ScheduledTask) => { void run(() => requireService().enable(task.id, false, task.revision), 'Schedule restored, paused.'); },
    runNow: (task: ScheduledTask) => { void run(() => requireService().runNow(task.id), 'Manual occurrence recorded. Inspect its status below.'); },
    openSource: (item: TaskOccurrence) => { void run(() => requireService().openSource(item.id)); },
    openMonitor: () => openMonitor(), openRun: (item: TaskOccurrence) => openMonitor(item.runId),
    definitions: () => { council.tab = 'definitions'; }, exitExample,
    explore: () => { void run(async () => {
      const preview = host.previewTaskScheduler?.(); if (!preview) throw new Error('Scheduler example is unavailable.');
      beginExample(); store.example = true; service = preview; available.value = true;
      store.state = service.snapshot(); stops.push(service.subscribe(value => { if (!closed) store.state = value; }));
      const actions = councilService(); if (actions) { await actions.designateExecutor(); if (closed || service !== preview) return; council.state = actions.snapshot(); stops.push(actions.subscribe(value => { if (!closed) council.state = value; })); }
      await catalogue();
    }); },
  });
  return model;
}
export type TaskSchedulerModel = ReturnType<typeof createTaskSchedulerModel>;
const key: InjectionKey<TaskSchedulerModel> = Symbol('task-scheduler');
export function useTaskScheduler(): TaskSchedulerModel { const model = createTaskSchedulerModel(); provide(key, model); return model; }
export function useTaskSchedulerForm(): TaskSchedulerModel { const model = inject(key, null); if (!model) throw new Error('Task scheduler model is missing.'); return model; }
