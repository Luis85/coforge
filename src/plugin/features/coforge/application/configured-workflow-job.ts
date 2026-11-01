import type { AgentJob } from '../domain/types';
import { copySettings, findProject, projectPaths, projectSettings } from '../domain/projects';
import { cleanText } from '../domain/sanitize';
import { errorMessage } from '../domain/errors';
import type { InternalState, StageInput, StageResult } from './ports';
import { configuredAttempt, configuredRuntime, applyConfiguredOutput } from './configured-workflow-policy';
import { assertWorkflowNotStopped } from './workflow-stop-policy';
import { recordOperation } from './population';
import { DurableBuildCapacityError } from './durable-build-ports';
import { workflowAttemptWorkspace } from '../domain/workflow-execution-step';
import { workflowRunOwner } from './workflow-run-owner';
import { effectivePolishingIdea } from './polishing-amendments';
import { providerFailureFor, providerFailureInfo, providerFailureMessage } from '../domain/provider-failure';
import { workerBackedJob } from './workflow-job-lanes';

const now = () => new Date().toISOString();
export function configuredJobInput(state: InternalState, job: AgentJob, signal?: AbortSignal, start = true): StageInput | null {
  assertWorkflowNotStopped(state, job.ideaId);
  const current = state.jobs.find(item => item.id === job.id);
  if (!current || current.status !== 'queued') return null;
  const { idea, run, attempt, snapshot } = configuredAttempt(state, current);
  if (workerBackedJob(current) && state.runtime.durableBuild?.ready === false) throw new DurableBuildCapacityError(state.runtime.durableBuild.message || 'The background worker must be checked before queued Builds can start.');
  configuredRuntime(state, idea, snapshot.step, run.external, !!snapshot.polishingId && snapshot.step.output !== 'codechange');
  const project = findProject(state, run.projectId);
  if (run.projectContext && (run.projectContext.projectPath !== project.projectPath || run.projectContext.worktreeFolder !== project.worktreeFolder)) throw new Error('This run’s project directory changed. Stop and start a fresh workflow.');
  if (start) {
    current.status = 'running'; current.startedAt = now(); attempt.status = 'running'; attempt.startedAt = current.startedAt;
    run.revision++; run.updatedAt = current.startedAt; state.runtime.activeJobId = current.id;
    recordOperation(state, 'job-started', 'none', undefined, 1, current.id);
  }
  const settings = { ...copySettings(projectSettings(state, run.projectId)), ...run.definition.limits, provider: snapshot.step.provider, model: snapshot.step.model,
    ...(snapshot.step.herdrAgent ? { herdrAgent: snapshot.step.herdrAgent } : {}), ...(run.projectContext ? { projectName: run.projectContext.name, projectBrief: run.projectContext.brief, agentPrompt: run.projectContext.agentPrompt } : {}) };
  return { jobId: current.id, stage: current.stage, idea: effectivePolishingIdea(idea), settings, integration: { ...state.integration, ...projectPaths(project) }, workflow: structuredClone(snapshot), ...(signal ? { signal } : {}) };
}

export function completeConfiguredJob(state: InternalState, job: AgentJob, result: StageResult) {
  const current = state.jobs.find(item => item.id === job.id);
  if (!current || current.status !== 'running') throw new Error('The task is no longer active.');
  const { idea, run, attempt, snapshot } = configuredAttempt(state, current);
  if (result.increment && !result.increment.simulated && !workflowAttemptWorkspace(run, snapshot.attemptId)) throw new Error('Real code changes require a verified attributed run workspace.');
  applyConfiguredOutput(snapshot.polishingId ? structuredClone(idea) : idea, run, snapshot, result, current.provider, now());
  attempt.status = 'succeeded'; attempt.finishedAt = now(); current.status = 'succeeded'; current.finishedAt = attempt.finishedAt;
  run.cursor++; run.state = snapshot.polishingId ? 'awaiting-review' : idea.screening?.verdict === 'flagged' ? 'attention' : 'ready'; delete run.activeAttemptId;
  if (run.state === 'attention') run.error = 'Resolve the moderation flag before continuing.';
  if (!snapshot.polishingId) { delete idea.lastError; idea.updatedAt = now(); }
  else if (snapshot.step.output === 'codechange' && idea.status === 'shipped') idea.status = 'review';
  run.revision++; run.updatedAt = now();
  if (state.runtime.activeJobId === current.id) delete state.runtime.activeJobId;
  recordOperation(state, 'job-completed', 'committed', undefined, 1, current.id);
  return { idea, run };
}

export function failConfiguredJob(state: InternalState, job: AgentJob, cancelled: boolean, error: unknown): void {
  const failure = providerFailureInfo(error) ?? (cancelled ? providerFailureFor('cancelled') : undefined);
  const message = cleanText(`${cancelled ? 'Cancelled. ' : ''}${failure ? providerFailureMessage(failure) : errorMessage(error)}`, 3900) || 'The step did not complete. Inspect its resources before explicitly retrying.';
  const current = state.jobs.find(item => item.id === job.id);
  if (current) { current.status = cancelled ? 'cancelled' : 'failed'; current.finishedAt = now(); current.error = message; current.failure = failure; }
  const idea = state.ideas.find(item => item.id === job.ideaId); const run = idea && job.workflow ? workflowRunOwner(idea, job.workflow.runId) : undefined;
  if (idea && run && run.id === job.workflow?.runId) {
    const attempt = run.attempts.find(item => item.id === job.workflow?.attemptId);
    if (attempt) { attempt.status = cancelled ? 'cancelled' : 'failed'; attempt.error = current?.error; attempt.finishedAt = now(); }
    const pendingChanges = job.workflow?.polishingId ? [...run.artifacts].reverse().find(artifact => artifact.hostSnapshot)?.increment : idea.increment;
    run.state = run.state === 'stopped' || state.workflowStopHolds?.includes(idea.id) ? (pendingChanges?.files.length ? 'awaiting-review' : 'stopped') : 'attention';
    run.error = current?.error; delete run.activeAttemptId; if (!job.workflow?.polishingId) idea.lastError = current?.error; run.revision++; run.updatedAt = now();
  }
  if (state.runtime.activeJobId === job.id) delete state.runtime.activeJobId;
  recordOperation(state, cancelled ? 'job-cancelled' : 'job-failed', 'none', undefined, 1, job.id);
}
