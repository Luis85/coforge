import { number, oneOf, optional, shape, text } from './check';
import { durableBuildPolicyCheck, type DurableBuildPolicy } from './durable-build';
import { agentModelCheck, stageAgent } from './stage-agents';
import { reasoningEffortCheck, validateModelEffort, type ReasoningEffort } from './provider-models';
import type { Provider, Settings } from './types';

/** Manual auxiliary pass. Its output/access contract comes from the reviewed current result. */
export interface ImprovementPassConfiguration {
  provider: Exclude<Provider, 'mcp'>; model: string; effort?: ReasoningEffort; coworkerId?: string; instructions: string;
  limits: { timeoutSeconds: number; maxTurns: number; maxBudgetUsd: number };
  /** Applied only for code changes. Text polishing uses the foreground short-task timeout. */
  execution?: DurableBuildPolicy;
}
const check = shape({ provider: oneOf(['demo', 'claude', 'codex', 'herdr'] as const), model: agentModelCheck,
  effort: optional(reasoningEffortCheck), coworkerId: optional(text({ min: 1, max: 80, pattern: /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/u })),
  instructions: text({ trim: true, min: 1, max: 8000 }), execution: optional(durableBuildPolicyCheck),
  limits: shape({ timeoutSeconds: number({ integer: true, min: 15, max: 1800 }), maxTurns: number({ integer: true, min: 1, max: 50 }), maxBudgetUsd: number({ min: 0.1, max: 20 }) }, { strict: true }),
}, { strict: true });
export function improvementPassConfigurationCheck(value: unknown): ImprovementPassConfiguration {
  const checked = check(value); validateModelEffort(checked); return checked;
}
export function defaultImprovementPass(settings: Settings): ImprovementPassConfiguration {
  const agent = stageAgent(settings, 'implement');
  return { provider: agent.provider, model: agent.model,
    instructions: 'Improve and polish the current result using the operator feedback. Preserve the request constraints and completed work. Explain the changes and remaining risks. Do not claim tests, acceptance or deployment that the host has not verified.',
    limits: { timeoutSeconds: settings.timeoutSeconds, maxTurns: settings.maxTurns, maxBudgetUsd: settings.maxBudgetUsd },
    execution: { mode: 'background', idleWarningSeconds: 1800 } };
}
