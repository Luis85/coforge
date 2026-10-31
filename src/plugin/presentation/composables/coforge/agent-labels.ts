import {
  STAGES,
  STAGE_LABELS,
  type AgentStage,
  type Settings,
  type ExecutionProvider,
} from "../../../features/coforge/domain/types";
import { stageAgent } from "../../../features/coforge/domain/stage-agents";

export function screeningProviderLabel(provider: ExecutionProvider): string {
  if (provider === 'codex') return 'Codex screening';
  if (provider === 'mcp') return 'External MCP client screening';
  if (provider === 'demo') return 'Simulated screening';
  return provider === 'herdr' ? 'Herdr · Claude Code screening' : 'Claude Code screening';
}
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
    : `${agent.provider === 'codex' ? 'Codex' : agent.provider === "herdr" ? "Herdr · Claude Code" : "Claude Code"} · ${agent.model}`;
}
export function workflowProviderSummary(settings: AgentSettings, external = false, captured = false) {
  const hasCouncil = settings.workflow?.steps.some(step => step.kind === 'council') ?? false;
  const hasDelegated = hasCouncil || settings.workflow?.steps.some(step => step.kind === 'nudge') === true;
  const configured = settings.workflow?.steps.filter(
    (step) => step.kind === "ai",
  );
  const unresolvedCoworker = !captured && configured?.some(step => step.coworkerId) === true;
  const providers = new Set(
    configured
      ? configured.map((step) => step.provider)
      : STAGES.map((stage) => stageAgent(settings, stage).provider),
  );
  const mode =
    unresolvedCoworker ? 'coworker' : hasDelegated
      ? providers.size ? 'mixed' : 'delegated'
      : providers.size === 0
      ? "manual"
      : providers.size > 1
        ? "mixed"
        : providers.has("herdr")
          ? "herdr"
          : providers.has('codex') ? 'codex' : providers.has("claude")
            ? "claude"
            : "demo";
  const summary = {
    mode,
    label:
      mode === 'coworker' ? 'CoWorker workflow' : mode === 'delegated'
        ? hasCouncil ? 'Council workflow' : 'CoWorker tasks'
        : mode === "manual"
        ? "Manual workflow"
        : mode === "mixed"
          ? hasDelegated ? 'AI and delegated tasks' : "Mixed providers"
          : mode === "herdr"
            ? "Herdr"
            : mode === 'codex' ? 'Codex CLI' : mode === "claude"
              ? "Claude Code CLI"
              : "Simulation",
    icon:
      mode === 'coworker' ? 'users' : mode === 'delegated'
        ? 'users'
        : mode === "manual"
        ? "clipboard-check"
        : mode === "mixed"
          ? "workflow"
          : mode === "herdr"
            ? "network"
            : mode === 'codex' ? 'bot' : mode === "claude"
              ? "bot"
              : "flask-conical",
    title: settings.workflow
      ? settings.workflow.steps
          .map(
            (step) =>
              `${step.name}: ${step.kind === 'council' ? 'Council discussion · waits for answers' : step.kind === 'nudge' ? 'CoWorker task · admission only' : step.kind !== "ai" ? "Streamer" : step.coworkerId && !captured ? 'Assigned CoWorker · settings captured at run start' : step.provider === "demo" ? "Simulation" : `${step.provider === "codex" ? "Codex" : step.provider === "herdr" ? "Herdr · Claude Code" : "Claude Code"} · ${step.model}`}`,
          )
          .join(" · ")
      : STAGES.map(
          (stage) =>
            `${STAGE_LABELS[stage]}: ${stageAgentLabel(settings, stage)}`,
        ).join(" · "),
  };
  return external ? { ...summary, mode: 'mcp' as const, label: 'External MCP client', icon: 'plug', title: `AI steps require explicit calls from the connected MCP client. Captured native configuration: ${summary.title}` } : summary;
}
