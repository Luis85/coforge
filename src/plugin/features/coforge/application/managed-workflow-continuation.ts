import type { AgentJob } from '../domain/types';
import type { WorkflowRun } from '../domain/configured-workflow-run';
import { durableBuildTerminal, sameDurableBuildRef } from '../domain/durable-build';
import { isManagedWorkflowSession } from '../domain/workflow-lifecycle';

export type ManagedWorkflowContinuation = 'ready' | 'settling' | 'unverified';
/** Only ordinary managed background work can continue its exact resource without a reviewed retry epoch. */
export function managedWorkflowContinuation(run: WorkflowRun | undefined, jobs: readonly AgentJob[]): ManagedWorkflowContinuation | undefined {
  const step = run?.definition.steps[run.cursor];
  if (!run || run.external || step?.kind !== 'ai' || step.output !== 'codechange' || step.access !== 'editworktree'
    || step.execution?.mode !== 'background' || !['claude', 'codex'].includes(step.provider)
    || run.backgroundRetries?.some(retry => retry.stepId === step.id)) return undefined;
  const attempt = [...run.attempts].reverse().find(attempt => attempt.stepId === step.id);
  const job = attempt && jobs.find(job => job.id === attempt.jobId && job.ideaId === run.ideaId && job.projectId === run.projectId
    && job.workflow?.runId === run.id && job.workflow.attemptId === attempt.id);
  if (!job || !isManagedWorkflowSession(job.workflow) || job.workflow?.backgroundRetryId) return undefined;
  if (!['failed', 'cancelled'].includes(attempt!.status) || !['failed', 'cancelled'].includes(job.status)) return 'unverified';
  const execution = job.durable, snapshot = execution?.snapshot, workspaceId = job.workflow?.workspaceId;
  if (!execution || !snapshot || !durableBuildTerminal(snapshot.phase) || snapshot.phase === 'completed'
    || !sameDurableBuildRef(execution.ref, snapshot.ref) || execution.appliedSequence !== snapshot.sequence
    || !workspaceId || workspaceId !== run.workspaceId || snapshot.workspaceId !== workspaceId || snapshot.workspaceCaptured !== true
    || job.workflow?.definitionRevision !== run.definition.revision || job.workflow.proposalRevision !== run.proposalRevision
    || job.nativeRuntime || job.nativeProcess?.privateRuntime || job.nativeProcess && job.nativeProcess.phase !== 'terminated'
    || job.verificationRuntime?.some(record => record.phase !== 'terminal')
    || jobs.some(other => other.id !== job.id && ['queued', 'running'].includes(other.status)
      && (other.ideaId === job.ideaId || other.workflow?.workspaceId === workspaceId))) return 'unverified';
  return execution.acknowledged ? 'ready' : 'settling';
}
