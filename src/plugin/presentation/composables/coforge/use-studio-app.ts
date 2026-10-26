import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { STAGE_LABELS, STAGES } from '../../../features/coforge/domain/types';
import { useCoforge } from '../../context/coforge-context';
import { useStudioStore, type StudioView } from '../../stores/coforge-studio';
import { avatarStyle, relativeTime } from './format';
import { useStudioActions } from './use-studio-actions';

const VIEW_LABELS: Record<StudioView, string> = { board: 'Idea board', stream: 'Stream chat', workflow: 'Agent workflow', community: 'Community', settings: 'Settings', projects: 'Projects' };
const NAV: Array<{ view: StudioView; label: string; icon: string }> = [
  { view: 'board', label: 'Idea board', icon: 'layout-grid' }, { view: 'stream', label: 'Stream chat', icon: 'message-square' },
  { view: 'workflow', label: 'Agent workflow', icon: 'workflow' }, { view: 'community', label: 'Community', icon: 'trophy' },
];

/** Derived studio-shell state shared by the frame components (sidebar, top bar, pipeline, dock, activity). */
export function useStudioShell() {
  const store = useStudioStore();
  const actions = useStudioActions();
  const state = computed(() => store.state);
  return reactive({
    store, actions, state,
    nav: computed(() => NAV.map(item => ({
      ...item, active: store.view === item.view,
      count: item.view === 'board' ? store.projectIdeas.filter(i => i.status !== 'rejected').length : undefined,
      working: item.view === 'workflow' && Boolean(store.activeJob),
    }))),
    viewLabel: computed(() => VIEW_LABELS[store.view]),
    isDemo: computed(() => state.value?.settings.provider !== 'claude'),
    paused: computed(() => state.value?.settings.paused ?? true),
    reviewCount: computed(() => store.projectIdeas.filter(i => i.status === 'review').length),
    activeIdea: computed(() => state.value?.ideas.find(i => i.id === store.activeJob?.ideaId)),
    activeLabel: computed(() => store.activeJob ? `${STAGE_LABELS[store.activeJob.stage]} · ${store.activeJob.ideaId}`
      : store.backgroundJobs ? `${store.backgroundJobs} background ${store.backgroundJobs === 1 ? 'job' : 'jobs'} in other projects`
        : state.value?.settings.paused ? 'Agents standing by' : 'Watching the queue'),
    dockTitle: computed(() => store.activeJob ? `${store.activeJob.provider === 'demo' ? 'Demo agent' : 'Claude Code'} · ${STAGE_LABELS[store.activeJob.stage].toLowerCase()}` : ''),
    stages: computed(() => STAGES.map((stage, index) => ({
      stage, number: index + 1, label: STAGE_LABELS[stage],
      enabled: Boolean(state.value?.settings.automation[stage]), working: store.activeJob?.stage === stage,
    }))),
    sidebarPeople: computed(() => (state.value?.contributors ?? []).slice(0, 4).map((person, index) => ({
      id: person.id, letter: person.name.slice(0, 1).toUpperCase(), style: { ...avatarStyle(person.color), zIndex: String(5 - index) },
    }))),
    events: computed(() => [...(state.value?.events ?? [])].reverse().slice(0, 30).map(event => ({ ...event, when: relativeTime(event.createdAt) }))),
    openEvent: (ideaId?: string) => { if (ideaId) void actions.openIdea(ideaId); },
    manageProjects: () => {
      if (store.dirtySettings) { store.notify('Save or discard your project settings before switching projects.', true); return; }
      store.navigate('projects');
    },
    togglePause: () => { if (state.value) void actions.changeSettings({ paused: !state.value.settings.paused }); },
    startHelp: () => { store.help = false; store.navigate('workflow'); },
  });
}

/** Root binding of a CoForge view: subscribes to the studio and to runtime notices for the view's lifetime. */
export function useStudioApp() {
  const context = useCoforge();
  const shell = useStudioShell();
  const failure = ref(context.startupError());
  let stops: Array<() => void> = [];
  onMounted(() => {
    stops = [
      context.studio.subscribe(state => { shell.store.state = state; }),
      context.onNotice(notice => { shell.store.notify(notice.message, notice.error); failure.value = context.startupError(); }),
    ];
  });
  onBeforeUnmount(() => { for (const stop of stops) stop(); stops = []; shell.store.dispose(); });
  return reactive({ shell, failure });
}
