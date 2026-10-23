import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { AppState } from '../../features/coforge/domain/types';

export type StudioView = 'board' | 'stream' | 'workflow' | 'community' | 'settings';
export interface Toast { id: number; message: string; error: boolean }

/** Per-view projection of the studio state plus view-local navigation, overlays and feedback. */
export const useStudioStore = defineStore('coforge-studio', () => {
  const state = ref<AppState | null>(null);
  const view = ref<StudioView>('board');
  const selected = ref<string | null>(null);
  const creating = ref(false);
  const help = ref(false);
  const activityOpen = ref(false);
  const pending = ref(0);
  const toasts = ref<Toast[]>([]);
  const timers = new Set<number>();
  let toastId = 0;

  const busy = computed(() => pending.value > 0);
  const activeJob = computed(() => state.value?.jobs.find(j => j.status === 'running') ?? state.value?.jobs.find(j => j.status === 'queued'));
  const selectedIdea = computed(() => state.value?.ideas.find(i => i.id === selected.value));

  function dismiss(id: number) { toasts.value = toasts.value.filter(toast => toast.id !== id); }
  function notify(message: string, error = false) {
    const id = ++toastId;
    toasts.value = [...toasts.value.slice(-2), { id, message, error }];
    const timer = window.setTimeout(() => { timers.delete(timer); dismiss(id); }, error ? 8500 : 4500);
    timers.add(timer);
  }
  function navigate(next: StudioView) { view.value = next; activityOpen.value = false; }
  function select(id: string | null) { selected.value = id; activityOpen.value = false; }
  function dispose() { for (const timer of timers) window.clearTimeout(timer); timers.clear(); }

  /** Runs a studio request, reports its outcome as a toast and rethrows failures for the caller. */
  async function mutate<T>(work: () => Promise<T>, success?: string | ((result: T) => string)): Promise<T> {
    pending.value++;
    try {
      const result = await work();
      const message = typeof success === 'function' ? success(result) : success;
      if (message) notify(message);
      return result;
    } catch (error) {
      notify(error instanceof Error ? error.message : 'That action could not be completed.', true);
      throw error;
    } finally { pending.value = Math.max(0, pending.value - 1); }
  }

  return { state, view, selected, creating, help, activityOpen, pending, toasts, busy, activeJob, selectedIdea, notify, dismiss, navigate, select, mutate, dispose };
});
