import { computed, reactive, ref } from 'vue';
import { polishingResultValue } from '../../../features/coforge/domain/polishing-target';
import { isActiveJob } from '../../../features/coforge/domain/workflow';
import { useStudioStore } from '../../stores/coforge-studio';
import { useStudioActions } from './use-studio-actions';
import { CONFIGURED_RUN_LABELS } from './configured-workflow-display';
import type { PolishingTarget } from '../../../features/coforge/domain/polishing';
import { polishingTargetLabel } from './use-polishing-result-body';

export function usePolishingHistory(ideaId: () => string) {
  const store = useStudioStore(); const actions = useStudioActions(); const expanded = ref(false); const pending = ref(''); const error = ref('');
  const idea = computed(() => store.state?.ideas.find(item => item.id === ideaId()));
  const total = computed(() => idea.value?.polishingRuns?.length ?? 0);
  const rows = computed(() => [...(idea.value?.polishingRuns ?? [])].reverse().slice(0, expanded.value ? total.value : 5).map(pass => {
    const jobs = (store.state?.jobs ?? []).filter(job => job.ideaId === ideaId() && job.workflow?.runId === pass.workflow.id);
    const unsettled = jobs.some(job => isActiveJob(job) || job.durable && job.durable.acknowledged !== true);
    const terminal = ['finished', 'awaiting-review'].includes(pass.workflow.state);
    const retainedCopyFailure = Boolean(pass.applyIntent && pass.applyFailure?.code === 'POLISHING_COPY_RETAINED' && pass.applyFailure.intentId === pass.applyIntent.id);
    let result: PolishingTarget['value'] | undefined; let problem = '';
    if (terminal) { try { result = polishingResultValue(pass); } catch (cause) { problem = cause instanceof Error ? cause.message : 'The result needs inspection.'; } }
    return { pass, result, problem, unsettled, label: polishingTargetLabel(pass.target.kind), time: new Date(pass.createdAt).toLocaleString(),
      applyLabel: retainedCopyFailure ? 'Retry Apply with a fresh copy' : pass.applyIntent ? 'Check existing Apply' : pass.target.kind === 'codechange' ? 'Accept polishing code changes' : 'Apply polished result',
      applyExplanation: retainedCopyFailure ? `${pass.applyFailure!.message} A new explicit Apply rechecks the source and baseline before creating a fresh copy. Earlier copy attempts remain retained; the model is not called again.` : pass.applyIntent ? 'No fresh copy or model call is authorized. Check the original Apply receipt; an unknown or copying target stays held until its exact outcome is verified.' : '',
      status: pass.review === 'applied' ? 'Applied after review' : pass.review === 'rejected' ? 'Dismissed / rejected' : terminal ? 'Ready for your review' : CONFIGURED_RUN_LABELS[pass.workflow.state],
      canReview: pass.review === 'pending' && Boolean(result) && !unsettled,
      canDismiss: pass.review === 'pending' && !unsettled && pass.workflow.state !== 'running' && (!pass.applyIntent || retainedCopyFailure),
      canStop: pass.review === 'pending' && ['ready', 'running', 'attention'].includes(pass.workflow.state),
    };
  }));
  async function perform(runId: string, action: 'apply' | 'reject' | 'stop') {
    const pass = idea.value?.polishingRuns?.find(item => item.id === runId); if (!pass || pending.value) return;
    const id = ideaId(); const revision = pass.workflow.revision; pending.value = `${runId}:${action}`; error.value = '';
    try {
      if (action === 'apply') await actions.applyPolishingResult(id, runId, revision);
      else if (action === 'reject') await actions.rejectPolishingResult(id, runId, revision);
      else await actions.stopPolishingPass(id, runId);
    } catch (cause) { if (ideaId() === id) error.value = cause instanceof Error ? cause.message : 'The polishing action could not be completed.'; }
    finally { pending.value = ''; }
  }
  return reactive({ rows, total, expanded, pending, error, apply: (id: string) => { void perform(id, 'apply'); }, reject: (id: string) => { void perform(id, 'reject'); }, stop: (id: string) => { void perform(id, 'stop'); } });
}
