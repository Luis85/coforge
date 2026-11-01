import { computed, nextTick, onBeforeUnmount, reactive, ref, watch, type ComponentPublicInstance } from 'vue';
import type { BackgroundBuildRetryPreview } from '../../../features/coforge/api';
import { workflowDefinition } from '../../../features/coforge/domain/configured-workflow';
import { workflowProposalRevision } from '../../../features/coforge/domain/configured-workflow-run';
import { ideaProjectId } from '../../../features/coforge/domain/projects';
import { isActiveJob } from '../../../features/coforge/domain/workflow';
import { isManagedWorkflowSession } from '../../../features/coforge/domain/workflow-lifecycle';
import { useStudioStore } from '../../stores/coforge-studio';
import { useStudioActions } from './use-studio-actions';
import { backgroundRetryCandidate, reviewedBackgroundRetryRequired, retryDeadline, retryIdleWarning } from './background-build-retry-display';

export function useBackgroundBuildRetry(ideaId: () => string, runId: () => string | undefined) {
  const store = useStudioStore(); const actions = useStudioActions();
  const idea = computed(() => store.state?.ideas.find(item => item.id === ideaId()));
  const run = computed(() => idea.value?.workflowRun);
  const project = computed(() => idea.value && store.state?.projects?.find(item => item.id === ideaProjectId(idea.value!)));
  const saved = computed(() => project.value && workflowDefinition(project.value.settings));
  const receipt = ref<BackgroundBuildRetryPreview | null>(null);
  const stopped = ref(false); const reviewed = ref(false); const releaseHold = ref(false);
  const working = ref(''); const error = ref(''); let generation = 0;
  let trigger: HTMLElement | null = null; let panel: HTMLElement | null = null;
  const latestStepJob = computed(() => store.state?.jobs.filter(job => job.ideaId === ideaId() && job.workflow !== undefined && job.workflow.runId === runId()
    && job.workflow.step.id === run.value?.definition.steps[run.value.cursor]?.id).at(-1));
  const ordinaryManaged = computed(() => isManagedWorkflowSession(latestStepJob.value?.workflow) && !latestStepJob.value?.workflow?.backgroundRetryId && !reviewedBackgroundRetryRequired(run.value));
  const available = computed(() => !ordinaryManaged.value && run.value?.id === runId() && backgroundRetryCandidate(idea.value)
    && (run.value?.state !== 'awaiting-review' || store.state?.workflowStopHolds?.includes(ideaId()))
    && !store.state?.jobs.some(job => job.ideaId === ideaId() && isActiveJob(job)));
  const context = computed(() => JSON.stringify([ideaId(), runId(), run.value?.id, run.value?.revision, run.value?.cursor,
    run.value?.proposalRevision, idea.value && workflowProposalRevision(idea.value), saved.value?.revision,
    saved.value?.steps.find(step => step.id === run.value?.definition.steps[run.value.cursor]?.id),
    project.value?.projectPath, project.value?.worktreeFolder, store.state?.workflowStopHolds?.includes(ideaId()),
    idea.value?.polishingRuns?.map(pass => [pass.id, pass.review, pass.workflow.revision])]));
  function clear() { receipt.value = null; stopped.value = false; reviewed.value = false; releaseHold.value = false; }
  watch(context, () => { const changed = receipt.value && working.value !== 'confirm'; generation++; clear(); working.value = ''; error.value = changed ? 'The request, run or saved execution policy changed. Preview again.' : ''; });
  onBeforeUnmount(() => { generation++; });
  const canConfirm = computed(() => Boolean(receipt.value && !working.value && !store.busy && receipt.value.readiness.ready
    && receipt.value.readiness.reviewedSnapshots === true && reviewed.value
    && (!receipt.value.inspection.humanCessationRequired || stopped.value) && (!receipt.value.stopHold || releaseHold.value)));
  async function restoreTrigger() { await nextTick(); trigger?.focus(); }
  async function preview() {
    if (!available.value || working.value || store.busy) return;
    const key = context.value; const token = ++generation; const id = ideaId();
    clear(); error.value = ''; working.value = 'preview';
    try {
      const value = await actions.previewBackgroundBuildRetry(id);
      if (token !== generation || context.value !== key) return;
      if (value.purpose !== 'retry' || value.ideaId !== id || value.runId !== runId() || value.runRevision !== run.value?.revision
        || value.proposalRevision !== run.value.proposalRevision || value.stepId !== run.value.definition.steps[run.value.cursor]?.id
        || value.policySource.definitionRevision !== saved.value?.revision) throw new Error('This preview belongs to an earlier request, run or policy. Preview again.');
      receipt.value = value; await nextTick(); panel?.focus();
    } catch (cause) { if (token === generation && context.value === key) error.value = cause instanceof Error ? cause.message : 'The Build could not be inspected. No retry was started.'; }
    finally { if (token === generation) working.value = ''; }
  }
  async function confirm() {
    const current = receipt.value;
    if (!current || !canConfirm.value) return;
    const token = ++generation; const key = context.value; working.value = 'confirm'; error.value = '';
    try {
      await actions.confirmBackgroundBuildRetry(current.ideaId, current.id, { oldExecutorStopped: stopped.value, changesReviewed: reviewed.value, releaseStopHold: releaseHold.value });
      if (token === generation && key === context.value) { clear(); await restoreTrigger(); }
    } catch (cause) {
      if (token === generation && key === context.value) { clear(); error.value = cause instanceof Error ? cause.message : 'The background retry was not admitted. Preview again.'; await restoreTrigger(); }
    } finally { if (token === generation) working.value = ''; }
  }
  function cancel() { if (working.value) return; clear(); error.value = ''; void restoreTrigger(); }
  return reactive({ available, receipt, stopped, reviewed, releaseHold, working, error, canConfirm,
    deadline: computed(() => receipt.value ? retryDeadline(receipt.value.policy) : ''),
    idle: computed(() => receipt.value ? retryIdleWarning(receipt.value.policy) : ''),
    retainedSteps: computed(() => run.value?.cursor ?? 0), attemptCount: computed(() => run.value?.attempts.length ?? 0),
    artifactCount: computed(() => run.value?.artifacts.length ?? 0),
    bindTrigger: (value: Element | ComponentPublicInstance | null) => { trigger = value instanceof HTMLElement ? value : null; },
    bindPanel: (value: Element | ComponentPublicInstance | null) => { panel = value instanceof HTMLElement ? value : null; },
    preview: () => { void preview(); }, confirm: () => { void confirm(); }, cancel,
    keydown: (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancel(); } },
  });
}
