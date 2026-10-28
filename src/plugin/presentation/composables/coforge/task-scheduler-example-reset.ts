import { useTaskSchedulerStore } from '../../stores/coforge-task-scheduler';

/** Explicit example cleanup leaves authored native schedules and their drafts intact. */
export function resetTaskSchedulerExample() {
  const store = useTaskSchedulerStore();
  if (!store.example) return;
  store.$patch({ example: false, state: null, form: null, error: '', notice: '', projectFilter: '', showArchived: false, delay: 5, delayUnit: 60 });
}
