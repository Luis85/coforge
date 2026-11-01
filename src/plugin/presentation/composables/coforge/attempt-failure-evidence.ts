import type { AgentJob, AppState } from '../../../features/coforge/domain/types';
import { STAGE_LABELS } from '../../../features/coforge/domain/types';
import { workflowArtifactCheck, type WorkflowRun } from '../../../features/coforge/domain/configured-workflow-run';
import { providerFailureInfoCheck, type ProviderFailureInfo } from '../../../features/coforge/domain/provider-failure';
import { ideaProjectId } from '../../../features/coforge/domain/projects';
import { cleanText } from '../../../features/coforge/domain/sanitize';
import { sameDurableBuildRef } from '../../../features/coforge/domain/durable-build';
import { ideaWorkflowRun } from './idea-workflow-run';

export function failedWorkflowJobId(run: WorkflowRun | undefined, jobs: AgentJob[], ideaId: string | undefined): string {
  const attempt = run?.attempts.at(-1);
  if (!run || !attempt || !['failed', 'cancelled'].includes(attempt.status)) return '';
  return jobs.find(job => job.ideaId === ideaId && job.workflow?.runId === run.id && job.workflow.attemptId === attempt.id)?.id ?? '';
}

export function capturedAttemptSnapshot(state: AppState | null, job: AgentJob) {
  const saved = job.durable?.snapshot;
  const matching = saved && job.durable && sameDurableBuildRef(job.durable.ref, saved.ref) ? saved : undefined;
  const hot = state?.runtime.durableBuildSnapshots?.[job.id];
  return job.durable && hot && sameDurableBuildRef(job.durable.ref, hot.ref) && hot.sequence >= (matching?.sequence ?? 0) ? hot : matching;
}
/** Retained resources must belong to this exact job/attempt; an idea's current increment is never a fallback. */
export function attemptFailureEvidence(state: AppState | null, jobId: string) {
  const job = state?.jobs.find(job => job.id === jobId);
  const idea = state?.ideas.find(idea => idea.id === job?.ideaId);
  if (!state || !job || !idea || state.activeProjectId !== ideaProjectId(idea) || job.projectId && job.projectId !== state.activeProjectId || !['failed', 'cancelled'].includes(job.status)) return undefined;
  const snapshot = capturedAttemptSnapshot(state, job);
  const execution = job.workflow;
  const run = ideaWorkflowRun(idea, execution?.runId);
  const artifact = execution && run?.projectId === state.activeProjectId && run.ideaId === idea.id && run.definition.revision === execution.definitionRevision
    ? run.artifacts.find(artifact => {
      if (!artifact.hostSnapshot || artifact.output !== 'codechange' || artifact.runId !== execution.runId || artifact.attemptId !== execution.attemptId || artifact.proposalRevision !== execution.proposalRevision) return false;
      try { workflowArtifactCheck(artifact); return true; } catch { return false; }
    }) : undefined;
  const increment = snapshot?.increment ?? snapshot?.result?.increment ?? artifact?.increment;
  const conversation = job.conversation ?? snapshot?.conversation;
  let failure: ProviderFailureInfo | undefined;
  try { failure = providerFailureInfoCheck(snapshot?.failure ?? job.failure); } catch { /* Legacy records have no established classification. */ }
  const unresolved = !!(job.nativeRuntime || job.nativeProcess && job.nativeProcess.phase !== 'terminated' && !job.nativeProcess.operatorAcknowledgedAt
    || job.verificationRuntime?.some(record => record.phase !== 'terminal') || job.durable && !job.durable.acknowledged);
  return { jobId: job.id, ideaId: idea.id, status: job.status, runId: job.workflow?.runId, attemptId: job.workflow?.attemptId ?? job.id,
    step: job.workflow?.step.name ?? STAGE_LABELS[job.stage], startedAt: job.startedAt, failure,
    summary: failure?.summary ?? 'Specific cause was not recorded',
    legacyError: failure ? '' : cleanText(job.error ?? '', 4000),
    nextStep: failure?.nextStep ?? 'Read the original attempt details and the resources actually captured below before deciding what to do next.',
    unresolved, recoveryAvailable: !!(job.durable || job.nativeRuntime || job.nativeProcess || job.verificationRuntime?.some(record => record.phase !== 'terminal')),
    taskAvailable: !!conversation?.prompt.text, responseAvailable: !!conversation?.response?.text,
    workspaceId: snapshot?.workspaceId ?? job.workflow?.workspaceId, increment,
  };
}
