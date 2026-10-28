import { oneOf, optional, shape, text } from "./check";
import { STAGES, type AgentStage, type Provider, type Settings } from "./types";

export interface StageAgent {
  provider?: Provider;
  model?: string;
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
const providerCheck = oneOf(["demo", "claude"] as const);
const agentCheck = shape(
  { provider: optional(providerCheck), model: optional(agentModelCheck) },
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
    if (entry && (entry.provider !== undefined || entry.model !== undefined))
      result[stage] = { ...entry };
  }
  return result;
}
export function stageAgent(
  settings: Pick<Settings, "provider" | "model" | "stageAgents">,
  stage: AgentStage,
): { provider: Provider; model: string } {
  const entry = settings.stageAgents?.[stage];
  return {
    provider: providerCheck(entry?.provider ?? settings.provider),
    model: agentModelCheck(entry?.model ?? settings.model),
  };
}
export function hasClaudeStages(
  settings: Pick<Settings, "provider" | "model" | "stageAgents">,
): boolean {
  return STAGES.some(
    (stage) => stageAgent(settings, stage).provider === "claude",
  );
}
