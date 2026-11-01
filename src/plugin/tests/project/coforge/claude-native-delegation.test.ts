import { expect, it } from 'vitest';
import { join } from 'node:path';
import type { StageInput } from '../../../features/coforge/application/ports';
import { createSeed, defaultIntegration, defaultSettings } from '../../../features/coforge/domain/seed';
import { backgroundClaudeArgs } from '../../../infrastructure/coforge/durable-worker/claude';
import { claudeNativeDefinitions } from '../../../infrastructure/coforge/claude-native-tools';

function input(): StageInput {
  return { stage: 'implement', idea: createSeed().ideas[0]!, settings: defaultSettings(), integration: defaultIntegration(),
    workflow: { runId: 'run', attemptId: 'attempt', definitionRevision: 'definition', proposalRevision: 'proposal', inputArtifacts: [],
      step: { id: 'build', name: 'Build', kind: 'ai', output: 'codechange', access: 'editworktree', provider: 'claude', model: 'sonnet',
        instructions: 'Implement with native workers.', automatic: false, nativeTools: { delegation: { maxConcurrent: 2 } } } } };
}
it('lets the provider coordinate bounded native workers without native repository or shell tools', () => {
  const args = backgroundClaudeArgs(input(), '/private/broker.json');
  expect(args[args.indexOf('--tools') + 1]).toBe('Agent,StructuredOutput');
  expect(args[args.indexOf('--agent') + 1]).toBe('coforge-coordinator');
  expect(args[args.indexOf('--agents') + 1]).toBe(join('/private', 'agents.json'));
  expect(args[args.indexOf('--allowedTools') + 1]).toContain('Agent(coforge-worker)');
  expect(args[args.indexOf('--allowedTools') + 1]).toContain('StructuredOutput');
  const denied = args[args.indexOf('--disallowedTools') + 1]!.split(',');
  expect(denied).not.toContain('Agent');
  for (const name of ['Read', 'Glob', 'Grep', 'Edit', 'Write', 'Bash', 'PowerShell', 'WebFetch', 'WebSearch']) expect(denied).toContain(name);
  const settings = JSON.parse(args[args.indexOf('--settings') + 1]!);
  expect(settings).toMatchObject({ disableAllHooks: true, autoMemoryEnabled: false, enabledPlugins: {},
    env: { CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS: '2', CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH: '1', CLAUDE_CODE_DISABLE_BACKGROUND_TASKS: '1' } });
  expect(args).not.toContain('--dangerously-skip-permissions');
});
it('does not enable native delegation when it was not captured', () => {
  const request = input(); delete request.workflow!.step.nativeTools;
  const args = backgroundClaudeArgs(request, '/private/broker.json');
  expect(args[args.indexOf('--tools') + 1]).toBe('');
  expect(args).not.toContain('--agents');
  expect(args[args.indexOf('--disallowedTools') + 1]!.split(',')).toContain('Agent');
});
it('tells both native contexts that the private CLI cwd is not the repository file-tool root', () => {
  const definitions = claudeNativeDefinitions(input());
  for (const definition of Object.values(definitions)) {
    expect(definition.prompt).toContain('repository-relative forward-slash paths');
    expect(definition.prompt).toContain('private transport directory');
    expect(definition.prompt).toContain('Never turn a relative repository path into an absolute path');
  }
});
it('keeps the native MCP call timeout above the finite captured verification queue budget without delegation', () => {
  const request = input(); request.workflow!.step.nativeTools = { verification: { commandIds: ['check'] } };
  request.workflow!.verificationProfile = { enabled: true, dockerBin: 'docker', imageId: 'sha256:' + 'a'.repeat(64), timeoutSeconds: 1800, maxRuns: 32,
    commands: [{ id: 'check', label: 'Checks', executable: 'node', args: ['--test'] }] };
  const args = backgroundClaudeArgs(request, '/private/broker.json');
  expect(JSON.parse(args[args.indexOf('--settings') + 1]!).env.MCP_TOOL_TIMEOUT).toBe(String(((1800 + 60) * 32 + 60) * 1000));
  expect(args[args.indexOf('--tools') + 1]).toBe('');
});
