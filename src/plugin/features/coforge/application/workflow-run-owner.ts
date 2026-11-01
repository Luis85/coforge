import type { Idea } from '../domain/types';
import type { WorkflowRun } from '../domain/configured-workflow-run';
import type { InternalState } from './ports';

export function workflowRunOwner(idea: Idea, runId: string): WorkflowRun | undefined {
  return idea.workflowRun?.id === runId ? idea.workflowRun : idea.polishingRuns?.find(run => run.id === runId)?.workflow ?? idea.workflowHistory?.find(run => run.id === runId);
}
export function assertPolishingResolved(idea: Idea): void {
  if (idea.polishingRuns?.some(run => run.review === 'pending')) throw new Error('Review or dismiss the current polishing pass before advancing the primary workflow.');
}
export function assertPolishingMetadata(state: Pick<InternalState, 'ideas' | 'jobs'>, ideaId: string): void {
  const idea = state.ideas.find(item => item.id === ideaId);
  if (state.jobs.some(job => job.ideaId === ideaId && job.workflow?.polishingId && !idea?.polishingRuns?.some(pass => pass.id === job.workflow?.polishingId))) throw new Error('Restore the original polishing metadata before starting another writer. Its retained jobs and resources must remain attributable.');
}
