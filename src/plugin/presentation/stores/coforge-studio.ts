import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { AppState } from '../../features/coforge/domain/types';
import { projectIdeas as scopedIdeas } from '../../features/coforge/domain/projects';

export type StudioView = 'board' | 'stream' | 'workflow' | 'community' | 'settings' | 'projects' | 'population' | 'operations' | 'community-settings' | 'broadcast';
export interface Toast { id: number; message: string; error: boolean }

/** Per-view projection of the studio state plus view-local navigation, overlays and feedback. */
export const useStudioStore = defineStore('coforge-studio', () => {
  const state = ref<AppState | null>(null);
  const view = ref<StudioView>('broadcast');
  const selected = ref<string | null>(null);
  const creating = ref(false);
  const help = ref(false);
  const activityOpen = ref(false);
  const dirtySettings = ref(false);
  const dirtyCommunitySettings = ref(false);
  const streamTool = ref<'channel' | 'messages'>('channel');
  const setupStep = ref(0);
  const historySelection = ref('');
  const setupRequested = ref(false);
  const moderationTarget = ref<{ channelId: string; username: string; userId?: string; messageId?: string } | null>(null);
  const pending = ref(0);
  const toasts = ref<Toast[]>([]);
  const timers = new Set<number>();
  let toastId = 0;

  const busy = computed(() => pending.value > 0);
  const activeProject = computed(() => state.value?.projects?.find(project => project.id === state.value?.activeProjectId));
  const projectIdeas = computed(() => state.value ? scopedIdeas(state.value) : []);
  const projectJobs = computed(() => state.value?.jobs.filter(job => job.projectId === state.value?.activeProjectId) ?? []);
  const activeJob = computed(() => projectJobs.value.find(j => j.status === 'running') ?? projectJobs.value.find(j => j.status === 'queued'));
  const backgroundJobs = computed(() => state.value?.jobs.filter(job => job.projectId !== state.value?.activeProjectId && (job.status === 'running' || job.status === 'queued')).length ?? 0);
  const selectedIdea = computed(() => state.value?.ideas.find(i => i.id === selected.value));

  function dismiss(id: number) { toasts.value = toasts.value.filter(toast => toast.id !== id); }
  function notify(message: string, error = false) {
    const id = ++toastId;
    toasts.value = [...toasts.value.slice(-2), { id, message, error }];
    const timer = window.setTimeout(() => { timers.delete(timer); dismiss(id); }, error ? 8500 : 4500);
    timers.add(timer);
  }
  function navigate(next: StudioView) {
    if (dirtyCommunitySettings.value && next !== 'community-settings') { notify('Save or discard your community settings before leaving.', true); return; }
    view.value = next; activityOpen.value = false;
  }
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

  return { state, view, selected, creating, help, activityOpen, dirtySettings, dirtyCommunitySettings, streamTool, setupStep, setupRequested, historySelection, moderationTarget, pending, toasts, busy, activeProject, projectIdeas, projectJobs, backgroundJobs,
    activeJob, selectedIdea, notify, dismiss, navigate, select, mutate, dispose };
});
