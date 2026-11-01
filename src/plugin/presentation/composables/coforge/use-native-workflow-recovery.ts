import { computed, reactive, ref, watch } from 'vue';
import { useCoforge } from '../../context/coforge-context';
import { useStudioStore } from '../../stores/coforge-studio';
import { nativeWorkflowAcknowledgementReview } from '../../../features/coforge/application/native-workflow-acknowledgement';
import { formatTime } from './format';

export function useNativeWorkflowRecoveryJobs(props: { ideaId: string; runId?: string }) {
  const store = useStudioStore();
  return reactive({ jobs: computed(() => (store.state?.jobs ?? []).filter(job => job.ideaId === props.ideaId && (!props.runId || job.workflow?.runId === props.runId) && !job.durable && ['failed', 'cancelled'].includes(job.status)
    && (job.nativeRuntime || job.nativeProcess || job.verificationRuntime?.some(record => record.phase !== 'terminal')))) });
}

export function useNativeWorkflowRecovery(props: { jobId: string }) {
  const store = useStudioStore();
  const { studio } = useCoforge();
  const job = computed(() => store.state?.jobs.find(job => job.id === props.jobId));
  const confirmed = ref(false);
  const busy = ref(false);
  const error = ref('');
  const review = computed(() => {
    if (!store.state) return { identity: '', reason: 'The studio is unavailable.' };
    if (job.value?.nativeRuntime && !job.value.nativeProcess) return { identity: '', reason: 'Private preparation remains; no provider process was recorded. Check original execution to clean the retained private runtime.' };
    if (job.value?.nativeProcess?.phase === 'terminated' && job.value.nativeProcess.privateRuntime) return { identity: '', reason: 'The provider is stopped. Check original execution to finish private runtime cleanup.' };
    try { return { identity: nativeWorkflowAcknowledgementReview(store.state, props.jobId), reason: '' }; }
    catch (error) { return { identity: '', reason: error instanceof Error ? error.message : 'Check original execution recovery.' }; }
  });
  watch(() => review.value.identity, () => { confirmed.value = false; });
  async function act(kind: 'check' | 'acknowledge'): Promise<void> {
    busy.value = true; error.value = '';
    try {
      if (kind === 'check') await studio.checkNativeWorkflowRecovery(props.jobId);
      else await studio.acknowledgeNativeWorkflowProcess(props.jobId, review.value.identity, confirmed.value);
    } catch (failure) { error.value = failure instanceof Error ? failure.message : 'Recovery could not be saved. Inspect the original execution.'; }
    finally { busy.value = false; }
  }
  return reactive({ job, confirmed, busy, error, review,
    visible: computed(() => !!job.value && !job.value.durable && ['failed', 'cancelled'].includes(job.value.status) && !!(job.value.nativeRuntime || job.value.nativeProcess || job.value.verificationRuntime?.some(record => record.phase !== 'terminal'))),
    acknowledged: computed(() => job.value?.nativeProcess?.operatorAcknowledgedAt),
    settled: computed(() => job.value?.nativeProcess?.phase === 'terminated' && !job.value.nativeProcess.privateRuntime && !job.value.nativeRuntime && !job.value.verificationRuntime?.some(record => record.phase !== 'terminal')),
    observedLabel: computed(() => job.value?.nativeProcess ? formatTime(job.value.nativeProcess.observedAt) : ''),
    check: () => { void act('check'); }, acknowledge: () => { void act('acknowledge'); },
  });
}
