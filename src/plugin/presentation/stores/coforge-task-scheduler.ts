import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { TaskSchedulerSnapshot } from '../../features/coforge/application/task-scheduler-ports';
import type { TaskForm } from '../composables/coforge/task-scheduler-form';
export const useTaskSchedulerStore = defineStore('coforge-task-scheduler', () => {
  const state = ref<TaskSchedulerSnapshot | null>(null); const form = ref<TaskForm | null>(null);
  const busy = ref(false); const error = ref(''); const notice = ref(''); const projectFilter = ref(''); const showArchived = ref(false);
  const delay = ref(5); const delayUnit = ref(60);
  const example = ref(false);
  return { state, form, busy, error, notice, projectFilter, showArchived, delay, delayUnit, example };
});
