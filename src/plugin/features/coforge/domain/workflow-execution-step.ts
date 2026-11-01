import type { WorkflowRun } from './configured-workflow-run';
import type { WorkflowStep } from './configured-workflow';

/** Only the specifically audited new attempt receives the approved execution policy. */
export function effectiveWorkflowStep(run: WorkflowRun, index: number, retryId?: string): WorkflowStep | undefined {
  const original = run.definition.steps[index];
  if (!retryId) return original;
  const retry = run.backgroundRetries?.find(item => item.id === retryId);
  if (!retry || original?.kind !== 'ai' || original.id !== retry.stepId) throw new Error('The background retry execution approval is missing or changed.');
  return { ...original, execution: retry.policy };
}
/** A later workspace epoch never retargets callbacks belonging to an earlier attempt. */
function epochs(run: WorkflowRun) {
  return [...(run.backgroundRetries ?? []).map(item => ({ boundary: item.priorAttemptCount, prior: item.priorWorkspaceId, revision: item.fromRunRevision, pendingImport: true })),
    ...(run.polishingResources ?? []).map(item => ({ boundary: item.priorAttemptCount, prior: item.priorWorkspaceId, revision: item.fromRunRevision, pendingImport: false }))].sort((a, b) => a.revision - b.revision);
}
export function workflowAttemptWorkspace(run: WorkflowRun, attemptId: string): string | undefined {
  const index = run.attempts.findIndex(item => item.id === attemptId);
  if (index < 0) throw new Error('The original workspace attempt is missing.');
  const all = epochs(run); const next = all.find(epoch => epoch.boundary > index);
  if (next) return next.prior;
  const latest = all.at(-1);
  return latest?.pendingImport && run.workspaceId === latest.prior ? undefined : run.workspaceId;
}
export function currentWorkspaceAttempt(run: WorkflowRun, attemptId: string): boolean {
  const boundary = epochs(run).at(-1)?.boundary ?? 0;
  return run.attempts.findIndex(item => item.id === attemptId) >= boundary;
}
/** Until import binds, preceding inputs still describe the reviewed source epoch. */
export function workflowInputWorkspaceBoundary(run: WorkflowRun): number {
  const all = epochs(run); const latest = all.at(-1);
  return latest?.pendingImport && run.workspaceId === latest.prior ? all.at(-2)?.boundary ?? 0 : latest?.boundary ?? 0;
}
