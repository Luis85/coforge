import type { WorkflowDefinition } from '../domain/configured-workflow';
import type { WorkflowCoworkerBinding } from '../domain/workflow-coworker-binding';
import { workflowCoworkerProfileCheck } from '../domain/workflow-coworker-binding';
import { AgentTaskNotStartedError, type AgentTaskPort } from './agent-task';
import type { InternalState } from './ports';
import type { Idea } from '../domain/types';
import { configuredRuntime } from './configured-workflow-policy';

export class WorkflowCoworkerUnavailableError extends AgentTaskNotStartedError {}

export async function prepareWorkflowCoworkers(definition: WorkflowDefinition, projectId: string, port?: AgentTaskPort): Promise<WorkflowCoworkerBinding[]> {
  const selected = definition.steps.filter(step => step.kind === 'ai' && step.coworkerId);
  if (!selected.length) return [];
  if (!port?.prepareCoworker) throw new WorkflowCoworkerUnavailableError('Saved CoWorker profiles are unavailable. Open CoForge in desktop Obsidian or choose manual configuration.');
  const bindings: WorkflowCoworkerBinding[] = [];
  const profiles = new Map<string, WorkflowCoworkerBinding['profile']>();
  for (const step of selected) {
    if (step.kind !== 'ai' || !step.coworkerId) continue;
    let profile = profiles.get(step.coworkerId);
    if (!profile) {
      try { profile = workflowCoworkerProfileCheck(await port.prepareCoworker(projectId, step.coworkerId)); }
      catch (error) { throw new WorkflowCoworkerUnavailableError(error instanceof AgentTaskNotStartedError ? error.message : 'The selected saved CoWorker could not be loaded. Refresh or repair its definition before starting.'); }
      profiles.set(step.coworkerId, profile);
    }
    if (profile.id !== step.coworkerId) throw new WorkflowCoworkerUnavailableError('The saved CoWorker identity changed while capturing this workflow.');
    bindings.push({ stepId: step.id, profile });
  }
  return bindings;
}
export function bindWorkflowCoworkers(definition: WorkflowDefinition, bindings: WorkflowCoworkerBinding[]): WorkflowDefinition {
  return { ...definition, steps: definition.steps.map(step => {
    const profile = bindings.find(binding => binding.stepId === step.id)?.profile;
    if (step.kind !== 'ai' || !profile) return step;
    const effective = { ...step, provider: profile.provider, model: profile.model };
    delete effective.effort;
    if (profile.effort !== undefined) effective.effort = profile.effort;
    return effective;
  }) };
}
export async function assertWorkflowCoworkerAvailable(profile: WorkflowCoworkerBinding['profile'], projectId: string, port?: AgentTaskPort): Promise<void> {
  if (!port?.prepareCoworker) throw new AgentTaskNotStartedError('The saved CoWorker service is unavailable. No provider request was started.');
  let current: WorkflowCoworkerBinding['profile'];
  try { current = workflowCoworkerProfileCheck(await port.prepareCoworker(projectId, profile.id)); }
  catch (error) { throw new AgentTaskNotStartedError(error instanceof AgentTaskNotStartedError ? error.message : 'The assigned saved CoWorker is unavailable or invalid. Refresh or repair its definition; no provider request was started.'); }
  if (current.id !== profile.id) throw new AgentTaskNotStartedError('The saved CoWorker identity is unavailable. No provider request was started.');
}
export async function coworkerAdmissionReady(definition: WorkflowDefinition, projectId: string, idea: Idea, state: InternalState, port?: AgentTaskPort): Promise<boolean> {
  const first = definition.steps[0];
  if (first?.kind !== 'ai' || !first.coworkerId) return true;
  const bindings = await prepareWorkflowCoworkers(definition, projectId, port);
  const effective = bindWorkflowCoworkers(definition, bindings).steps[0];
  if (effective?.kind !== 'ai') return false;
  try { configuredRuntime(state, idea, effective); return true; }
  catch { return false; }
}
