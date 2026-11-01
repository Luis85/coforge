import type { Idea } from './types';
import type { WorkflowDefinition, WorkflowStep } from './configured-workflow';
import type { WorkflowRun } from './configured-workflow-run';

export const ownerScreeningExempt = (idea: Idea): boolean =>
  idea.screening?.provider === 'owner' && idea.screening.verdict === 'clear' && !idea.contexts?.length;
export const screeningStep = (step: WorkflowStep): boolean => step.kind === 'ai' && step.output === 'screening';
const skipsScreening = (idea?: Idea, run?: WorkflowRun): boolean =>
  !!idea && ownerScreeningExempt(idea) && (!run || run.ownerScreeningExempt === true);
export const exemptScreeningStep = (step: WorkflowStep, idea?: Idea, run?: WorkflowRun): boolean =>
  skipsScreening(idea, run) && screeningStep(step);

/** Preview the same step admission will select, without changing captured progress. */
export function nextWorkflowStep(definition: WorkflowDefinition, idea?: Idea, run?: WorkflowRun): WorkflowStep | undefined {
  return definition.steps.slice(run?.cursor ?? 0).find(step => !exemptScreeningStep(step, idea, run));
}
export function onlyOwnerScreeningRemains(definition: WorkflowDefinition, idea?: Idea, run?: WorkflowRun): boolean {
  const remaining = definition.steps.slice(run?.cursor ?? 0);
  return skipsScreening(idea, run) && remaining.length > 0 && remaining.every(screeningStep);
}
