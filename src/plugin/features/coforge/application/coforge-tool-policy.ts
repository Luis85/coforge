import { buildRestrictedClaudeArgs } from './claude-protocol';
import type { Settings } from '../domain/types';
import type { ReasoningEffort } from '../domain/provider-models';

export const COFORGE_COUNCIL_TOOLS = ['coforge_invocation', 'coforge_read_input', 'coforge_nudge_agent'] as const;
/** Host-owned policy; agent notes cannot add native tools, servers, permission modes or launch arguments. */
export function buildCouncilClaudeArgs(settings: Pick<Settings, 'maxTurns' | 'maxBudgetUsd'>,
  input: { model: string; effort?: ReasoningEffort; schema: object; systemPrompt: string; configPath: string }): string[] {
  if (!input.configPath.trim()) throw new Error('A private CoForge MCP configuration is required.');
  const args = buildRestrictedClaudeArgs(settings, { access: 'none', model: input.model, effort: input.effort, schema: input.schema, systemPrompt: input.systemPrompt });
  // Safe mode suppresses even explicitly supplied MCP servers. Isolate customizations
  // individually while preserving the user's normal CLI authentication.
  args.splice(args.indexOf('--safe-mode'), 1);
  args.push('--settings', JSON.stringify({ disableAllHooks: true, autoMemoryEnabled: false, claudeMdExcludes: ['**'], enabledPlugins: {} }));
  args[args.indexOf('--mcp-config') + 1] = input.configPath;
  const deny = args.indexOf('--disallowedTools') + 1;
  args[deny] = args[deny]!.split(',').filter(name => name !== 'mcp__*').join(',');
  args.push('--disable-slash-commands', '--allowedTools', COFORGE_COUNCIL_TOOLS.map(name => `mcp__coforge__${name}`).join(','));
  return args;
}
