import { contextEventId } from '../domain/integrity';
import { councilTaskBindingCheck, type CouncilTaskBinding } from '../domain/workflow-council-binding';
import type { CouncilWorkflowStep } from '../domain/configured-workflow';
import type { WorkflowRun } from '../domain/configured-workflow-run';
import type { StudioProject, Idea } from '../domain/types';
import { encodeCouncilPlan, type resolveCouncilPlan } from './council-execution';
import { configuredInputs } from './configured-workflow-policy';
import { AgentTaskNotStartedError } from './agent-task';

/** A private compatibility binding; execution remains the existing captured Council v2 admission. */
export function workflowCouncilProjectContext(project: StudioProject) {
  return { name: project.settings.projectName, brief: project.settings.projectBrief, agentPrompt: project.settings.agentPrompt, projectPath: project.projectPath, worktreeFolder: project.worktreeFolder };
}
export function captureWorkflowCouncil(plan: ReturnType<typeof resolveCouncilPlan>, project: StudioProject): CouncilTaskBinding {
  const context = workflowCouncilProjectContext(project);
  return councilTaskBindingCheck({ format: 'coforge-council-binding/v1', projectId: project.id,
    councilId: plan.definition.id, councilName: plan.definition.name,
    identity: contextEventId(JSON.stringify([encodeCouncilPlan(plan), context])),
    members: [...new Map(plan.invocations.map(item => [item.agent.id, item.agent])).values()].map(agent => ({ id: agent.id, name: agent.name, provider: agent.provider, model: agent.model })),
  });
}
export function councilWorkflowInputs(run: WorkflowRun, step: CouncilWorkflowStep, idea?: Idea) {
  if (step.contextMode === 'none') return [];
  if (step.contextMode === 'selected' && !step.inputs?.length) throw new AgentTaskNotStartedError('Choose at least one earlier result role, or choose no earlier results.');
  return configuredInputs(run, step.contextMode === 'all' ? { inputs: [] } : step, idea?.workflowHistory, idea);
}
export function workflowCouncilBinding(run: WorkflowRun, step: CouncilWorkflowStep): CouncilTaskBinding {
  const captured = run.councilBindings?.find(item => item.stepId === step.id)?.binding;
  if (!captured || captured.councilId !== step.councilId || captured.projectId !== run.projectId)
    throw new AgentTaskNotStartedError('This workflow has no captured Council setup. Stop it, review the Council and start a new workflow. Existing child discussions remain available.');
  return captured;
}
