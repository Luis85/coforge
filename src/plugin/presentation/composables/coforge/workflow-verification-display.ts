import type { WorkflowVerificationRecord } from '../../../features/coforge/domain/workflow-verification';
import { formatTime } from './format';
import { computed, reactive } from 'vue';

const LABELS: Record<WorkflowVerificationRecord['status'], string> = { running: 'Started · awaiting observed outcome', completed: 'Completed · exit 0', failed: 'Failed', interrupted: 'Interrupted', unknown: 'Outcome unknown', unavailable: 'Unavailable' };
export function verificationDisplay(record: WorkflowVerificationRecord, currentHash?: string) {
  return { ...record,
    outcome: record.status === 'failed' ? `Failed · exit ${record.exitCode}` : LABELS[record.status],
    startedLabel: formatTime(record.startedAt), finishedLabel: record.finishedAt ? formatTime(record.finishedAt) : '',
    command: [record.executable, ...record.args].map(argument => JSON.stringify(argument)).join(' '),
    snapshotLabel: currentHash ? record.sourceHash === currentHash ? 'Matches the captured source snapshot' : 'Earlier source snapshot · does not verify the current changes' : 'Captured source snapshot · current snapshot match not recorded',
  };
}

export function useVerificationEvidence(props: { records: WorkflowVerificationRecord[]; currentHash?: string; historical?: boolean }) {
  return reactive({ records: computed(() => props.records.map(record => ({ ...verificationDisplay(record, props.historical ? undefined : props.currentHash), ...(props.historical ? { snapshotLabel: 'Recorded before Apply; not rerun in this worktree' } : {}) }))) });
}
