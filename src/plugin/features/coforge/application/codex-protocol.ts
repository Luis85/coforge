import { number, record, text } from '../domain/check';
import { validateModelEffort, type ReasoningEffort } from '../domain/provider-models';
import type { StageUsage } from '../domain/ai-usage';
import { nativeWorkflowToolsCheck, type NativeWorkflowTools } from '../domain/native-workflow-tools';
import { codexReconnectNotice, rootCodexEvents } from './codex-events';

const DISABLED = ['shell_tool', 'unified_exec', 'shell_snapshot', 'apps', 'plugins', 'hooks', 'memories', 'multi_agent', 'multi_agent_v2', 'browser_use', 'browser_use_external', 'browser_use_full_cdp_access', 'computer_use', 'image_generation', 'in_app_browser', 'code_mode', 'code_mode_host', 'workspace_dependencies', 'goals', 'skill_search', 'skill_mcp_dependency_install', 'tool_suggest'];
export interface CodexInvocation { model: string; effort?: ReasoningEffort; schemaPath: string; modelProfilePath: string; mcpUrl?: string; mcpToolTimeoutSeconds?: number; nativeTools?: NativeWorkflowTools; nativeState?: { sqliteHome: string; logDir: string } }
/** Native execution remains read-only in a private directory. Project effects use host-scoped MCP. */
export function buildCodexArgs(input: CodexInvocation): string[] {
  validateModelEffort({ provider: 'codex', model: input.model, effort: input.effort });
  const toolTimeout = input.mcpToolTimeoutSeconds === undefined ? undefined : number({ integer: true, min: 1, max: Number.MAX_SAFE_INTEGER })(input.mcpToolTimeoutSeconds);
  const config: Record<string, unknown> = { approval_policy: 'never', web_search: 'disabled', project_doc_max_bytes: 0,
    model_catalog_json: input.modelProfilePath, 'apps._default.enabled': false, 'mcp_servers': input.mcpUrl ? { coforge: { url: input.mcpUrl, bearer_token_env_var: 'COFORGE_CODEX_MCP_TOKEN', required: true, default_tools_approval_mode: 'approve', ...(toolTimeout === undefined ? {} : { tool_timeout_sec: toolTimeout }) } } : {} };
  for (const feature of DISABLED) config[`features.${feature}`] = false;
  const delegation = input.nativeTools ? nativeWorkflowToolsCheck(input.nativeTools).delegation : undefined;
  if (input.nativeTools) {
    config.model_provider = 'openai'; config.model_providers = {};
    config['history.persistence'] = 'none';
    if (input.nativeState) {
      config.sqlite_home = input.nativeState.sqliteHome.replaceAll('\\', '/');
      config.log_dir = input.nativeState.logDir.replaceAll('\\', '/');
    }
  }
  // Native V2 counts the coordinator in its session slots; the host policy counts assistants only.
  if (delegation) config['features.multi_agent_v2'] = { enabled: true, max_concurrent_threads_per_session: delegation.maxConcurrent + 1, expose_spawn_agent_model_overrides: false };
  if (input.effort) config.model_reasoning_effort = input.effort;
  // TOML inline tables are constructed below; strings use TOML-compatible JSON quoting.
  // V2 requires a registered root rollout. The SDK retains rollouts in its canonical home; its thread index is private.
  return ['exec', '--strict-config', '--ignore-user-config', '--ignore-rules', ...(!delegation ? ['--ephemeral'] : []), '--skip-git-repo-check', '--sandbox', 'read-only', '--json', '--color', 'never', '--model', input.model, '--output-schema', input.schemaPath,
    ...Object.entries(config).flatMap(([key, value]) => ['--config', `${key}=${toml(value)}`]), '-'];
}
function toml(value: unknown): string {
  if (value && typeof value === 'object' && !Array.isArray(value)) return `{ ${Object.entries(value).map(([key, item]) => `${JSON.stringify(key)} = ${toml(item)}`).join(', ')} }`;
  return JSON.stringify(value);
}
export function codexResult(raw: string, options: { delegated?: boolean } = {}): { output: unknown; usage?: StageUsage } {
  const { events, hasRootIdentity } = rootCodexEvents(raw);
  if (options.delegated && !hasRootIdentity) throw new Error('Codex did not provide a verifiable root identity for this delegated invocation.');
  const completion = events.findIndex(event => event.type === 'turn.completed');
  if (completion < 0 || events.some((event, index) => event.type === 'turn.failed' || event.type === 'error' && !(index < completion && codexReconnectNotice(event))))
    throw new Error('Codex did not complete this attempt. Review any partial worktree changes before retrying.');
  const messages = events.filter(event => event.type === 'item.completed' && record(event.item).type === 'agent_message');
  const message = messages.at(-1);
  if (!message) throw new Error('Codex did not return a structured final message.');
  return { output: JSON.parse(text({ min: 1 })(record(message.item).text)), usage: codexUsage(raw, options) };
}
/** Codex input includes cached tokens. Store the uncached remainder plus its separate cache counter. */
export function codexUsage(raw: string, options: { delegated?: boolean } = {}): StageUsage | undefined {
  // The CLI's primary-thread usage does not establish coverage of all native descendants.
  if (options.delegated) return undefined;
  try {
    const { events } = rootCodexEvents(raw);
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
