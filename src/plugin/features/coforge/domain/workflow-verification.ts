import { boolean, list, number, oneOf, optional, shape, text, timestamp, type Check } from './check';

export const WORKFLOW_VERIFICATION_STATUSES = ['running', 'completed', 'failed', 'interrupted', 'unknown', 'unavailable'] as const;
export interface WorkflowVerificationRecord {
  id: string; runId: string; attemptId: string; projectId: string; workspaceId?: string;
  commandId: string; label: string; executable: string; args: string[]; runtime: 'docker'; imageId: string;
  sourceHash: string; startedAt: string; finishedAt?: string; status: typeof WORKFLOW_VERIFICATION_STATUSES[number]; exitCode?: number; output: string; truncated: boolean;
}
const id = text({ min: 1, max: 160 });
export const workflowSourceHashCheck = text({ pattern: /^[a-f0-9]{64}$/u });
const record = shape({ id, runId: id, attemptId: id, projectId: id, workspaceId: optional(id), commandId: id, label: text({ min: 1, max: 200 }), executable: text({ min: 1, max: 1000 }), args: list(text({ max: 2000 }), { max: 64 }),
  runtime: oneOf(['docker'] as const), imageId: text({ pattern: /^sha256:[a-f0-9]{64}$/u }), sourceHash: workflowSourceHashCheck, startedAt: timestamp, finishedAt: optional(timestamp), status: oneOf(WORKFLOW_VERIFICATION_STATUSES), exitCode: optional(number({ integer: true })), output: text({ max: 200000 }), truncated: boolean }, { strict: true });
export const workflowVerificationRecordCheck: Check<WorkflowVerificationRecord> = (value, path) => {
  const result = record(value, path);
  if (result.status === 'running' && (result.finishedAt !== undefined || result.exitCode !== undefined)) throw new Error('A running verification cannot carry an exit outcome.');
  if (result.status !== 'running' && (!result.finishedAt || Date.parse(result.finishedAt) < Date.parse(result.startedAt))) throw new Error('Terminal verification requires a valid observed finish time.');
  if (result.status === 'completed' && result.exitCode !== 0) throw new Error('Completed verification requires observed exit code zero.');
  if (result.status === 'failed' && (result.exitCode === undefined || result.exitCode === 0)) throw new Error('Failed verification requires a nonzero exit code.');
  return result;
};
export const workflowVerificationRecordsCheck = list(workflowVerificationRecordCheck, { max: 32 });

/** Private container ownership journal. Never expose tokens or source directories to models or public views. */
export interface WorkflowVerificationRuntimeRecord {
  verificationId: string; containerName: string; ownerToken: string; dockerBin: string; endpoint: string; imageId: string;
  runId: string; attemptId: string; projectId: string; sourceDirectory: string; sourceHash: string; commandId: string;
  phase: 'prepared' | 'created' | 'started' | 'terminal'; startedAt: string; terminalAt?: string;
}
export const workflowVerificationRuntimeRecordCheck = shape({ verificationId: id, containerName: text({ min: 1, max: 200 }), ownerToken: text({ min: 1, max: 300 }), dockerBin: text({ min: 1, max: 1000 }), endpoint: text({ min: 1, max: 1000 }), imageId: text({ pattern: /^sha256:[a-f0-9]{64}$/u }),
  runId: id, attemptId: id, projectId: id, sourceDirectory: text({ min: 1, max: 4096 }), sourceHash: workflowSourceHashCheck, commandId: id, phase: oneOf(['prepared', 'created', 'started', 'terminal'] as const), startedAt: timestamp, terminalAt: optional(timestamp) }, { strict: true });
export const workflowVerificationRuntimeRecordsCheck = list(workflowVerificationRuntimeRecordCheck, { max: 32 });
