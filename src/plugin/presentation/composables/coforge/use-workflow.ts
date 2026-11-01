import { computed, reactive, ref, watch } from "vue";
import { useCouncilEntry } from './use-council-entry';
import { uncertainTaskAttempt } from '../../../features/coforge/application/agent-task';
import { storeToRefs } from "pinia";
import { useConfiguredWorkflowUiStore } from "../../stores/coforge-configured-workflow";
import { workflowAttemptRows } from "./configured-workflow-history";
import type { WorkflowRun } from "../../../features/coforge/domain/configured-workflow-run";
import { workflowDefinition } from "../../../features/coforge/domain/configured-workflow";
import { isActiveJob } from "../../../features/coforge/domain/workflow";
import { defaultSettings } from "../../../features/coforge/domain/seed";
import { ideaProjectId } from '../../../features/coforge/domain/projects';
import { useStudioStore } from "../../stores/coforge-studio";
import { useStudioActions } from "./use-studio-actions";
import { workflowProviderSummary } from "./agent-labels";
import { reviewedBackgroundRetryRequired } from './background-build-retry-display';
import { nextWorkflowStep, onlyOwnerScreeningRemains, exemptScreeningStep } from '../../../features/coforge/domain/owner-screening';
import { failedWorkflowJobId } from './attempt-failure-evidence';
import { isManagedWorkflowSession } from '../../../features/coforge/domain/workflow-lifecycle';
import { managedWorkflowContinuation } from '../../../features/coforge/application/managed-workflow-continuation';
import {
  configuredAgentLabel,
  configuredStepProblem,
  CONFIGURED_RUN_LABELS,
} from "./configured-workflow-display";
/** Shared workflow workspace; execution reads captured definitions and settings edit future runs. */
export function useWorkflow(ideaId?: () => string | undefined) {
  const openCouncil = useCouncilEntry();
  const store = useStudioStore();
  const actions = useStudioActions();
  const shared = storeToRefs(useConfiguredWorkflowUiStore());
  const scoped = { monitorError: ref(''), historyExpanded: ref(false), nudgeRecoveryKey: ref(''), nudgeRecoveryConsent: ref(false) };
  const {
    monitorError: error,
    historyExpanded: expanded,
    nudgeRecoveryKey,
    nudgeRecoveryConsent,
  } = ideaId ? scoped : shared;
  const selected = computed(() => ideaId ? store.state?.ideas.find(idea => idea.id === ideaId()) : undefined);
  const project = computed(() => selected.value
    ? store.state?.projects?.find(project => project.id === ideaProjectId(selected.value!))
    : ideaId ? undefined : store.activeProject);
  const settings = computed(() => project.value?.settings ?? defaultSettings());
  const savedDefinition = computed(() => workflowDefinition(settings.value));
  const run = computed(() => selected.value?.workflowRun);
  const pendingPolishing = computed(() => Boolean(selected.value?.polishingRuns?.some(pass => pass.review === 'pending')));
  const operatorHeld = computed(() => Boolean(selected.value && store.state?.workflowStopHolds?.includes(selected.value.id)));
  const preservedReview = computed(() => operatorHeld.value && Boolean(selected.value?.increment) && run.value?.state === 'awaiting-review');
  watch(() => `${selected.value?.id}:${run.value?.id}:${run.value?.revision}`, key => { if (key !== nudgeRecoveryKey.value) { nudgeRecoveryKey.value = key; nudgeRecoveryConsent.value = false; } });
  watch(() => `${selected.value?.id}:${run.value?.id}`, () => { error.value = ''; });
  const uncertainNudges = computed(() => run.value?.attempts.filter(uncertainTaskAttempt) ?? []);
  const councilAttempt = computed(() => run.value?.attempts.find(attempt => attempt.id === run.value?.activeAttemptId && attempt.kind === 'council' && attempt.nudgeRunId) ?? [...(run.value?.attempts ?? [])].reverse().find(attempt => attempt.kind === 'council' && attempt.nudgeRunId));
  const definition = computed(
    () => run.value?.definition ?? savedDefinition.value,
  );
  const currentStep = computed(
    () => nextWorkflowStep(definition.value, selected.value, run.value),
  );
  const sessionJob = computed(() => (store.state?.jobs ?? []).filter(job => job.ideaId === selected.value?.id && job.projectId === project.value?.id
    && job.workflow !== undefined && job.workflow.runId === run.value?.id && job.workflow.step.id === currentStep.value?.id).at(-1));
  const managedSession = computed(() => isManagedWorkflowSession(sessionJob.value?.workflow));
  const ordinaryNativeTask = computed(() => currentStep.value?.kind === 'ai' && !run.value?.external && ['claude', 'codex'].includes(currentStep.value.provider));
  const continuation = computed(() => run.value?.state === 'attention' ? managedWorkflowContinuation(run.value, store.state?.jobs ?? []) : undefined);
  const rows = computed(() =>
    workflowAttemptRows(store.projectIdeas, store.projectJobs),
  );
  const provider = computed(() =>
    workflowProviderSummary(
      { ...settings.value, workflow: definition.value },
      run.value?.external,
      Boolean(run.value),
    ),
  );
  const enabledCount = computed(() => run.value?.external ? 0 : definition.value.steps.filter(step => (step.kind === 'ai' || step.kind === 'council' || step.kind === 'nudge') && step.automatic).length);
  const blocked = computed(() => {
    const idea = selected.value;
    if (!idea) return "Select a request to run its workflow.";
    if (operatorHeld.value) return 'Right-click this card and choose Restart workflow';
    if (pendingPolishing.value) return 'Review or dismiss the pending Improve & polish pass below before continuing the main workflow.';
    if (continuation.value === 'unverified') return 'The original agent’s state must be confirmed before this task can continue. Open Sessions or its execution details.';
    if ((store.state?.jobs ?? []).some(job => job.ideaId === idea.id && job.durable && job.durable.acknowledged !== true
      && !(continuation.value === 'settling' && job.id === sessionJob.value?.id))) return 'The original background Build is not acknowledged. Inspect or recover that execution before starting more work for this request.';
    if (uncertainNudges.value.length) return 'Inspect and acknowledge the uncertain task or cancellation before starting more work.';
    if (["shipped", "rejected", "flagged"].includes(idea.status))
      return "This request is closed or held for moderation.";
    if (
      (store.state?.jobs ?? []).some(
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
    if (reviewedBackgroundRetryRequired(run.value)) return 'This Build requires a fresh reviewed background retry. Inspect its current snapshot before confirming another attempt.';
    return currentStep.value?.kind === "ai"
      ? configuredStepProblem(
          currentStep.value,
          project.value,
          store.state?.runtime,
          idea,
          run.value,
          !run.value && currentStep.value.coworkerId !== undefined,
        )
      : "";
  });
  function perform(work: () => Promise<boolean>) {
    const requestId = selected.value?.id;
    const runId = run.value?.id;
    error.value = "";
    void work().then((ok) => {
      if (selected.value?.id !== requestId || run.value?.id !== runId) return;
      if (!ok)
        error.value =
          store.toasts.at(-1)?.message || "The workflow could not be updated.";
    });
  }
  const terminal = (value: WorkflowRun | undefined) =>
    value && ["finished", "stopped"].includes(value.state);
  async function editDefinition(stepId?: string) {
    const owner = project.value;
    if (!owner) return;
    const problem = store.configurationIssue(owner.id === store.activeProject?.id ? 'workflow-settings' : undefined);
    if (problem) { store.notify(problem, true); return; }
    if (owner.id !== store.activeProject?.id && !(await actions.selectProject(owner.id))) return;
    if (stepId) store.workflowStepSelection = stepId;
    store.select(null);
    store.openWorkflowTool('settings');
  }
  return reactive({
    store,
    page: computed(() =>
      store.view === 'workflow-settings' && !['settings', 'limits', 'templates'].includes(store.workflowTool) ? 'settings' : store.workflowTool,
    ),
    error,
    expanded,
    selected,
    run,
    operatorHeld,
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
    failureJobId: computed(() => failedWorkflowJobId(run.value, store.projectJobs, selected.value?.id)),
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
      preservedReview.value ? 'Stopped — preserved changes need review' : operatorHeld.value ? 'Stopped' : run.value ? CONFIGURED_RUN_LABELS[run.value.state] : "Not started",
    ),
    capturedEarlier: computed(() =>
      Boolean(
        run.value &&
        run.value.definition.revision !== savedDefinition.value.revision,
      ),
    ),
    canRunNext: computed(
      () => !store.busy && !blocked.value && !reviewedBackgroundRetryRequired(run.value) && (Boolean(currentStep.value) || onlyOwnerScreeningRemains(definition.value, selected.value, run.value)),
    ),
    pendingPolishing,
    canRestart: computed(
      () =>
        !store.busy &&
        !pendingPolishing.value &&
        !operatorHeld.value &&
        !uncertainNudges.value.length &&
        !(store.state?.jobs ?? []).some(job => job.ideaId === selected.value?.id && job.durable && job.durable.acknowledged !== true) &&
        !run.value?.attempts.some(attempt => attempt.councilCancellation === 'requested') &&
        (!managedSession.value || run.value?.state === 'finished') &&
        Boolean(terminal(run.value)) &&
        !selected.value?.increment?.files.length &&
        !["shipped", "rejected", "flagged"].includes(
          selected.value?.status ?? "",
        ),
    ),
    canStop: computed(
      () =>
        !store.busy &&
        !operatorHeld.value &&
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
        : `${run.value?.state === "attention" ? ordinaryNativeTask.value || managedSession.value ? "Continue" : "Retry" : run.value ? "Run" : "Start"} · ${currentStep.value?.name ?? "workflow"}`,
    ),
    nextActionHeading: computed(() => {
      if (pendingPolishing.value) return 'Review Improve & polish pass';
      if (preservedReview.value) return 'Stopped — preserved changes need review';
      if (operatorHeld.value) return 'This workflow is stopped';
      if (!run.value && selected.value?.lastError)
        return "Workflow start needs attention";
      if (run.value?.state === "waiting-human") return "Your decision is next";
      if (run.value?.state === "awaiting-review")
        return "Review the code changes";
      if (run.value?.state === 'attention' && managedSession.value) return sessionJob.value?.failure?.code === 'transport' || sessionJob.value?.failure?.code === 'incomplete_output' ? 'The agent connection closed' : 'The agent needs attention';
      if (run.value?.state === "running") return managedSession.value ? 'The agent is working' : "An attempt is in progress";
      if (run.value?.state === "finished")
        return selected.value?.status === "shipped"
          ? "Code changes accepted"
          : "This workflow is complete";
      if (run.value?.state === "stopped") return "This workflow is stopped";
      return `${run.value?.state === "attention" ? ordinaryNativeTask.value ? "Continue this task" : "Review before retrying" : run.value ? "Next step" : "Start with"} · ${currentStep.value?.name ?? "workflow"}`;
    }),
    nextActionHelp: computed(() => {
      if (pendingPolishing.value) return 'The main workflow checkpoint is retained. Inspect the independent pass above; stop or recover its execution if needed, then apply or dismiss its result before continuing the main workflow.';
      if (operatorHeld.value) return `${preservedReview.value ? 'Review the preserved changes before deciding what to keep. ' : 'The captured history is retained. '}Right-click this card and choose Restart workflow to start from the first step. Eligible native Builds can instead review a background retry below and explicitly release the hold.`;
      if (!run.value && selected.value?.lastError)
        return selected.value.lastError;
      if (run.value?.state === 'attention' && managedSession.value && blocked.value) return blocked.value;
      if (run.value?.state === 'attention' && managedSession.value) return sessionJob.value?.failure?.code === 'ownership_unknown'
        ? 'The original agent’s state is not confirmed. Check its session before starting more work.'
        : 'The session ended before a complete result was saved. Your available work and records are retained. Continue when you are ready for the agent to work on this task again.';
      if (run.value?.state === "running")
        return managedSession.value ? 'Quiet periods do not end this task. Open Sessions to follow reported activity, or use Stop to end it.' : "Wait for a validated result. A delivered prompt alone does not complete a step.";
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
        ? `${configuredAgentLabel(currentStep.value, Boolean(run.value))}. Starting this step captures its inputs and waits for the required result.`
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
        agent: exemptScreeningStep(step, selected.value, run.value) ? 'Owner request · no agent invoked' :
          run.value?.external && step.kind === "ai"
            ? "External MCP client"
            : configuredAgentLabel(step, Boolean(run.value)),
        current:
          step.id === currentStep.value?.id &&
          !run.value?.state?.match(/^(finished|stopped|awaiting-review)$/u),
        completed: Boolean(run.value && index < run.value.cursor),
        state:
          run.value?.attempts
            .filter((attempt) => attempt.stepId === step.id)
            .at(-1)?.status ?? (exemptScreeningStep(step, selected.value, run.value) ? 'Screening not required' : "Not started"),
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
      if (id && !operatorHeld.value && !pendingPolishing.value && !reviewedBackgroundRetryRequired(run.value)) perform(() => actions.runWorkflowStep(id));
    },
    restart: () => {
      const id = selected.value?.id;
      if (id && !operatorHeld.value && !pendingPolishing.value) perform(() => actions.startWorkflow(id));
    },
    stop: () => {
      const id = selected.value?.id;
      if (id) perform(() => actions.stopWorkflow(id));
    },
    togglePause: () =>
      perform(() => actions.changeSettings({ paused: !settings.value.paused })),
    selectPage: (page: import("../../stores/studio-pages").WorkflowPage) =>
      store.openWorkflowTool(page),
    editWorkflow: () => { void editDefinition(); },
    editPrompt: (id: string) => { void editDefinition(id); },
    openIdea: (id: string) => {
      store.select(id, 'workflow');
    },
    reviewCode: () => { if (selected.value) store.select(selected.value.id, 'increment'); },
    cancel: (id: string) => perform(() => actions.cancelJob(id)),
    toggleExpanded: () => {
      expanded.value = !expanded.value;
    },
  });
}
export type WorkflowModel = ReturnType<typeof useWorkflow>;
