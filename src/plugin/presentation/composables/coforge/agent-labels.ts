import {
  STAGES,
  STAGE_LABELS,
  type AgentStage,
  type Settings,
} from "../../../features/coforge/domain/types";
import { stageAgent } from "../../../features/coforge/domain/stage-agents";
type AgentSettings = Pick<
  Settings,
  "provider" | "model" | "stageAgents" | "herdrAgent" | "workflow"
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
  const configured = settings.workflow?.steps.filter(
    (step) => step.kind === "ai",
  );
  const providers = new Set(
    configured
      ? configured.map((step) => step.provider)
      : STAGES.map((stage) => stageAgent(settings, stage).provider),
  );
  const mode =
    providers.size === 0
      ? "manual"
      : providers.size > 1
        ? "mixed"
        : providers.has("herdr")
          ? "herdr"
          : providers.has("claude")
            ? "claude"
            : "demo";
  return {
    mode,
    label:
      mode === "manual"
        ? "Manual workflow"
        : mode === "mixed"
          ? "Mixed providers"
          : mode === "herdr"
            ? "Herdr"
            : mode === "claude"
              ? "Claude Code CLI"
              : "Simulation",
    icon:
      mode === "manual"
        ? "clipboard-check"
        : mode === "mixed"
          ? "workflow"
          : mode === "herdr"
            ? "network"
            : mode === "claude"
              ? "bot"
              : "flask-conical",
    title: settings.workflow
      ? settings.workflow.steps
          .map(
            (step) =>
              `${step.name}: ${step.kind !== "ai" ? "Streamer" : step.provider === "demo" ? "Simulation" : `${step.provider === "herdr" ? "Herdr · Claude Code" : "Claude Code"} · ${step.model}`}`,
          )
          .join(" · ")
      : STAGES.map(
          (stage) =>
            `${STAGE_LABELS[stage]}: ${stageAgentLabel(settings, stage)}`,
        ).join(" · "),
  };
}
