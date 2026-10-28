import {
  STAGES,
  STAGE_LABELS,
  type AgentStage,
  type Settings,
} from "../../../features/coforge/domain/types";
import { stageAgent } from "../../../features/coforge/domain/stage-agents";
type AgentSettings = Pick<
  Settings,
  "provider" | "model" | "stageAgents" | "herdrAgent"
>;
export function stageAgentLabel(
  settings: AgentSettings,
  stage: AgentStage,
): string {
  const agent = stageAgent(settings, stage);
  return agent.provider === "demo"
    ? "Simulation"
    : `${agent.provider === "herdr" ? "Herdr · Claude Code" : "Claude Code"} · ${agent.model}`;
}
export function workflowProviderSummary(settings: AgentSettings) {
  const providers = new Set(
    STAGES.map((stage) => stageAgent(settings, stage).provider),
  );
  const mode =
    providers.size > 1
      ? "mixed"
      : providers.has("herdr")
        ? "herdr"
        : providers.has("claude")
          ? "claude"
          : "demo";
  return {
    mode,
    label:
      mode === "mixed"
        ? "Mixed providers"
        : mode === "herdr"
          ? "Herdr"
          : mode === "claude"
            ? "Claude Code CLI"
            : "Simulation",
    icon:
      mode === "mixed"
        ? "workflow"
        : mode === "herdr"
          ? "network"
          : mode === "claude"
            ? "bot"
            : "flask-conical",
    title: STAGES.map(
      (stage) => `${STAGE_LABELS[stage]}: ${stageAgentLabel(settings, stage)}`,
    ).join(" · "),
  };
}
