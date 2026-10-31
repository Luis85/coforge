import { number, record, text } from '../domain/check';
import { validateModelEffort, type ReasoningEffort } from '../domain/provider-models';
import type { StageUsage } from '../domain/ai-usage';

const DISABLED = ['shell_tool', 'unified_exec', 'shell_snapshot', 'apps', 'plugins', 'hooks', 'memories', 'multi_agent', 'multi_agent_v2', 'browser_use', 'browser_use_external', 'browser_use_full_cdp_access', 'computer_use', 'image_generation', 'in_app_browser', 'code_mode', 'code_mode_host', 'workspace_dependencies', 'goals', 'skill_search', 'skill_mcp_dependency_install', 'tool_suggest'];
export interface CodexInvocation { model: string; effort?: ReasoningEffort; schemaPath: string; modelProfilePath: string; mcpUrl?: string }
/** Native execution remains read-only in a private directory. Project effects use host-scoped MCP. */
export function buildCodexArgs(input: CodexInvocation): string[] {
  validateModelEffort({ provider: 'codex', model: input.model, effort: input.effort });
  const config: Record<string, unknown> = { approval_policy: 'never', web_search: 'disabled', project_doc_max_bytes: 0,
    model_catalog_json: input.modelProfilePath, 'apps._default.enabled': false, 'mcp_servers': input.mcpUrl ? { coforge: { url: input.mcpUrl, bearer_token_env_var: 'COFORGE_CODEX_MCP_TOKEN', required: true, default_tools_approval_mode: 'approve' } } : {} };
  for (const feature of DISABLED) config[`features.${feature}`] = false;
  if (input.effort) config.model_reasoning_effort = input.effort;
  // TOML inline tables are constructed below; strings use TOML-compatible JSON quoting.
  return ['exec', '--strict-config', '--ignore-user-config', '--ignore-rules', '--ephemeral', '--skip-git-repo-check', '--sandbox', 'read-only', '--json', '--color', 'never', '--model', input.model, '--output-schema', input.schemaPath,
    ...Object.entries(config).flatMap(([key, value]) => ['--config', `${key}=${toml(value)}`]), '-'];
}
function toml(value: unknown): string {
  if (value && typeof value === 'object' && !Array.isArray(value)) return `{ ${Object.entries(value).map(([key, item]) => `${JSON.stringify(key)} = ${toml(item)}`).join(', ')} }`;
  return JSON.stringify(value);
}
export function codexResult(raw: string): { output: unknown; usage?: StageUsage } {
  const events = raw.trim().split(/\r?\n/u).filter(Boolean).map(line => record(JSON.parse(line)));
  if (!events.some(event => event.type === 'turn.completed') || events.some(event => event.type === 'turn.failed' || event.type === 'error'))
    throw new Error('Codex did not complete this attempt. Review any partial worktree changes before retrying.');
  const messages = events.filter(event => event.type === 'item.completed' && record(event.item).type === 'agent_message');
  const message = messages.at(-1);
  if (!message) throw new Error('Codex did not return a structured final message.');
  return { output: JSON.parse(text({ min: 1 })(record(message.item).text)), usage: codexUsage(raw) };
}
/** Codex input includes cached tokens. Store the uncached remainder plus its separate cache counter. */
export function codexUsage(raw: string): StageUsage | undefined {
  try {
    const events = raw.trim().split(/\r?\n/u).filter(Boolean).map(line => record(JSON.parse(line)));
    const event = [...events].reverse().find(item => item.type === 'turn.completed' && item.usage);
    if (!event) return;
    const usage = record(event.usage);
    const count = number({ integer: true, min: 0, max: Number.MAX_SAFE_INTEGER });
    const input = count(usage.input_tokens), output = count(usage.output_tokens);
    const cached = count(usage.cached_input_tokens);
    if (cached > input) return;
    return { inputTokens: input - cached, outputTokens: output, cacheReadInputTokens: cached };
  } catch { return undefined; }
}
