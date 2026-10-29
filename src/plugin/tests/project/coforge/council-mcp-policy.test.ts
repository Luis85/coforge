import { expect, it } from 'vitest';
import { buildCouncilClaudeArgs, COFORGE_COUNCIL_TOOLS } from '../../../features/coforge/application/coforge-tool-policy';
it('removes every built-in action tool and loads only the host-owned CoForge MCP configuration', () => {
  const args = buildCouncilClaudeArgs({ maxTurns: 12, maxBudgetUsd: 1 }, { model: 'sonnet', schema: { type: 'object' }, systemPrompt: 'Assess', configPath: '/private/coforge-mcp.json' });
  expect(args[args.indexOf('--tools') + 1]).toBe('');
  expect(args).toContain('--restricted'); expect(args).not.toContain('--safe-mode'); expect(args).toContain('--strict-mcp-config');
  expect(JSON.parse(args[args.indexOf('--settings') + 1]!)).toEqual({ disableAllHooks: true, autoMemoryEnabled: false, claudeMdExcludes: ['**'], enabledPlugins: {} });
  expect(args[args.indexOf('--mcp-config') + 1]).toBe('/private/coforge-mcp.json');
  expect(args[args.indexOf('--setting-sources') + 1]).toBe('');
  expect(args[args.indexOf('--allowedTools') + 1]).toBe(COFORGE_COUNCIL_TOOLS.map(name => `mcp__coforge__${name}`).join(','));
  expect(args[args.indexOf('--disallowedTools') + 1]).not.toContain('mcp__*');
  expect(args[args.indexOf('--permission-mode') + 1]).toBe('dontAsk'); expect(args[args.indexOf('--permission-prompts') + 1]).toBe('none');
  expect(args).not.toContain('--dangerously-skip-permissions'); expect(args).not.toContain('--resume'); expect(args).not.toContain('--continue');
});
