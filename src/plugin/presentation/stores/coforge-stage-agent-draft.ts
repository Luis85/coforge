import type { AgentStage, Provider } from "../../features/coforge/domain/types";
import { STAGES } from "../../features/coforge/domain/types";
import {
  normalizeStageAgents,
  type StageAgents,
} from "../../features/coforge/domain/stage-agents";

export interface StageAgentDraft {
  provider: Provider | "";
  model: string;
}
export type StageAgentDrafts = Record<AgentStage, StageAgentDraft>;

/** Empty form fields mean inheritance; explicit choices stay explicit even when equal to current defaults. */
export function stageAgentDrafts(value?: StageAgents): StageAgentDrafts {
  const entry = (stage: AgentStage): StageAgentDraft => ({
    provider: value?.[stage]?.provider ?? "",
    model: value?.[stage]?.model ?? "",
  });
  return {
    screen: entry("screen"),
    score: entry("score"),
    plan: entry("plan"),
    implement: entry("implement"),
  };
}
export function copyStageAgentDrafts(
  value: StageAgentDrafts,
): StageAgentDrafts {
  return {
    screen: { ...value.screen },
    score: { ...value.score },
    plan: { ...value.plan },
    implement: { ...value.implement },
  };
}
export function stageAgentDraftValues(drafts: StageAgentDrafts): StageAgents {
  const value: StageAgents = {};
  for (const stage of STAGES) {
    const draft = drafts[stage];
    const model = draft.model.trim();
    if (draft.provider || model)
      value[stage] = {
        ...(draft.provider ? { provider: draft.provider } : {}),
        ...(model ? { model } : {}),
      };
  }
  return value;
}
export const stageAgentOverrides = (drafts: StageAgentDrafts): StageAgents =>
  normalizeStageAgents(stageAgentDraftValues(drafts));
