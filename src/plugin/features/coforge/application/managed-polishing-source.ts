import type { BackgroundBuildRetryInspection, BackgroundBuildRetrySource } from '../domain/background-build-retry';
import { durableBuildTerminal, sameDurableBuildRef } from '../domain/durable-build';
import { isManagedWorkflowSession } from '../domain/workflow-lifecycle';
import type { InternalState } from './ports';

/** Existing trusted session/worker cessation replaces a redundant human promise, never a missing proof. */
export function managedPolishingSourceStopped(state: Pick<InternalState, 'jobs'>, source: BackgroundBuildRetrySource | undefined,
  inspection: Pick<BackgroundBuildRetryInspection, 'sourceOwner'> | undefined): boolean {
  const owner = inspection?.sourceOwner;
  if (!source || source.sourceKind !== 'workspace' || !source.sourceWorkspaceId || owner?.kind !== 'attempt') return false;
  const job = state.jobs.find(job => job.id === owner.jobId && job.workflow?.attemptId === owner.attemptId && job.workflow.runId === source.runId
    && job.workflow.workspaceId === source.sourceWorkspaceId && job.ideaId === source.ideaId && job.projectId === source.projectId);
  if (!job || !isManagedWorkflowSession(job.workflow) || !['succeeded', 'failed', 'cancelled'].includes(job.status) || job.nativeRuntime || job.nativeProcess?.privateRuntime
    || job.verificationRuntime?.some(runtime => runtime.phase !== 'terminal')
    || state.jobs.some(other => other.id !== job.id && ['queued', 'running'].includes(other.status)
      && (other.ideaId === job.ideaId || other.workflow?.workspaceId === source.sourceWorkspaceId))) return false;
  if (job.durable) {
    const snapshot = job.durable.snapshot;
    return !!snapshot && job.durable.acknowledged === true && durableBuildTerminal(snapshot.phase)
      && sameDurableBuildRef(job.durable.ref, snapshot.ref) && job.durable.appliedSequence === snapshot.sequence
      && snapshot.workspaceCaptured === true && snapshot.workspaceId === source.sourceWorkspaceId;
  }
  const process = job.nativeProcess;
  return process?.phase === 'terminated' && !!process.lifetime && process.runId === source.runId
    && process.attemptId === owner.attemptId && process.projectId === source.projectId;
}
