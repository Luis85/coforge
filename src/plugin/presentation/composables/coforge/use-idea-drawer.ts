import {
  computed,
  inject,
  provide,
  reactive,
  ref,
  watch,
  type InjectionKey,
} from "vue";
import type {
  AgentJob,
  IdeaAction,
} from "../../../features/coforge/domain/types";
import { isActiveJob } from "../../../features/coforge/domain/workflow";
import { useStudioStore } from "../../stores/coforge-studio";
import { avatarStyle, formatTime } from "./format";
import { useDialogFocus } from "./use-dialog-focus";
import { useStudioActions } from "./use-studio-actions";
import { ideaProjectId } from "../../../features/coforge/domain/projects";
import { ideaWorkflowAction } from "./idea-workflow-action";
import { projectFeatureEnabled } from '../../../features/coforge/domain/project-features';
import { currentDesignSpecification } from "./use-idea-design";
import { ideaRunHistory } from './idea-run-history';
import { backgroundRetryCandidate } from './background-build-retry-display';
import { failedWorkflowJobId } from './attempt-failure-evidence';

export type IdeaDrawerTab = "overview" | "plan" | "increment" | "activity" | 'workflow' | 'sessions' | 'ai-costs';
const TABS: ReadonlyArray<{ value: IdeaDrawerTab; label: string }> = [
  { value: "overview", label: "Overview" },
  { value: 'sessions', label: 'Sessions' },
  { value: "plan", label: "Plan & Design" },
  { value: "increment", label: "Increment" },
  { value: 'workflow', label: 'Workflow runs' },
  { value: 'ai-costs', label: 'AI costs' },
  { value: "activity", label: "Activity" },
];
/** Contributor ids the streamer votes under (the studio votes as the simulator's `streamer`). */
const STREAMER_IDS = ["simulator:streamer", "local:streamer", "streamer"];
const NOTE_REQUIRED =
  "Add a review note of at least 3 characters so the next step has the right context.";

const jobTitle = (job: AgentJob): string =>
  `${job.provider === "demo" ? "Simulating" : "Agent running"}: ${job.workflow?.step.name ?? (job.stage === "implement" ? "implementation" : job.stage)}`;

function createIdeaDrawer() {
  const store = useStudioStore();
  const actions = useStudioActions();
  const tab = computed({
    get: () => store.drawerTab,
    set: (value: IdeaDrawerTab) => {
      store.drawerTab = value;
    },
  });
  const note = ref("");
  const error = ref("");
  const pending = ref("");
  const close = () => {
    store.select(null);
  };
  const focus = useDialogFocus(close, ".cf-idea-close");

  const idea = computed(() => store.selectedIdea);
  const state = computed(() => store.state);
  const operatorHeld = computed(() => Boolean(idea.value && state.value?.workflowStopHolds?.includes(idea.value.id)));
  const preservedReview = computed(() => operatorHeld.value && idea.value?.status === 'inbox' && Boolean(idea.value.increment) && idea.value.workflowRun?.state === 'awaiting-review');
  const reviewable = computed(() => (idea.value?.status === 'review' || preservedReview.value) && !idea.value?.polishingRuns?.some(pass => pass.review === 'pending'));
  const author = computed(() =>
    state.value?.contributors.find(
      (person) => person.id === idea.value?.authorId,
    ),
  );
  const ideaJobs = computed(
    () =>
      state.value?.jobs.filter((job) => job.ideaId === idea.value?.id) ?? [],
  );
  const activeJob = computed(() => ideaJobs.value.find(isActiveJob));
  const project = computed(() =>
    state.value?.projects?.find(
      (project) =>
        project.id ===
        (idea.value ? ideaProjectId(idea.value) : state.value?.activeProjectId),
    ),
  );
  const nextAction = computed(() =>
    idea.value && projectFeatureEnabled(project.value, 'workflow')
      ? ideaWorkflowAction(idea.value, project.value, state.value?.runtime)
      : undefined,
  );
  const isBusy = computed(
    () => store.busy || Boolean(pending.value) || Boolean(activeJob.value),
  );
  const blockedBuild = computed(() => Boolean(nextAction.value?.blocked));
  const openWorkflow = () => {
    const id = idea.value?.id;
    if (!id || !(projectFeatureEnabled(project.value, 'workflow') || idea.value?.workflowRun || idea.value?.polishingRuns?.length)) return;
    store.select(id, 'workflow');
  };
  async function runConfigured() {
    const current = idea.value;
    const action = nextAction.value;
    if (!current || !action || action.blocked || isBusy.value) return;
    if (action.kind === "open") {
      openWorkflow();
      return;
    }
    if (await perform("workflow", () => actions.runWorkflowStep(current.id))) {
      if (
        store.state?.ideas.find((idea) => idea.id === current.id)?.workflowRun
          ?.state === "waiting-human"
      )
        openWorkflow();
    }
  }

  watch(
    () => store.selected,
    () => {
      note.value = "";
      error.value = "";
    },
  );

  /** Runs one drawer request at a time; resolves `true` only when the studio accepted it. */
  async function perform(
    key: string,
    operation: () => Promise<boolean>,
  ): Promise<boolean> {
    if (isBusy.value) return false;
    error.value = "";
    pending.value = key;
    try {
      return await operation();
    } finally {
      pending.value = "";
    }
  }

  async function act(kind: IdeaAction): Promise<void> {
    const current = idea.value;
    if (!current) return;
    if (
      (kind === "changes" || kind === "unflag") &&
      note.value.trim().length < 3
    ) {
      error.value = NOTE_REQUIRED;
      return;
    }
    const text = note.value.trim();
    if (
      await perform(kind, () =>
        actions.takeAction(current.id, kind, text || undefined),
      )
    )
      note.value = "";
  }

  async function cancel(jobId: string): Promise<void> {
    if (store.busy || pending.value) return;
    pending.value = "cancel";
    try {
      await actions.cancelJob(jobId);
    } finally {
      pending.value = "";
    }
  }

  return reactive({
    store,
    focus,
    idea,
    tab,
    note,
    error,
    pending,
    isBusy,
    operatorHeld,
    backgroundRetryAvailable: computed(() => backgroundRetryCandidate(idea.value)),
    preservedReview,
    reviewable,
    nextAction,
    workflowVisible: computed(() => projectFeatureEnabled(project.value, 'workflow') || Boolean(idea.value?.workflowRun) || Boolean(idea.value?.polishingRuns?.length)),
    blockedBuild,
    activeJob,
    tabs: computed(() =>
      TABS.filter(item => item.value !== 'workflow' || projectFeatureEnabled(project.value, 'workflow') || Boolean(idea.value?.workflowRun) || Boolean(idea.value?.polishingRuns?.length)).map((item) => ({
        ...item,
        active: tab.value === item.value,
        dot:
          (item.value === "plan" && Boolean(idea.value && (idea.value.plan || currentDesignSpecification(idea.value)))) ||
          (item.value === "increment" && Boolean(idea.value?.increment)),
      })),
    ),
    authorName: computed(() => author.value?.name ?? "Community member"),
    authorInitials: computed(() =>
      (author.value?.name ?? "?").slice(0, 2).toUpperCase(),
    ),
    authorStyle: computed(() => avatarStyle(author.value?.color)),
    createdLabel: computed(() =>
      idea.value ? formatTime(idea.value.createdAt) : "",
    ),
    sourceLabel: computed(() => {
      const id = idea.value?.authorId ?? "";
      return id.startsWith("twitch:")
        ? "Twitch contribution"
        : id.startsWith("api:")
          ? "Chat bridge contribution"
          : "Local contribution";
    }),
    voted: computed(() =>
      STREAMER_IDS.some((id) => idea.value?.voters.includes(id)),
    ),
    voteLocked: computed(
      () =>
        idea.value?.status === "flagged" || idea.value?.status === "rejected",
    ),
    activeJobTitle: computed(() =>
      activeJob.value ? jobTitle(activeJob.value) : "",
    ),
    activeJobLog: computed(
      () =>
        activeJob.value?.logs[activeJob.value.logs.length - 1] ??
        "Preparing the request…",
    ),
    isDemo: computed(() => nextAction.value?.demo ?? false),
    showFooter: computed(
      () =>
        Boolean(nextAction.value) ||
        preservedReview.value ||
        idea.value?.status === "review" ||
        idea.value?.status === "building",
    ),
    canAccept: computed(
      () =>
        Boolean(idea.value?.increment) &&
        reviewable.value &&
        (!idea.value?.workflowRun ||
          idea.value.workflowRun.state === "awaiting-review"),
    ),
    nextLabel: computed(() => nextAction.value?.label ?? ""),
    nextHelp: computed(
      () => nextAction.value?.blocked || nextAction.value?.description || "",
    ),
    canFinalReview: computed(
      () =>
        !idea.value?.polishingRuns?.some(pass => pass.review === 'pending') &&
        (!idea.value?.workflowRun || idea.value.workflowRun.state === "awaiting-review"),
    ),
    runConfigured: () => {
      void runConfigured();
    },
    openWorkflow,
    activity: computed(() =>
      (state.value?.events ?? [])
        .filter((event) => event.ideaId === idea.value?.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((event) => ({ ...event, when: formatTime(event.createdAt) })),
    ),
    jobs: computed(() =>
      [...ideaJobs.value].reverse().map(ideaRunHistory),
    ),
    failureJobId: computed(() => failedWorkflowJobId(idea.value?.workflowRun, ideaJobs.value, idea.value?.id)),
    close,
    selectTab: (value: IdeaDrawerTab) => {
      tab.value = value;
    },
    perform,
    fail: (message: string) => {
      error.value = message;
    },
    act: (kind: IdeaAction) => {
      void act(kind);
    },
    vote: () => {
      const id = idea.value?.id;
      if (id) void perform("vote", () => actions.vote(id));
    },
    openNote: () => {
      const id = idea.value?.id;
      if (id) void actions.openNote(id);
    },
    cancelJob: (jobId: string) => {
      void cancel(jobId);
    },
  });
}

export type IdeaDrawerModel = ReturnType<typeof createIdeaDrawer>;
const DRAWER: InjectionKey<IdeaDrawerModel> = Symbol("coforge-idea-drawer");

/** Root binding of the idea inspection drawer; shares its state with the drawer's sections. */
export function useIdeaDrawer(): IdeaDrawerModel {
  const model = createIdeaDrawer();
  provide(DRAWER, model);
  return model;
}

/** The enclosing drawer's state, for a section rendered inside `IdeaDrawer.vue`. */
export function useIdeaDrawerContext(): IdeaDrawerModel {
  const model = inject(DRAWER);
  if (!model)
    throw new Error("Idea drawer sections must be rendered inside IdeaDrawer.");
  return model;
}
