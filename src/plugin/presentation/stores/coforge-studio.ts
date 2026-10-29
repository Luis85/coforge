import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { AppState } from "../../features/coforge/domain/types";
import { configurationProblem } from "./configuration-guard";
import { projectIdeas as scopedIdeas } from "../../features/coforge/domain/projects";
import type { BroadcastPage, StreamPage, WorkflowPage, SettingsPage } from "./studio-pages";
import { studioRoot } from "./studio-destinations";

export type StudioView =
  | "council"
  | "coworkers"
  | "board"
  | "stream"
  | "twitch-operations"
  | "workflow"
  | "community"
  | "settings"
  | "projects"
  | "population"
  | 'economy'
  | "operations"
  | "community-settings"
  | "broadcast"
  | "statistics"
  | "finance"
  | "ai-costs"
  | "schedule"
  | "workflow-settings";
export type IdeaDrawerTab = "overview" | "plan" | "increment" | "activity";
export interface Toast {
  id: number;
  message: string;
  error: boolean;
}

/** Per-view projection of the studio state plus view-local navigation, overlays and feedback. */
export const useStudioStore = defineStore("coforge-studio", () => {
  const state = ref<AppState | null>(null);
  const temporaryExampleRevision = ref(0);
  const temporaryExamples = new Map<string, number>();
  const beginTemporaryExample = (id: string) =>
    temporaryExamples.set(id, temporaryExampleRevision.value);
  const temporaryExampleExpired = (id: string) =>
    temporaryExamples.has(id) &&
    temporaryExamples.get(id) !== temporaryExampleRevision.value;
  const closeTemporaryExamples = () => {
    temporaryExampleRevision.value++;
  };
  const view = ref<StudioView>("broadcast");
  const navigationRevision = ref(0);
  const selected = ref<string | null>(null);
  const drawerTab = ref<IdeaDrawerTab>("overview");
  const chatDraft = ref({
    username: "Local tester",
    text: "",
    testing: false,
    sending: false,
    error: "",
  });
  const promptStage =
    ref<import("../../features/coforge/domain/types").AgentStage>("screen");
  const promptPreviewIdea = ref("");
  const creating = ref(false);
  const help = ref(false);
  const activityOpen = ref(false);
  const leftPanelCollapsed = ref(false);
  const rightPanelCollapsed = ref(false);
  const rightPanelManual = ref(false);
  const narrowLayout = ref(false);
  const layoutId = `cf-layout-${crypto.randomUUID()}`;
  const dirtySettings = ref(false);
  const dirtyWorkflow = ref(false);
  const workflowStepSelection = ref("");
  const workflowRequestSelection = ref("");
  const dirtyCommunitySettings = ref(false);
  const dirtyEconomy = ref(false);
  const streamTool = ref<StreamPage>("channel");
  const workflowTool = ref<WorkflowPage>("runs");
  const settingsTool = ref<SettingsPage>("general");
  const broadcastTool = ref<BroadcastPage>("live");
  const setupStep = ref(0);
  const historySelection = ref("");
  const statisticsStream = ref("");
  const statisticsComparisons = ref<string[]>([]);
  const statisticsMetric =
    ref<
      import("../../features/coforge/domain/statistics-metrics").StatisticsMetricId
    >("viewers");
  const statisticsCursor = ref(0);
  const statisticsPage = ref(0);
  const studioExampleEnabled = ref(false);
  const studioExampleRevision = ref(0);
  const obsEditorOpen = ref(false);
  const obsEditorScene = ref("");
  const obsEditorDetail = ref<
    import("../../features/coforge/domain/obs-scenes").ObsSceneDetail | null
  >(null);
  const obsNewSceneName = ref("");
  const obsRenameSceneName = ref("");
  const obsCopySceneName = ref("");
  const obsExistingSource = ref("");
  let studioExampleDraft: {
    scene: string;
    detail: typeof obsEditorDetail.value;
    name: string;
    rename: string;
    copy: string;
    source: string;
  } | null = null;
  function beginStudioExample() {
    if (studioExampleEnabled.value) return;
    studioExampleDraft = {
      scene: obsEditorScene.value,
      detail: obsEditorDetail.value,
      name: obsNewSceneName.value,
      rename: obsRenameSceneName.value,
      copy: obsCopySceneName.value,
      source: obsExistingSource.value,
    };
    studioExampleEnabled.value = true;
    studioExampleRevision.value++;
  }
  function exitStudioExample() {
    if (!studioExampleEnabled.value) return;
    studioExampleEnabled.value = false;
    studioExampleRevision.value++;
    obsEditorScene.value = studioExampleDraft?.scene ?? "";
    obsEditorDetail.value = studioExampleDraft?.detail ?? null;
    obsNewSceneName.value = studioExampleDraft?.name ?? "";
    obsRenameSceneName.value = studioExampleDraft?.rename ?? "";
    obsCopySceneName.value = studioExampleDraft?.copy ?? "";
    obsExistingSource.value = studioExampleDraft?.source ?? "";
    studioExampleDraft = null;
  }
  const setupRequested = ref(false);
  const moderationTarget = ref<{
    channelId: string;
    username: string;
    userId?: string;
    messageId?: string;
  } | null>(null);
  const pending = ref(0);
  const toasts = ref<Toast[]>([]);
  const timers = new Set<number>();
  let toastId = 0;

  const busy = computed(() => pending.value > 0);
  const activeProject = computed(() =>
    state.value?.projects?.find(
      (project) => project.id === state.value?.activeProjectId,
    ),
  );
  const projectIdeas = computed(() =>
    state.value ? scopedIdeas(state.value) : [],
  );
  const projectJobs = computed(
    () =>
      state.value?.jobs.filter(
        (job) => job.projectId === state.value?.activeProjectId,
      ) ?? [],
  );
  const activeJob = computed(
    () =>
      projectJobs.value.find((j) => j.status === "running") ??
      projectJobs.value.find((j) => j.status === "queued"),
  );
  const backgroundJobs = computed(
    () =>
      state.value?.jobs.filter(
        (job) =>
          job.projectId !== state.value?.activeProjectId &&
          (job.status === "running" || job.status === "queued"),
      ).length ?? 0,
  );
  const selectedIdea = computed(() =>
    state.value?.ideas.find((i) => i.id === selected.value),
  );

  function dismiss(id: number) {
    toasts.value = toasts.value.filter((toast) => toast.id !== id);
  }
  function notify(message: string, error = false) {
    const id = ++toastId;
    toasts.value = [...toasts.value.slice(-2), { id, message, error }];
    const timer = window.setTimeout(
      () => {
        timers.delete(timer);
        dismiss(id);
      },
      error ? 8500 : 4500,
    );
    timers.add(timer);
  }
  function configurationIssue(next?: StudioView): string {
    return configurationProblem(
      {
        settings: dirtySettings.value && (!next || studioRoot(next) !== "settings"),
        "community-settings": dirtyCommunitySettings.value,
        "workflow-settings": dirtyWorkflow.value,
          economy: dirtyEconomy.value,
      },
      next,
    );
  }
  function changeView(next: StudioView) {
    const problem = configurationIssue(next);
    if (problem) {
      notify(problem, true);
      return false;
    }
    view.value = next;
    navigationRevision.value++;
    activityOpen.value = false;
    return true;
  }
  function navigate(next: StudioView) {
    if (next === "settings" && studioRoot(view.value) === "settings") return true;
    const destination =
      (next === "workflow" || (next === "settings" && settingsTool.value === "workflow")) &&
      (view.value === "workflow-settings" || workflowTool.value === "settings")
        ? "workflow-settings"
        : next === "settings" && settingsTool.value === "workflow" ? "workflow" : next;
    if (!changeView(destination)) return false;
    if (destination === "workflow" || destination === "workflow-settings") settingsTool.value = "workflow";
    if (destination === "workflow-settings") workflowTool.value = "settings";
    return true;
  }
  function openStreamTool(next: StreamPage) {
    if (navigate("stream")) streamTool.value = next;
  }
  function openWorkflowTool(next: WorkflowPage) {
    if (changeView(next === "settings" ? "workflow-settings" : "workflow")) {
      settingsTool.value = "workflow";
      workflowTool.value = next;
    }
  }
  function openSettingsTool(next: SettingsPage) {
    if (next === "workflow") {
      if (navigate("workflow")) settingsTool.value = next;
    } else if (changeView("settings")) settingsTool.value = next;
  }
  function select(id: string | null, tab: IdeaDrawerTab = "overview") {
    selected.value = id;
    drawerTab.value = tab;
    activityOpen.value = false;
  }
  function dispose() {
    for (const timer of timers) window.clearTimeout(timer);
    timers.clear();
    temporaryExamples.clear();
  }

  /** Runs a studio request, reports its outcome as a toast and rethrows failures for the caller. */
  async function mutate<T>(
    work: () => Promise<T>,
    success?: string | ((result: T) => string),
  ): Promise<T> {
    pending.value++;
    try {
      const result = await work();
      const message = typeof success === "function" ? success(result) : success;
      if (message) notify(message);
      return result;
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "That action could not be completed.",
        true,
      );
      throw error;
    } finally {
      pending.value = Math.max(0, pending.value - 1);
    }
  }

  return {
    state,
    temporaryExampleRevision,
    beginTemporaryExample,
    temporaryExampleExpired,
    closeTemporaryExamples,
    view,
    navigationRevision,
    selected,
    drawerTab,
    chatDraft,
    promptStage,
    promptPreviewIdea,
    creating,
    help,
    activityOpen,
    leftPanelCollapsed,
    rightPanelCollapsed,
    rightPanelManual,
    narrowLayout,
    layoutId,
    dirtySettings,
    dirtyCommunitySettings,
    dirtyEconomy,
    dirtyWorkflow,
    configurationIssue,
    workflowStepSelection,
    workflowRequestSelection,
    streamTool,
    workflowTool,
    settingsTool,
    broadcastTool,
    setupStep,
    setupRequested,
    historySelection,
    statisticsStream,
    statisticsComparisons,
    statisticsMetric,
    statisticsCursor,
    statisticsPage,
    moderationTarget,
    pending,
    toasts,
    busy,
    activeProject,
    projectIdeas,
    projectJobs,
    backgroundJobs,
    studioExampleEnabled,
    studioExampleRevision,
    beginStudioExample,
    exitStudioExample,
    obsEditorOpen,
    obsEditorScene,
    obsEditorDetail,
    obsNewSceneName,
    obsRenameSceneName,
    obsCopySceneName,
    obsExistingSource,
    activeJob,
    selectedIdea,
    notify,
    dismiss,
    navigate,
    openStreamTool,
    openWorkflowTool,
    openSettingsTool,
    select,
    mutate,
    dispose,
  };
});
