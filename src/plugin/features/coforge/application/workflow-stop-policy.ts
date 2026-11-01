import type { AppState } from '../domain/types';
import type { InternalState } from './ports';
import { configuredIdea } from './configured-workflow-policy';
import { isActiveJob } from '../domain/workflow';
import type { WorkflowRun } from '../domain/configured-workflow-run';

export const workflowStopMessage = 'This workflow was stopped. Right-click its card and choose Restart workflow to start again.';
export function assertDurableWorkflowMetadata(state: InternalState, ideaId: string): void {
  if (!state.ideas.find(idea => idea.id === ideaId)?.workflowRun && state.jobs.some(job => job.ideaId === ideaId && job.durable && !job.workflow?.polishingId)) throw new Error('Restore the original managed workflow metadata before starting another run. Its retained worker evidence must remain attributable.');
}

export function assertWorkflowNotStopped(state: Pick<AppState, 'workflowStopHolds'>, ideaId: string): void {
  if (state.workflowStopHolds?.includes(ideaId)) throw new Error(workflowStopMessage);
}

/** Preserve evidence in Inbox even when asynchronous diff capture or note reconciliation arrives later. */
export function enforceWorkflowStopHolds(state: InternalState): void {
  for (const idea of state.ideas) {
    if (!state.workflowStopHolds?.includes(idea.id) || ['shipped', 'rejected'].includes(idea.status)) continue;
    idea.status = 'inbox';
    if (idea.workflowRun?.state === 'stopped' && idea.increment?.files.length && !state.jobs.some(job => job.ideaId === idea.id && isActiveJob(job))) {
      idea.workflowRun.state = 'awaiting-review'; idea.workflowRun.revision++;
    }
  }
}

export function holdWorkflow(state: InternalState, ideaId: string) {
  const idea = configuredIdea(state, ideaId);
  const run = idea.workflowRun;
  if (!run || ['shipped', 'rejected'].includes(idea.status)) throw new Error('There is no active workflow to stop.');
  state.workflowStopHolds = [...new Set([...(state.workflowStopHolds ?? []), ideaId])];
  const at = new Date().toISOString();
  for (const job of state.jobs.filter(job => job.ideaId === ideaId && job.durable && isActiveJob(job))) job.durable!.intent = 'cancel';
  for (const job of state.jobs.filter(job => job.ideaId === ideaId && job.status === 'queued')) {
    if (job.durable) continue;
    job.status = 'cancelled'; job.finishedAt = at; job.logs.push('Workflow stopped by the operator.');
  }
  const attempt = run.attempts.find(item => item.id === run.activeAttemptId);
  run.state = 'stopped'; run.revision++; run.updatedAt = at; idea.updatedAt = at;
  if (attempt?.kind !== 'ai' || attempt.status !== 'running') {
    if (attempt) { attempt.status = 'cancelled'; attempt.finishedAt = at; }
    delete run.activeAttemptId;
  }
  idea.status = 'inbox';
  return { idea, run, attempt };
}

export function releaseWorkflowStop(state: InternalState, ideaId: string, expectedRun?: Pick<WorkflowRun, 'id' | 'revision'>): void {
  if (!state.workflowStopHolds?.includes(ideaId)) throw new Error('This workflow is not stopped. Reopen the card menu and review its current actions.');
  assertDurableWorkflowMetadata(state, ideaId);
  const run = state.ideas.find(idea => idea.id === ideaId)?.workflowRun;
  if (run?.id !== expectedRun?.id || run?.revision !== expectedRun?.revision) throw new Error('The stopped workflow changed while preparing Restart. Reopen the card menu and review its current state.');
  if (state.jobs.some(job => job.ideaId === ideaId && isActiveJob(job))) throw new Error('Wait for the active attempt to settle before restarting.');
  if (run?.state === 'awaiting-review')
    throw new Error('Stopped — preserved changes need review. Open the request details and accept or request changes before restarting.');
  state.workflowStopHolds = state.workflowStopHolds.filter(id => id !== ideaId);
}
