import type { StoppedWorkflowWorkspaceRequest, WorkflowWorkspaceRecord } from '../../features/coforge/application/workflow-workspace-ports';
import { captureWorkflowIncrement } from './workflow-workspace-capture';

/** A single workspace-journal command owns verification, capture and release; no provider is dispatched. */
export async function recoverStoppedWorkspace(record: WorkflowWorkspaceRecord | undefined, request: StoppedWorkflowWorkspaceRequest,
  verify: (record: WorkflowWorkspaceRecord) => Promise<void>) {
  if (!record || record.id !== request.workspaceId || record.runId !== request.runId || record.projectId !== request.projectId
    || !['attention', 'ready'].includes(record.phase)
    || (record.activeAttemptId ? record.activeAttemptId !== request.attemptId : record.lastAttemptId !== request.attemptId))
    throw new Error('The original stopped workspace ownership changed. Its files remain retained.');
  const next: WorkflowWorkspaceRecord = { ...record, phase: 'ready', lastAttemptId: request.attemptId, reviewedAttemptId: request.attemptId };
  delete next.activeAttemptId;
  await verify(next);
  const increment = request.capture === false ? undefined : await captureWorkflowIncrement(next.cwd, next.branch,
    'Retained changes after the original agent session stopped', undefined, { allowEmpty: true, baseCommit: next.baseCommit });
  await verify(next);
  return { next, increment: increment?.files.length ? increment : undefined };
}
