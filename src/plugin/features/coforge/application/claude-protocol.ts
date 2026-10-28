import { boolean, number, optional, record, text } from "../domain/check";
import type { AgentStage, Settings } from "../domain/types";
import { STAGE_JSON_SCHEMAS, stageSystemPrompt } from "./agent-prompts";
import {
  executionAccess,
  executionSchema,
  executionSystemPrompt,
} from "./workflow-execution";
import type { ConfiguredStepExecution } from "../domain/configured-workflow-run";
import {
  hasTokenUsage,
  stageUsageCheck,
  type StageUsage,
} from "../domain/ai-usage";

/** Claude Code 2.1.259 or later supports the restricted, structured-output flags CoForge requires. */
export function supportsRequiredVersion(version: string): boolean {
  const match = version.match(/\b(\d+)\.(\d+)\.(\d+)\b/);
  if (!match) return false;
  const [major, minor, patch] = match.slice(1).map(Number) as [
    number,
    number,
    number,
  ];
  return (
    major > 2 || (major === 2 && (minor > 1 || (minor === 1 && patch >= 259)))
  );
}

const DENY = [
  "mcp__*",
  "Bash",
  "WebFetch",
  "WebSearch",
  "NotebookEdit",
  "Agent",
  "Read(**/.env)",
  "Read(**/.env.*)",
  "Read(**/*.pem)",
  "Read(**/*.key)",
  "Read(**/.git)",
  "Read(**/.git/**)",
  "Edit(**/.git)",
  "Write(**/.git)",
  "Edit(**/.git/**)",
  "Write(**/.git/**)",
  "Edit(**/.claude/**)",
  "Write(**/.claude/**)",
  "Edit(**/package.json)",
  "Write(**/package.json)",
  "Edit(**/*lock*)",
  "Write(**/*lock*)",
];

/** The argv vector for one stage. Classification stages get no tools; planning is read-only; building may edit files. */
export function buildClaudeArgs(
  stage: AgentStage,
  settings: Settings,
  workflow?: ConfiguredStepExecution,
): string[] {
  const input = { stage, settings, ...(workflow ? { workflow } : {}) };
  const access = executionAccess(input);
  return buildRestrictedClaudeArgs(settings, {
    access, model: workflow?.step.model ?? settings.model,
    schema: workflow ? executionSchema(input) : STAGE_JSON_SCHEMAS[stage],
    systemPrompt: workflow ? executionSystemPrompt(input) : stageSystemPrompt(stage, settings),
  });
}

/** Shared native transport policy; typed note invocations do not need a fabricated Idea. */
export function buildRestrictedClaudeArgs(
  settings: Pick<Settings, 'maxTurns' | 'maxBudgetUsd'>,
  invocation: { access: 'none' | 'readproject' | 'editworktree'; model: string; schema: object; systemPrompt: string },
): string[] {
  const { access } = invocation;
  const tools =
    access === "none"
      ? ""
      : access === "readproject"
        ? "Read,Glob,Grep"
        : "Read,Glob,Grep,Edit,Write";
  return [
    "--print",
    "--output-format",
    "json",
    "--input-format",
    "text",
    "--json-schema",
    JSON.stringify(invocation.schema),
    "--restricted",
    "--safe-mode",
    "--no-session-persistence",
    "--no-chrome",
    "--setting-sources",
    "",
    "--strict-mcp-config",
    "--mcp-config",
    '{"mcpServers":{}}',
    "--tools",
    tools,
    "--disallowedTools",
    DENY.join(","),
    "--permission-mode",
    access === "editworktree" ? "acceptEdits" : "dontAsk",
    "--permission-prompts",
    "none",
    ...(tools ? ["--allowedTools", tools] : []),
    "--max-turns",
    String(settings.maxTurns),
    "--max-budget-usd",
    String(settings.maxBudgetUsd),
    "--model",
    invocation.model,
    "--system-prompt",
    invocation.systemPrompt,
  ];
}

/** Accepts only a successful result envelope with structured output; never falls back to free-form prose. */
export function parseClaudeEnvelope(raw: string): {
  output: unknown;
  costUsd?: number;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.trim());
  } catch {
    throw new Error("Claude returned invalid JSON. The idea was not advanced.");
  }
  let envelope: Record<string, unknown>;
  try {
    envelope = record(parsed);
    if (envelope.type !== "result") throw new Error("type");
    text()(envelope.subtype);
    boolean(envelope.is_error);
    optional(number({ min: 0 }))(envelope.total_cost_usd);
  } catch {
    throw new Error(
      "Claude returned an unexpected result envelope. The idea was not advanced.",
    );
  }
  if (envelope.is_error || envelope.subtype !== "success")
    throw new Error(
      `Claude did not complete successfully (${String(envelope.subtype)}). Check authentication, budget and turn limits.`,
    );
  if (envelope.structured_output === undefined)
    throw new Error(
      "Claude did not return structured_output. Update Claude Code or inspect the configured model; the idea was not advanced.",
    );
  const cost = envelope.total_cost_usd;
  return {
    output: envelope.structured_output,
    ...(typeof cost === "number" ? { costUsd: cost } : {}),
  };
}
/** Usage may be present on failed SDK envelopes or before structured-output interpretation fails. */
export function reportedClaudeCost(raw: string): number | undefined {
  try {
    const envelope = record(JSON.parse(raw));
    if (
      envelope.type !== "result" ||
      typeof envelope.is_error !== "boolean" ||
      typeof envelope.subtype !== "string" ||
      envelope.total_cost_usd === undefined
    )
      return undefined;
    return number({ min: 0, max: 1000000000 })(envelope.total_cost_usd);
  } catch {
    return undefined;
  }
}

/** Result-envelope usage is cumulative for this attempt; never add modelUsage onto the same counters. */
export function reportedClaudeUsage(raw: string): StageUsage | undefined {
  try {
    const envelope = record(JSON.parse(raw));
    if (
      envelope.type !== "result" ||
      typeof envelope.is_error !== "boolean" ||
      typeof envelope.subtype !== "string" ||
      envelope.usage === undefined
    )
      return undefined;
    const usage = record(envelope.usage);
    const checked = stageUsageCheck({
      ...(usage.input_tokens == null
        ? {}
        : { inputTokens: usage.input_tokens }),
      ...(usage.output_tokens == null
        ? {}
        : { outputTokens: usage.output_tokens }),
      ...(usage.cache_read_input_tokens == null
        ? {}
        : { cacheReadInputTokens: usage.cache_read_input_tokens }),
      ...(usage.cache_creation_input_tokens == null
        ? {}
        : { cacheCreationInputTokens: usage.cache_creation_input_tokens }),
    });
    return hasTokenUsage(checked) ? checked : undefined;
  } catch {
    return undefined;
  }
}
