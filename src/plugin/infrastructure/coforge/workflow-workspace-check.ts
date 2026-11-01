import type { WorkflowWorkspaceRecord } from '../../features/coforge/application/workflow-workspace-ports';
import { list, number, oneOf, optional, shape, text } from '../../features/coforge/domain/check';
const identity = text({ min: 1, max: 320 });
const path = text({ min: 1, max: 4096 });
const recordsCheck = list(shape({ id: identity, runId: identity, workspaceEpoch: optional(text({ min: 1, max: 80, pattern: /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/u })), operatorMaterializationId: optional(identity), projectId: identity, projectPath: path, cwd: path, branch: identity,
  baseCommit: text({ min: 40, max: 64, pattern: /^[a-f0-9]+$/u }), phase: oneOf(['reserved', 'ready', 'attention', 'retired'] as const),
  pointer: optional(text({ min: 1, max: 4096 })), directoryDevice: optional(number({ min: 0 })), directoryInode: optional(number({ min: 0 })),
  activeAttemptId: optional(identity), reviewedAttemptId: optional(identity), lastAttemptId: optional(identity),
}, { strict: true }), { max: 1000 });
export function workflowWorkspaceRecordsCheck(value: unknown): WorkflowWorkspaceRecord[] {
  const records = recordsCheck(value);
  if (new Set(records.map(record => record.id)).size !== records.length || new Set(records.map(record => JSON.stringify([record.runId, record.workspaceEpoch ?? '']))).size !== records.length ||
      records.some(record => record.phase === 'ready' && (!record.pointer || record.directoryDevice === undefined || record.directoryInode === undefined)) ||
      records.some(record => record.phase === 'retired' && record.activeAttemptId)) throw new Error('inconsistent');
  if (records.some(record => record.operatorMaterializationId && record.operatorMaterializationId !== record.workspaceEpoch)) throw new Error('inconsistent operator resource');
  return records;
}
