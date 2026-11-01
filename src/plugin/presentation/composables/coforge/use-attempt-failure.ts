import { computed, reactive } from 'vue';
import { useStudioStore, type AttemptInspectionSection } from '../../stores/coforge-studio';
import { attemptFailureEvidence } from './attempt-failure-evidence';

export function useAttemptFailure(props: { jobId: string }) {
  const store = useStudioStore();
  const evidence = computed(() => attemptFailureEvidence(store.state, props.jobId));
  return reactive({ evidence, detailsTag: computed(() => evidence.value?.managed ? 'details' : 'div'),
    openSessions: () => { if (evidence.value) store.select(evidence.value.ideaId, 'sessions'); }, inspect: (section: AttemptInspectionSection) => {
    if (evidence.value) store.inspectJob(evidence.value.ideaId, evidence.value.jobId, section);
  } });
}
