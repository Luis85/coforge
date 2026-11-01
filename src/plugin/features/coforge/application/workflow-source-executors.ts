import type { InternalState } from './ports';
import { backgroundBuildRetrySourceCheck, type BackgroundBuildRetrySource, type BackgroundBuildRetryInspection } from '../domain/background-build-retry';
/** Candidate requests are not lease claims. Native inspection alone identifies its actual recorded owner. */
export function workflowSourceExecutors(state: Pick<InternalState, 'jobs'>, runId: string | undefined, workspaceId: string | undefined) {
  if (!runId || !workspaceId) return [];
  return state.jobs.filter(job => job.workflow?.runId === runId && job.workflow.workspaceId === workspaceId && ['succeeded', 'failed', 'cancelled'].includes(job.status) && (!job.durable || job.durable.acknowledged))
    .map(job => ({ jobId: job.id, attemptId: job.workflow!.attemptId }));
}
/** Only the private journal's resolved owner can become canonical source attribution. */
export function resolvedWorkflowSource(source: BackgroundBuildRetrySource, inspection: BackgroundBuildRetryInspection): BackgroundBuildRetrySource {
  const owner = inspection.sourceOwner;
  const resolved = { ...source }; delete resolved.sourceJobId; delete resolved.sourceAttemptId;
  if (source.sourceKind === 'workspace' && !inspection.sourceOwner) throw new Error('The actual private workspace owner could not be verified. Restore its original execution metadata.');
  if (source.sourceKind === 'repository' && inspection.sourceOwner) throw new Error('A clean repository source cannot claim an attributed workspace owner.');
  if (owner?.kind === 'attempt' && !source.executorCandidates?.some(candidate => candidate.jobId === owner.jobId && candidate.attemptId === owner.attemptId) &&
      (source.sourceJobId !== owner.jobId || source.sourceAttemptId !== owner.attemptId)) throw new Error('Restore the actual source owner job and attempt before continuing.');
  if (inspection.sourceOwner?.kind === 'materialization' && source.sourceMaterializationId !== inspection.sourceOwner.id) throw new Error('The original operator resource receipt changed.');
  if (inspection.sourceOwner?.kind === 'attempt') { resolved.sourceJobId = inspection.sourceOwner.jobId; resolved.sourceAttemptId = inspection.sourceOwner.attemptId; delete resolved.sourceMaterializationId; }
  if (inspection.sourceOwner?.kind === 'materialization') resolved.sourceMaterializationId = inspection.sourceOwner.id;
  return backgroundBuildRetrySourceCheck(resolved);
}
