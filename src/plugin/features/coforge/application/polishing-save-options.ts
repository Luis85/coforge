import type { AgentJob, Idea } from '../domain/types';
import type { SaveOptions, InternalState } from './ports';
import type { WorkflowRun } from '../domain/configured-workflow-run';
import { workflowRunOwner } from './workflow-run-owner';
export const workflowRunSaveOptions = (run: WorkflowRun | undefined, idea?: Idea): SaveOptions => run?.backgroundRetries?.length || run?.polishingResources?.length || idea?.polishingRuns?.length || idea?.polishingAmendments?.length ? { atomicCommand: true } : {};
export function polishingSaveOptions(job: Pick<AgentJob, 'workflow' | 'ideaId'> | undefined, state?: Pick<InternalState, 'ideas'> | (() => Pick<InternalState, 'ideas'>)): SaveOptions {
  if (job?.workflow?.polishingId || job?.workflow?.backgroundRetryId || job?.workflow?.approvedPolishingInputs?.length) return { atomicCommand: true };
  const current = typeof state === 'function' ? state() : state;
  const idea = current?.ideas.find(item => item.id === job?.ideaId);
  return workflowRunSaveOptions(idea && job?.workflow ? workflowRunOwner(idea, job.workflow.runId) : undefined, idea);
}
