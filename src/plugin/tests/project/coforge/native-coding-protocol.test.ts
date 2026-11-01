import { expect, it } from 'vitest';
import { buildNativeCodexArgs, buildNativeClaudeArgs } from '../../../features/coforge/application/native-coding-protocol';
import { defaultSettings } from '../../../features/coforge/domain/seed';

const profile = { version: 1 as const, profile: 'native-worktree-v1' as const, maxConcurrent: 2 };
it('uses native Codex workspace permissions and bounded native assistants without broker-only tool/model restrictions', () => {
  const args = buildNativeCodexArgs({ model: 'gpt-6.1-sol', schemaPath: '/transport/schema.json', modelProfilePath: '/transport/model.json', nativeCoding: profile,
    nativeState: { sqliteHome: '/transport/sqlite', logDir: '/transport/logs' }, windows: true });
  expect(args[args.indexOf('--sandbox') + 1]).toBe('workspace-write'); expect(args).toContain('approval_policy="never"');
  expect(args).toContain('features.shell_tool=true'); expect(args).toContain('features.unified_exec=true'); expect(args.join(' ')).toContain('max_concurrent_threads_per_session');
  expect(args.join(' ')).toContain('expose_spawn_agent_model_overrides'); expect(args).not.toContain('--ephemeral');
  expect(args).not.toContain('project_doc_max_bytes=0'); expect(args.join(' ')).not.toContain('dangerously'); expect(args.join(' ')).not.toContain('COFORGE_CODEX_MCP_TOKEN');
  expect(args).toContain('--ignore-user-config'); expect(args).toContain('features.hooks=false'); expect(args).toContain('features.plugins=false');
  expect(args).toContain('windows.sandbox="unelevated"');
  expect(args).toContain('sandbox_workspace_write.network_access=true');
  expect(args).toContain('web_search="live"');
});
it('permits ordinary Claude coding tools with inherited native workers and normal sign-in, not a permission bypass', () => {
  const args = buildNativeClaudeArgs({ ...defaultSettings(), maxTurns: 12, maxBudgetUsd: 1 }, { model: 'sonnet', nativeCoding: profile,
    schema: { type: 'object' }, instructions: 'Captured owner instructions' });
  expect(args).toContain('--restricted'); expect(args[args.indexOf('--permission-mode') + 1]).toBe('acceptEdits');
  expect(args[args.indexOf('--permission-prompts') + 1]).toBe('none'); expect(args[args.indexOf('--tools') + 1]).toContain('Bash');
  expect(args[args.indexOf('--tools') + 1]).toContain('Edit'); expect(args[args.indexOf('--allowedTools') + 1]).toContain('Bash');
  expect(args[args.indexOf('--tools') + 1]).toContain('TaskGet'); expect(args[args.indexOf('--tools') + 1]).toContain('TaskStop');
  expect(args).toContain('--append-system-prompt'); expect(args).not.toContain('--safe-mode'); expect(args).not.toContain('--bare'); expect(args.join(' ')).not.toContain('dangerously');
  const agents = JSON.parse(args[args.indexOf('--agents') + 1]!);
  expect(agents['coforge-native-coder']).toMatchObject({ model: 'inherit', permissionMode: 'acceptEdits' });
  expect(agents['coforge-native-coder'].tools).toContain('Bash'); expect(agents['coforge-native-coder'].omitClaudeMd).not.toBe(true);
  expect(agents['coforge-native-coder'].prompt).toContain('Leave task edits uncommitted');
  expect(JSON.parse(args[args.indexOf('--settings') + 1]!).env.CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS).toBe('2');
});
