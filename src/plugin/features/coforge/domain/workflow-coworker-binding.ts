import { list, oneOf, optional, shape, text } from './check';
import { agentDefinitionCheck, type AgentDefinition } from './council-definitions';
import { reasoningEffortCheck, validateModelEffort, type ReasoningEffort } from './provider-models';
import { agentModelCheck } from './stage-agents';
import type { Provider } from './types';

export interface WorkflowCoworkerProfile {
  format: 'coforge-workflow-coworker/v1'; id: string; name: string; revision: string;
  role: string; instructions: string; provider: Provider; model: string; effort?: ReasoningEffort;
}
export interface WorkflowCoworkerBinding { stepId: string; profile: WorkflowCoworkerProfile }
const id = text({ min: 1, max: 80, pattern: /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/u });
const profile = shape({ format: oneOf(['coforge-workflow-coworker/v1'] as const), id,
  name: text({ min: 1, max: 100 }), revision: text({ min: 1, max: 200 }), role: text({ max: 500 }), instructions: text({ max: 16000 }),
  provider: oneOf(['demo', 'claude', 'herdr', 'codex'] as const), model: agentModelCheck, effort: optional(reasoningEffortCheck),
}, { strict: true });
export function workflowCoworkerProfileCheck(value: unknown): WorkflowCoworkerProfile {
  const checked = profile(value); validateModelEffort(checked); return checked;
}
export const workflowCoworkerBindingsCheck = list(shape({ stepId: id, profile: workflowCoworkerProfileCheck }, { strict: true }), { max: 40 });

/** Captured configuration is context, never an access or delegation grant. */
export function captureWorkflowCoworker(value: AgentDefinition, revision: string): WorkflowCoworkerProfile {
  const agent = agentDefinitionCheck(value);
  if (!agent.enabled) throw new Error('The selected CoWorker is disabled. Choose an enabled saved CoWorker.');
  return workflowCoworkerProfileCheck({ format: 'coforge-workflow-coworker/v1', id: agent.id, name: agent.name, revision,
    role: agent.role, instructions: agent.instructions, provider: agent.provider, model: agent.model,
    ...(agent.effort === undefined ? {} : { effort: agent.effort }) });
}
