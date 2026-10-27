import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { STAGE_LABELS, STAGES } from '../../../features/coforge/domain/types';
import { useCoforge } from '../../context/coforge-context';
import { useStudioStore, type StudioView } from '../../stores/coforge-studio';
import { relativeTime } from './format';
import { useStudioActions } from './use-studio-actions';

const VIEW_LABELS: Record<StudioView, string> = { board: 'Idea board', stream: 'Stream chat', workflow: 'Agent workflow', community: 'Community', settings: 'Settings', projects: 'Projects', population: 'Viewers', operations: 'Operations', 'community-settings': 'Community settings', broadcast: 'Stream studio', statistics: 'Statistics', finance: 'Finances', 'ai-costs': 'AI costs', schedule: 'Stream schedule' };
const NAV: Array<{ view: StudioView; label: string; icon: string }> = [
  { view: 'broadcast', label: 'Stream studio', icon: 'radio' },
  { view: 'statistics', label: 'Statistics', icon: 'chart-line' },
  { view: 'finance', label: 'Finances', icon: 'wallet' },
  { view: 'ai-costs', label: 'AI costs', icon: 'receipt-text' },
  { view: 'schedule', label: 'Schedule', icon: 'calendar-days' },
  { view: 'board', label: 'Idea board', icon: 'layout-grid' }, { view: 'stream', label: 'Stream chat', icon: 'message-square' },
  { view: 'workflow', label: 'Agent workflow', icon: 'workflow' }, { view: 'community', label: 'Community', icon: 'trophy' },
  { view: 'population', label: 'Viewers', icon: 'users' }, { view: 'operations', label: 'Operations', icon: 'chart-no-axes-combined' },
];

/** Derived studio-shell state shared by the frame components (sidebar, top bar, pipeline, dock, activity). */
export function useStudioShell() {
  const store = useStudioStore();
  const actions = useStudioActions();
  const state = computed(() => store.state);
  return reactive({
    store, actions, state,
    toggleRightPanel: () => { store.rightPanelManual = true; store.rightPanelCollapsed = !store.rightPanelCollapsed; },
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
    events: computed(() => [...(state.value?.events ?? [])].reverse().slice(0, 30).map(event => ({ ...event, when: relativeTime(event.createdAt) }))),
    openEvent: (ideaId?: string) => { if (ideaId) void actions.openIdea(ideaId); },
    manageProjects: () => {
      if (store.dirtySettings) { store.notify('Save or discard your project settings before switching projects.', true); return; }
      store.navigate('projects');
    },
    copyProjectId: () => {
      const id = store.state?.activeProjectId;
      if (!id) return;
      if (!navigator.clipboard?.writeText) { store.notify('Select the project ID to copy it manually.', true); return; }
      void navigator.clipboard.writeText(id).then(() => store.notify('Project ID copied.'), () => store.notify('Select the project ID to copy it manually.', true));
    },
    togglePause: () => { if (state.value) void actions.changeSettings({ paused: !state.value.settings.paused }); },
    startHelp: () => { store.help = false; store.navigate('workflow'); },
  });
}

/** Root binding of a CoForge view: subscribes to the studio and to runtime notices for the view's lifetime. */
export function useStudioApp() {
  const context = useCoforge();
  const shell = useStudioShell();
  let observed: Element | undefined; let resize: ResizeObserver | undefined;
  const elementNode = (value: unknown): value is Element => Boolean(value && typeof value === 'object' && Reflect.get(value, 'nodeType') === 1 && typeof Reflect.get(value, 'getBoundingClientRect') === 'function');
  const bindRoot = (value: unknown) => {
    if (!elementNode(value) || value === observed) return;
    resize?.disconnect(); observed = value;
    const update = () => { const width = value.getBoundingClientRect().width; if (!width) return; shell.store.narrowLayout = width < 1050; if (!shell.store.rightPanelManual) shell.store.rightPanelCollapsed = shell.store.narrowLayout; };
    update(); if (typeof ResizeObserver !== 'undefined') { resize = new ResizeObserver(update); resize.observe(value); }
  };
  onBeforeUnmount(() => resize?.disconnect());
  const failure = ref(context.startupError());
  let stops: Array<() => void> = [];
  onMounted(() => {
    stops = [
      context.studio.subscribe(state => { shell.store.state = state; }),
      context.onNotice(notice => { shell.store.notify(notice.message, notice.error); failure.value = context.startupError(); }),
    ];
  });
  onBeforeUnmount(() => { for (const stop of stops) stop(); stops = []; shell.store.dispose(); });
  return reactive({ shell, failure, bindRoot });
}
