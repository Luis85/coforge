import { computed, reactive, watch } from "vue";
import { useCouncilEntry } from './use-council-entry';
import { uncertainTaskAttempt } from '../../../features/coforge/application/agent-task';
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
/** Shared workflow workspace; execution reads captured definitions and settings edit future runs. */
export function useWorkflow() {
  const openCouncil = useCouncilEntry();
  const store = useStudioStore();
  const actions = useStudioActions();
  const {
    monitorError: error,
    historyExpanded: expanded,
    nudgeRecoveryKey,
    nudgeRecoveryConsent,
  } = storeToRefs(useConfiguredWorkflowUiStore());
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
  watch(() => `${run.value?.id}:${run.value?.revision}`, key => { if (key !== nudgeRecoveryKey.value) { nudgeRecoveryKey.value = key; nudgeRecoveryConsent.value = false; } });
  const uncertainNudges = computed(() => run.value?.attempts.filter(uncertainTaskAttempt) ?? []);
  const councilAttempt = computed(() => run.value?.attempts.find(attempt => attempt.id === run.value?.activeAttemptId && attempt.kind === 'council' && attempt.nudgeRunId) ?? [...(run.value?.attempts ?? [])].reverse().find(attempt => attempt.kind === 'council' && attempt.nudgeRunId));
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
    workflowProviderSummary(
      { ...settings.value, workflow: definition.value },
      run.value?.external,
    ),
  );
  const enabledCount = computed(() => run.value?.external ? 0 : definition.value.steps.filter(step => (step.kind === 'ai' || step.kind === 'council' || step.kind === 'nudge') && step.automatic).length);
  const blocked = computed(() => {
    const idea = selected.value;
    if (!idea) return "Select a request to run its workflow.";
    if (uncertainNudges.value.length) return 'Inspect and acknowledge the uncertain task or cancellation before starting more work.';
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
    page: computed(() =>
      store.view === "workflow-settings" ? "settings" : store.workflowTool,
    ),
    error,
    expanded,
    selected,
    run,
    definition,
    currentStep,
    councilAttempt,
    councilName: computed(() => { const id = councilAttempt.value?.stepId; const step = run.value?.definition.steps.find(item => item.id === id); return run.value?.councilBindings?.find(item => item.stepId === id)?.binding.councilName ?? (step?.kind === 'council' ? step.councilId : 'Council'); }),
    canCheckCouncil: computed(() => Boolean(councilAttempt.value && councilAttempt.value.id === run.value?.activeAttemptId && ['running', 'attention'].includes(run.value?.state ?? ''))),
    checkCouncil: () => { if (selected.value) perform(() => actions.runWorkflowStep(selected.value!.id)); },
    inspectCouncil: (childRunId = councilAttempt.value?.nudgeRunId, projectId = run.value?.projectId ?? '') => {
      return childRunId ? openCouncil({ page: 'monitor', runId: childRunId, projectId }) : false;
    },
    uncertainNudges, nudgeRecoveryConsent,
    changeNudgeRecovery: (event: Event) => { const target = event.target; if (target && 'checked' in target && typeof target.checked === 'boolean') nudgeRecoveryConsent.value = target.checked; },
    acknowledgeNudge: () => { if (selected.value && run.value) perform(() => actions.acknowledgeWorkflowNudge(selected.value!.id, run.value!.revision, nudgeRecoveryConsent.value)); },
    blocked,
    paused: computed(() => settings.value.paused),
    intervalSeconds: computed(
      () => savedDefinition.value.limits.intervalSeconds,
    ),
    providerIcon: computed(() => provider.value.icon),
    providerLabel: computed(() => provider.value.label),
    providerTitle: computed(() => provider.value.title),
    enabledCount,
    automaticStepLabel: computed(() => run.value?.external ? 'AI steps require explicit client calls' : `${enabledCount.value} ${definition.value.steps.some(step => (step.kind === 'council' || step.kind === 'nudge') && step.automatic) ? 'steps' : 'AI steps'} automatic`),
    cadenceLabel: computed(() => run.value?.external ? 'Project automation does not advance this run' : `New automatic runs · ${savedDefinition.value.limits.intervalSeconds}s interval`),
    summaryLabel: computed(() =>
      run.value?.external
        ? "External MCP run"
        : settings.value.paused
          ? "Automation paused"
          : "Automation resumed",
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
        !uncertainNudges.value.length &&
        !run.value?.attempts.some(attempt => attempt.councilCancellation === 'requested') &&
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
    runNextLabel: computed(() =>
      !run.value && selected.value?.lastError
        ? "Retry starting workflow"
        : `${run.value?.state === "attention" ? "Retry" : run.value ? "Run" : "Start"} · ${currentStep.value?.name ?? "workflow"}`,
    ),
    nextActionHeading: computed(() => {
      if (!run.value && selected.value?.lastError)
        return "Workflow start needs attention";
      if (run.value?.state === "waiting-human") return "Your decision is next";
      if (run.value?.state === "awaiting-review")
        return "Review the code changes";
      if (run.value?.state === "running") return "An attempt is in progress";
      if (run.value?.state === "finished")
        return selected.value?.status === "shipped"
          ? "Code changes accepted"
          : "This workflow is complete";
      if (run.value?.state === "stopped") return "This workflow is stopped";
      return `${run.value?.state === "attention" ? "Review before retrying" : run.value ? "Next step" : "Start with"} · ${currentStep.value?.name ?? "workflow"}`;
    }),
    nextActionHelp: computed(() => {
      if (!run.value && selected.value?.lastError)
        return selected.value.lastError;
      if (run.value?.state === "running")
        return "Wait for a validated result. A delivered prompt alone does not complete a step.";
      if (run.value?.state === "waiting-human")
        return "Read the instructions and complete the required decision below. Completing a checkpoint does not approve code changes.";
      if (run.value?.state === "awaiting-review")
        return "Inspect the actual changes on the request before accepting or requesting revisions.";
      if (run.value?.state === "finished")
        return selected.value?.status === "shipped"
          ? "Final review accepted this request. The completed workflow and its captured results remain available below."
          : "Results and attempts remain available below. A new run captures the latest saved workflow.";
      if (run.value?.state === "stopped")
        return "The captured history is retained. Starting a new run uses the latest saved workflow.";
      if (blocked.value) return blocked.value;
      if (currentStep.value?.kind === 'council') return 'This step admits a captured live Council discussion and waits for its complete published answer. Council execution and recovery controls remain in The Council.';
      if (currentStep.value?.kind === 'nudge') return 'This step creates a separate CoWorker task and continues after admission. Follow its results in The Council.';
      return currentStep.value?.kind === "ai"
        ? `${configuredAgentLabel(currentStep.value)}. Starting this step captures its inputs and waits for the required result.`
        : "This step waits for explicit streamer input before the workflow advances.";
    }),
    progressLabel: computed(
      () =>
        `${Math.min(run.value?.cursor ?? 0, definition.value.steps.length)} of ${definition.value.steps.length} steps completed`,
    ),
    steps: computed(() =>
      definition.value.steps.map((step, index) => ({
        id: step.id,
        name: step.name,
        index: index + 1,
        agent:
          run.value?.external && step.kind === "ai"
            ? "External MCP client"
            : configuredAgentLabel(step),
        current:
          index === (run.value?.cursor ?? 0) &&
          !run.value?.state?.match(/^(finished|stopped|awaiting-review)$/u),
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
    selectPage: (page: import("../../stores/studio-pages").WorkflowPage) =>
      store.openWorkflowTool(page),
    editWorkflow: () => store.openWorkflowTool("settings"),
    editPrompt: (id: string) => {
      store.workflowStepSelection = id;
      store.openWorkflowTool("settings");
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
