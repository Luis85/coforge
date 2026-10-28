import { computed, reactive } from "vue";
import { storeToRefs } from "pinia";
import { useConfiguredWorkflowUiStore } from "../../stores/coforge-configured-workflow";
import { workflowAttemptRows } from "./configured-workflow-history";
import type { WorkflowRun } from "../../../features/coforge/domain/configured-workflow-run";
import { workflowDefinition } from "../../../features/coforge/domain/configured-workflow";
import { isActiveJob } from "../../../features/coforge/domain/workflow";
import { defaultSettings } from "../../../features/coforge/domain/seed";
import { useStudioStore } from "../../stores/coforge-studio";
import { useStudioActions } from "./use-studio-actions";
import { workflowProviderSummary } from "./agent-labels";
import {
  configuredAgentLabel,
  configuredStepProblem,
  CONFIGURED_RUN_LABELS,
} from "./configured-workflow-display";
/** The execution monitor reads each run's frozen definition; editing is a different destination. */
export function useWorkflow() {
  const store = useStudioStore();
  const actions = useStudioActions();
  const { monitorError: error, historyExpanded: expanded } = storeToRefs(
    useConfiguredWorkflowUiStore(),
  );
  const settings = computed(() => store.state?.settings ?? defaultSettings());
  const savedDefinition = computed(() => workflowDefinition(settings.value));
  const selected = computed(
    () =>
      store.projectIdeas.find(
        (idea) => idea.id === store.workflowRequestSelection,
      ) ??
      store.projectIdeas.find(
        (idea) =>
          idea.workflowRun &&
          !["finished", "stopped"].includes(idea.workflowRun.state),
      ) ??
      store.projectIdeas.find(
        (idea) => !["shipped", "rejected"].includes(idea.status),
      ) ??
      store.projectIdeas[0],
  );
  const run = computed(() => selected.value?.workflowRun);
  const definition = computed(
    () => run.value?.definition ?? savedDefinition.value,
  );
  const currentStep = computed(
    () => definition.value.steps[run.value?.cursor ?? 0],
  );
  const rows = computed(() =>
    workflowAttemptRows(store.projectIdeas, store.projectJobs),
  );
  const provider = computed(() =>
    workflowProviderSummary({ ...settings.value, workflow: definition.value }),
  );
  const blocked = computed(() => {
    const idea = selected.value;
    if (!idea) return "Select a request to run its workflow.";
    if (["shipped", "rejected", "flagged"].includes(idea.status))
      return "This request is closed or held for moderation.";
    if (
      store.projectJobs.some(
        (job) => job.ideaId === idea.id && isActiveJob(job),
      )
    )
      return "A request attempt is already queued or running.";
    if (
      run.value &&
      [
        "running",
        "waiting-human",
        "finished",
        "awaiting-review",
        "stopped",
      ].includes(run.value.state)
    )
      return CONFIGURED_RUN_LABELS[run.value.state];
    return currentStep.value?.kind === "ai"
      ? configuredStepProblem(
          currentStep.value,
          store.activeProject,
          store.state?.runtime,
          idea,
          run.value,
        )
      : "";
  });
  function perform(work: () => Promise<boolean>) {
    error.value = "";
    void work().then((ok) => {
      if (!ok)
        error.value =
          store.toasts.at(-1)?.message || "The workflow could not be updated.";
    });
  }
  const terminal = (value: WorkflowRun | undefined) =>
    value && ["finished", "stopped"].includes(value.state);
  return reactive({
    store,
    error,
    expanded,
    selected,
    run,
    definition,
    currentStep,
    blocked,
    paused: computed(() => settings.value.paused),
    intervalSeconds: computed(
      () => savedDefinition.value.limits.intervalSeconds,
    ),
    providerIcon: computed(() => provider.value.icon),
    providerLabel: computed(() => provider.value.label),
    providerTitle: computed(() => provider.value.title),
    enabledCount: computed(
      () =>
        definition.value.steps.filter(
          (step) => step.kind === "ai" && step.automatic,
        ).length,
    ),
    summaryLabel: computed(() =>
      settings.value.paused ? "Automation paused" : "Automation resumed",
    ),
    runLabel: computed(() =>
      run.value ? CONFIGURED_RUN_LABELS[run.value.state] : "Not started",
    ),
    capturedEarlier: computed(() =>
      Boolean(
        run.value &&
        run.value.definition.revision !== savedDefinition.value.revision,
      ),
    ),
    canRunNext: computed(
      () => !store.busy && !blocked.value && Boolean(currentStep.value),
    ),
    canRestart: computed(
      () =>
        !store.busy &&
        Boolean(terminal(run.value)) &&
        !selected.value?.increment?.files.length &&
        !["shipped", "rejected", "flagged"].includes(
          selected.value?.status ?? "",
        ),
    ),
    canStop: computed(
      () =>
        !store.busy &&
        Boolean(
          run.value &&
          ["ready", "running", "waiting-human", "attention"].includes(
            run.value.state,
          ),
        ),
    ),
    runNextLabel: computed(
      () =>
        `${run.value?.state === "attention" ? "Retry" : run.value ? "Run" : "Start"} · ${currentStep.value?.name ?? "workflow"}`,
    ),
    steps: computed(() =>
      definition.value.steps.map((step, index) => ({
        id: step.id,
        name: step.name,
        index: index + 1,
        agent: run.value?.external && step.kind === 'ai' ? 'External MCP client' : configuredAgentLabel(step),
        current: Boolean(run.value && index === run.value.cursor),
        completed: Boolean(run.value && index < run.value.cursor),
        state:
          run.value?.attempts
            .filter((attempt) => attempt.stepId === step.id)
            .at(-1)?.status ?? "Not started",
      })),
    ),
    runCount: computed(() => rows.value.length),
    visibleRuns: computed(() =>
      expanded.value ? rows.value : rows.value.slice(0, 8),
    ),
    hasMoreRuns: computed(() => rows.value.length > 8),
    moreLabel: computed(() =>
      expanded.value
        ? "Show recent attempts"
        : `Show all ${rows.value.length} attempts`,
    ),
    runNext: () => {
      const id = selected.value?.id;
      if (id) perform(() => actions.runWorkflowStep(id));
    },
    restart: () => {
      const id = selected.value?.id;
      if (id) perform(() => actions.startWorkflow(id));
    },
    stop: () => {
      const id = selected.value?.id;
      if (id) perform(() => actions.stopWorkflow(id));
    },
    togglePause: () =>
      perform(() => actions.changeSettings({ paused: !settings.value.paused })),
    selectRequest: (event: Event) => {
      if (
        event.target &&
        "value" in event.target &&
        typeof event.target.value === "string"
      )
        store.workflowRequestSelection = event.target.value;
    },
    editWorkflow: () => store.navigate("workflow-settings"),
    editPrompt: (id: string) => {
      store.workflowStepSelection = id;
      store.navigate("workflow-settings");
    },
    openIdea: (id: string) => {
      void actions.openIdea(id);
    },
    cancel: (id: string) => perform(() => actions.cancelJob(id)),
    toggleExpanded: () => {
      expanded.value = !expanded.value;
    },
  });
}
export type WorkflowModel = ReturnType<typeof useWorkflow>;
