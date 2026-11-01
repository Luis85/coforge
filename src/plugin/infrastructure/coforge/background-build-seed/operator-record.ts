import { boolean, list, oneOf, optional, shape, text } from '../../../features/coforge/domain/check';
import { backgroundBuildRetrySourceCheck, backgroundBuildSnapshotRefCheck } from '../../../features/coforge/domain/background-build-retry';
import { durableBuildResultCheck } from '../../../features/coforge/domain/durable-build';
import { WorkerFiles } from '../durable-worker/files';
import { retrySeedDirectory } from './store';
import { inputHash } from '../durable-worker/protocol';
import type { WorkflowWorkspaceRecord } from '../../../features/coforge/application/workflow-workspace-ports';

const id = text({ pattern: /^[a-zA-Z0-9_-]{1,80}$/u }); const path = text({ min: 1, max: 4096 }); const hash = text({ pattern: /^[a-f0-9]{64}$/u });
export const polishingApplyRequestCheck = shape({ id, ideaId: text({ min: 1, max: 160 }), projectId: text({ min: 1, max: 160 }), source: backgroundBuildRetrySourceCheck,
  reviewedSnapshot: backgroundBuildSnapshotRefCheck, baseline: backgroundBuildSnapshotRefCheck, evidenceHash: hash, sourceArtifactHash: hash,
  target: shape({ runId: text({ min: 1, max: 160 }), mode: oneOf(['foreground', 'background'] as const), workspaceEpoch: id, projectPath: path, worktreeFolder: text({ max: 4096 }) }, { strict: true }) }, { strict: true });
const increment = (value: unknown) => { const checked = durableBuildResultCheck({ increment: value }).increment; if (!checked || checked.simulated) throw new Error('An actual resource capture is required.'); return checked; };
export const polishingBindingCheck = shape({ id, workspaceId: text({ min: 1, max: 320 }), ownerRunId: text({ min: 1, max: 160 }), mode: oneOf(['foreground', 'background'] as const), workspaceEpoch: id, increment, evidenceHash: hash }, { strict: true });
export const operatorRecordCheck = shape({ version: oneOf([1] as const), request: polishingApplyRequestCheck, requestHash: hash,
  baseCommit: text({ pattern: /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u }),
  protectedProjectPaths: list(path, { max: 1000 }), state: oneOf(['prepared', 'copying', 'complete', 'attention'] as const), copyStopped: optional(boolean),
  workspaceId: optional(text({ min: 1, max: 320 })), binding: optional(polishingBindingCheck) }, { strict: true });
export type OperatorResourceRecord = ReturnType<typeof operatorRecordCheck>;
export const operatorResourceFiles = (privateDirectory: string) => new WorkerFiles(new WorkerFiles(retrySeedDirectory(privateDirectory)).path('operators'));
export const operatorRecordName = (value: string) => 'operator-' + id(value) + '.json';
/** Generation-local complete provenance survives archival without retargeting its physical workspace. */
export async function operatorWorkspaceRecord(files: WorkerFiles, workspace: WorkflowWorkspaceRecord): Promise<OperatorResourceRecord> {
  if (!workspace.operatorMaterializationId) throw new Error('The private operator resource receipt is unavailable.');
  const record = operatorRecordCheck(await files.read(operatorRecordName(workspace.operatorMaterializationId)));
  const binding = record.binding;
  if (record.state !== 'complete' || !binding || inputHash({ request: record.request, protectedProjectPaths: record.protectedProjectPaths }) !== record.requestHash ||
    record.request.id !== workspace.operatorMaterializationId || binding.id !== workspace.operatorMaterializationId || binding.workspaceId !== workspace.id ||
    binding.ownerRunId !== workspace.runId || record.request.projectId !== workspace.projectId || binding.workspaceEpoch !== workspace.workspaceEpoch ||
    record.request.target.runId !== binding.ownerRunId || record.request.target.mode !== binding.mode || record.request.target.workspaceEpoch !== binding.workspaceEpoch ||
    record.workspaceId !== binding.workspaceId || record.baseCommit !== workspace.baseCommit || binding.increment.worktree !== workspace.cwd || binding.increment.branch !== workspace.branch) throw new Error('The original operator resource identity changed.');
  return record;
}
/** A stopped, never-bound operator copy is retained as retired evidence, not fabricated completion. */
export async function retainedOperatorCopy(files: WorkerFiles, workspace: WorkflowWorkspaceRecord): Promise<boolean> {
  if (!workspace.operatorMaterializationId || workspace.phase !== 'retired' || workspace.activeAttemptId || workspace.lastAttemptId !== workspace.operatorMaterializationId) return false;
  const record = operatorRecordCheck(await files.read(operatorRecordName(workspace.operatorMaterializationId)));
  return record.state === 'attention' && record.copyStopped === true && !record.binding && record.workspaceId === workspace.id && record.request.id === workspace.operatorMaterializationId &&
    record.request.target.runId === workspace.runId && record.request.projectId === workspace.projectId && record.request.target.workspaceEpoch === workspace.workspaceEpoch &&
    record.baseCommit === workspace.baseCommit && record.requestHash === inputHash({ request: record.request, protectedProjectPaths: record.protectedProjectPaths });
}
