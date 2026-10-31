import { oneOf, optional, shape, text } from "./check";
import { STAGES, type AgentStage, type Provider, type Settings } from "./types";

export interface StageAgent {
  provider?: Provider;
  model?: string;
  herdrAgent?: 'claude';
}
export type StageAgents = Partial<Record<AgentStage, StageAgent>>;
/** A CLI model identifier is a value, never another flag or command line. */
export const MODEL_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/;
export const agentModelCheck = text({
  trim: true,
  min: 1,
  max: 100,
  pattern: MODEL_PATTERN,
});
const providerCheck = oneOf(["demo", "claude", "herdr", "codex"] as const);
const agentCheck = shape(
  { provider: optional(providerCheck), model: optional(agentModelCheck), herdrAgent: optional(oneOf(['claude'] as const)) },
  { strict: true },
);
export const stageAgentsCheck = shape(
  {
    screen: optional(agentCheck),
    score: optional(agentCheck),
    plan: optional(agentCheck),
    implement: optional(agentCheck),
  },
  { strict: true },
);

/** Omission means inheritance. Explicit values survive later changes to project defaults. */
export function normalizeStageAgents(value: StageAgents): StageAgents {
  const checked = stageAgentsCheck(value);
  const result: StageAgents = {};
  for (const stage of STAGES) {
    const entry = checked[stage];
    if (entry && (entry.provider !== undefined || entry.model !== undefined || entry.herdrAgent !== undefined))
      result[stage] = { ...entry };
  }
  return result;
}
export function stageAgent(
  settings: Pick<Settings, "provider" | "model" | "stageAgents" | 'herdrAgent'>,
  stage: AgentStage,
): { provider: Provider; model: string; herdrAgent?: 'claude' } {
  const entry = settings.stageAgents?.[stage];
  const provider = providerCheck(entry?.provider ?? settings.provider);
  return {
    provider,
    model: agentModelCheck(entry?.model ?? settings.model),
    ...(provider === 'herdr' ? { herdrAgent: oneOf(['claude'] as const)(entry?.herdrAgent ?? settings.herdrAgent ?? 'claude') } : {}),
  };
}
export function hasClaudeStages(
  settings: Pick<Settings, "provider" | "model" | "stageAgents" | 'workflow'>,
): boolean {
  if (settings.workflow) return settings.workflow.steps.some(step => step.kind === 'ai' && step.provider === 'claude');
  return STAGES.some(
    (stage) => stageAgent(settings, stage).provider === "claude",
  );
}
export function hasNativeStages(settings: Pick<Settings, 'provider' | 'model' | 'stageAgents' | 'workflow'>): boolean {
  return hasClaudeStages(settings) || (settings.workflow
    ? settings.workflow.steps.some(step => step.kind === 'ai' && (step.provider === 'codex' || step.coworkerId !== undefined))
    : STAGES.some(stage => stageAgent(settings, stage).provider === 'codex'));
}
