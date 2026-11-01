import type { Idea } from '../../../features/coforge/domain/types';

/** Exact private run lookup for main, auxiliary and retained historical execution; never falls back. */
export function ideaWorkflowRun(idea: Idea | undefined, runId: string | undefined) {
  if (!idea || !runId) return undefined;
  if (idea.workflowRun?.id === runId) return idea.workflowRun;
  return idea.polishingRuns?.find(pass => pass.workflow.id === runId)?.workflow ?? idea.workflowHistory?.find(run => run.id === runId);
}
