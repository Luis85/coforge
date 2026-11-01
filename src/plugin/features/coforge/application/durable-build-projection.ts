import type { AgentJob } from '../domain/types';
import { ideaProjectId } from '../domain/projects';
import { USAGE_COUNTERS } from '../domain/ai-usage';
import { durableBuildTerminal } from '../domain/durable-build';
import { recordOperation } from './population';
import type { DurableBuildSnapshot } from '../domain/durable-build';
import type { InternalState, StageResult } from './ports';
import { appendWorkflowArtifact, configuredChanges, projectWorkflowChanges } from './configured-workflow-policy';
import { failConfiguredJob } from './configured-workflow-job';
import { currentWorkspaceAttempt, workflowAttemptWorkspace } from '../domain/workflow-execution-step';
import { assignProviderFailure } from '../domain/provider-failure';

/** Retain independently captured evidence even after Stop; advancement is a separate guarded operation. */
export function projectDurableBuild(state: InternalState, job: AgentJob, snapshot: DurableBuildSnapshot, complete: (state: InternalState, job: AgentJob, result: StageResult) => void): void {
  job.logs = [...snapshot.logs];
  if (snapshot.conversation) job.conversation = structuredClone(snapshot.conversation);
  if (snapshot.verification) job.verification = structuredClone(snapshot.verification);
  if (snapshot.sessionTrace) job.sessionTrace = structuredClone(snapshot.sessionTrace);
  if (snapshot.failure) job.failure = structuredClone(snapshot.failure);
  const cost = snapshot.costUsd ?? snapshot.result?.costUsd;
  if (cost !== undefined) job.costUsd = Math.max(job.costUsd ?? 0, cost);
  const usage = snapshot.usage ?? snapshot.result?.usage;
  if (usage) { job.usage ??= {}; for (const key of USAGE_COUNTERS) if (usage[key] !== undefined) job.usage[key] = Math.max(job.usage[key] ?? 0, usage[key]); }
  let original: ReturnType<typeof configuredChanges>;
  try { original = configuredChanges(state, job); }
  catch (error) {
    if (!durableBuildTerminal(snapshot.phase) || job.durable?.intent !== 'cancel') throw error;
    job.status = 'cancelled'; job.finishedAt = new Date().toISOString(); job.error = 'The original request metadata is unavailable. Its cancelled worker result and workspace evidence remain private; restore the original metadata before reviewing code.';
    recordOperation(state, 'job-cancelled', 'none', undefined, 1, job.id); return;
  }
  const { idea, run, snapshot: execution } = original;
  const before = `${run.workspaceId ?? ''}:${run.artifacts.length}:${run.state}:${run.error ?? ''}`;
  if (snapshot.workspaceId) {
    const expected = workflowAttemptWorkspace(run, execution.attemptId);
    const approval = run.backgroundRetries?.find(item => item.id === execution.backgroundRetryId && item.attemptId === execution.attemptId && item.jobId === job.id);
    if (expected && expected !== snapshot.workspaceId || approval?.priorWorkspaceId === snapshot.workspaceId) throw new Error('The original background workspace identity changed; retries require a fresh owned workspace.');
    if (currentWorkspaceAttempt(run, execution.attemptId)) run.workspaceId = snapshot.workspaceId;
    if (job.workflow) job.workflow.workspaceId = snapshot.workspaceId;
  }
  const increment = snapshot.workspaceCaptured ? snapshot.increment : snapshot.result ? snapshot.result.increment : snapshot.increment;
  const capturedEmpty = durableBuildTerminal(snapshot.phase) && snapshot.workspaceCaptured === true && snapshot.workspaceId && !increment;
  if (increment || capturedEmpty) {
    if (increment?.simulated || !workflowAttemptWorkspace(run, execution.attemptId)) throw new Error('Background code changes require a verified real worktree owned by this attempt.');
    const existing = [...run.artifacts].reverse().find(artifact => artifact.attemptId === execution.attemptId && artifact.hostSnapshot);
    if (!existing || JSON.stringify(existing.increment) !== JSON.stringify(increment)) appendWorkflowArtifact(run, execution, { output: 'codechange', hostSnapshot: true, summary: increment?.summary ?? 'No pending code changes.', ...(increment ? { increment } : {}) }, new Date().toISOString());
    if (idea.workflowRun?.id === run.id && ideaProjectId(idea) === run.projectId && !['shipped', 'rejected'].includes(idea.status)) projectWorkflowChanges(idea, run);
  }
  if (snapshot.phase === 'attention') { run.state = 'attention'; run.error = snapshot.error ?? 'The original worker needs inspection. Its Build lane remains reserved.'; }
  if (!['completed', 'failed', 'cancelled'].includes(snapshot.phase)) {
    if (before !== `${run.workspaceId ?? ''}:${run.artifacts.length}:${run.state}:${run.error ?? ''}`) { run.revision++; run.updatedAt = new Date().toISOString(); }
    return;
  }
  if (snapshot.phase === 'completed' && job.durable?.intent !== 'cancel' && !state.workflowStopHolds?.includes(job.ideaId)) {
    if (!snapshot.result) throw new Error('The worker reported completion without a retained validated result.');
    try {
      run.state = 'running';
      complete(state, job, snapshot.result);
    } catch {
      failConfiguredJob(state, job, false, new Error('The original request or execution changed. Its worker result was preserved; review the original work before starting again.'));
    }
  } else { const error = new Error(snapshot.error ?? 'Background Build stopped. Inspect its preserved worktree before retrying.');
    failConfiguredJob(state, job, snapshot.phase === 'cancelled' || job.durable?.intent === 'cancel', snapshot.failure ? assignProviderFailure(error, snapshot.failure) : error); }
}
