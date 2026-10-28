import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { workflowDefinition } from "../../../features/coforge/domain/configured-workflow";
import { STAGE_LABELS } from "../../../features/coforge/domain/types";
import { useCoforge } from "../../context/coforge-context";
import { useStudioStore } from "../../stores/coforge-studio";
import {
  STUDIO_NAVIGATION,
  studioDestination,
} from "../../stores/studio-destinations";
import { relativeTime } from "./format";
import { useStudioActions } from "./use-studio-actions";
import { defaultSettings } from "../../../features/coforge/domain/seed";
import { workflowProviderSummary } from "./agent-labels";
import { observeHostStatusInset } from "./host-status-inset";

/** Derived studio-shell state shared by the frame components (sidebar, top bar, pipeline, dock, activity). */
export function useStudioShell() {
  const store = useStudioStore();
  const actions = useStudioActions();
  const state = computed(() => store.state);
  return reactive({
    store,
    actions,
    state,
    toggleRightPanel: () => {
      store.rightPanelManual = true;
      store.rightPanelCollapsed = !store.rightPanelCollapsed;
    },
    nav: computed(() =>
      STUDIO_NAVIGATION.map((item) => ({
        ...item,
        active: store.view === item.view,
        disabled: Boolean(
          studioDestination(item.view).requiresProject && !store.activeProject,
        ),
        count:
          item.view === "board"
            ? store.projectIdeas.filter((i) => i.status !== "rejected").length
            : undefined,
        working: item.view === "workflow" && Boolean(store.activeJob),
      })),
    ),
    viewLabel: computed(() => studioDestination(store.view).label),
    projectScoped: computed(
      () => studioDestination(store.view).scope === "project",
    ),
    scopeLabel: computed(() => {
      const scope = studioDestination(store.view).scope;
      if (scope === "project")
        return store.activeProject?.settings.projectName ?? "Select a project";
      return scope === "vault" ? "Vault workspace" : "Channel workspace";
    }),
    providerSummary: computed(() =>
      workflowProviderSummary(state.value?.settings ?? defaultSettings()),
    ),
    isDemo: computed(
      () =>
        workflowProviderSummary(state.value?.settings ?? defaultSettings())
          .mode === "demo",
    ),
    paused: computed(() => state.value?.settings.paused ?? true),
    reviewCount: computed(
      () => store.projectIdeas.filter((i) => i.status === "review").length,
    ),
    activeIdea: computed(() =>
      state.value?.ideas.find((i) => i.id === store.activeJob?.ideaId),
    ),
    activeLabel: computed(() =>
      store.activeJob
        ? `${store.activeJob.workflow?.step.name ?? STAGE_LABELS[store.activeJob.stage]} · ${store.activeJob.ideaId}`
        : store.backgroundJobs
          ? `${store.backgroundJobs} background ${store.backgroundJobs === 1 ? "job" : "jobs"} in other projects`
          : state.value?.settings.paused
            ? "Agents standing by"
            : "Watching the queue",
    ),
    dockTitle: computed(() =>
      store.activeJob
        ? `${store.activeJob.provider === "demo" ? "Simulation" : store.activeJob.provider === "herdr" ? "Herdr · Claude Code" : "Claude Code"} · ${store.activeJob.workflow?.step.name ?? STAGE_LABELS[store.activeJob.stage]}`
        : "",
    ),
    stages: computed(() =>
      workflowDefinition(state.value?.settings ?? defaultSettings()).steps.map(
        (step, index) => ({
          stage: step.id,
          number: index + 1,
          label: step.name,
          enabled: step.kind !== "ai" || step.automatic,
          working: store.activeJob?.workflow?.step.id === step.id,
        }),
      ),
    ),
    events: computed(() =>
      [...(state.value?.events ?? [])]
        .reverse()
        .slice(0, 30)
        .map((event) => ({ ...event, when: relativeTime(event.createdAt) })),
    ),
    openEvent: (ideaId?: string) => {
      if (ideaId) void actions.openIdea(ideaId);
    },
    manageProjects: () => {
      store.navigate("projects");
    },
    copyProjectId: () => {
      const id = store.state?.activeProjectId;
      if (!id) return;
      if (!navigator.clipboard?.writeText) {
        store.notify("Select the project ID to copy it manually.", true);
        return;
      }
      void navigator.clipboard.writeText(id).then(
        () => store.notify("Project ID copied."),
        () => store.notify("Select the project ID to copy it manually.", true),
      );
    },
    togglePause: () => {
      if (state.value)
        void actions.changeSettings({ paused: !state.value.settings.paused });
    },
    startHelp: () => {
      store.help = false;
      store.openWorkflowTool("runs");
    },
  });
}

/** Root binding of a CoForge view: subscribes to the studio and to runtime notices for the view's lifetime. */
export function useStudioApp() {
  const context = useCoforge();
  const shell = useStudioShell();
  let observed: HTMLElement | undefined;
  let resize: ResizeObserver | undefined;
  let stopInset = () => {};
  const elementNode = (value: unknown): value is HTMLElement =>
    Boolean(
      value &&
      typeof value === "object" &&
      Reflect.get(value, "nodeType") === 1 &&
      typeof Reflect.get(value, "getBoundingClientRect") === "function" &&
      Reflect.get(value, "style"),
    );
  const bindRoot = (value: unknown) => {
    if (!elementNode(value) || value === observed) return;
    resize?.disconnect();
    stopInset();
    observed = value;
    const update = () => {
      const width = value.getBoundingClientRect().width;
      if (!width) return;
      shell.store.narrowLayout = width < 1050;
      if (!shell.store.rightPanelManual)
        shell.store.rightPanelCollapsed = shell.store.narrowLayout;
    };
    stopInset = observeHostStatusInset(value);
    const Resize = value.ownerDocument.defaultView?.ResizeObserver;
    update();
    if (Resize) {
      resize = new Resize(update);
      resize.observe(value);
    }
  };
  onBeforeUnmount(() => {
    resize?.disconnect();
    stopInset();
  });
  const failure = ref(context.startupError());
  let stops: Array<() => void> = [];
  onMounted(() => {
    stops = [
      context.studio.subscribe((state) => {
        shell.store.state = state;
      }),
      context.onNotice((notice) => {
        shell.store.notify(notice.message, notice.error);
        failure.value = context.startupError();
      }),
    ];
  });
  onBeforeUnmount(() => {
    for (const stop of stops) stop();
    stops = [];
    shell.store.dispose();
  });
  return reactive({ shell, failure, bindRoot });
}
