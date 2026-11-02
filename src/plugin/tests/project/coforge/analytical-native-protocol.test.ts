import { expect, it } from 'vitest';
import type { StageInput } from '../../../features/coforge/application/ports';
import { createSeed, defaultIntegration, defaultSettings } from '../../../features/coforge/domain/seed';
import { brokeredClaudeArgs, claudeNativeDefinitions } from '../../../infrastructure/coforge/claude-native-tools';
import { buildCodexArgs } from '../../../features/coforge/application/codex-protocol';
import { restrictedCodexModel } from '../../../infrastructure/coforge/codex-model-profile';
import { executionSystemPrompt } from '../../../features/coforge/application/workflow-execution';
import { defaultWorkflowDefinition } from '../../../features/coforge/domain/configured-workflow';
import { hasLegacyBuildInstructions, legacyBuildInstructions } from '../../../features/coforge/domain/stage-prompts';

const tools = { delegation: { maxConcurrent: 2 }, research: true };
function input(): StageInput {
  return { stage: 'plan', idea: createSeed().ideas[0]!, settings: defaultSettings(), integration: defaultIntegration(),
    workflow: { runId: 'run', attemptId: 'attempt', definitionRevision: 'definition', proposalRevision: 'proposal', inputArtifacts: [],
      lifecycle: { version: 1, mode: 'managed-session' }, analyticalTools: { version: 1, profile: 'scoped-analyst-v1' },
      step: { id: 'refine', name: 'Refine', kind: 'ai', provider: 'claude', model: 'sonnet', output: 'markdown', access: 'readproject', instructions: 'Research using specialist assistants', automatic: false, nativeTools: tools } } };
}
it('allows native Claude research in parent and scoped assistants while retaining file/shell/write denials', () => {
  const value = input(), args = brokeredClaudeArgs(value, '/private/broker.json'), agents = claudeNativeDefinitions(value);
  for (const name of ['WebFetch', 'WebSearch']) {
    expect(args[args.indexOf('--tools') + 1]!.split(',')).toContain(name);
    expect(args[args.indexOf('--disallowedTools') + 1]!.split(',')).not.toContain(name);
    expect(agents['coforge-worker'].tools).toContain(name);
  }
  for (const name of ['Bash', 'PowerShell', 'Read', 'Write', 'Edit']) {
    expect(args[args.indexOf('--tools') + 1]!.split(',')).not.toContain(name);
    expect(agents['coforge-worker'].tools).not.toContain(name);
  }
  expect(agents['coforge-worker'].tools).toContain('mcp__coforge__coforge_read_file');
  expect(agents['coforge-worker'].tools).not.toContain('mcp__coforge__coforge_write_file');
  expect(executionSystemPrompt(value)).not.toContain('web research, unrelated MCP servers');
  expect(executionSystemPrompt(value)).toContain('Cite');
  expect(executionSystemPrompt(value)).toContain('Separate optional feature proposals from committed scope');
  expect(executionSystemPrompt(value)).toContain('They do not qualify live-model answer quality');
});
it('enables Codex hosted live research without granting command networking, native shell or repository writes', () => {
  const args = buildCodexArgs({ model: 'gpt-6.1-sol', schemaPath: '/private/schema.json', modelProfilePath: '/private/model.json', nativeTools: tools });
  expect(args).toContain('web_search="live"'); expect(args[args.indexOf('--sandbox') + 1]).toBe('read-only');
  expect(args).toContain('features.shell_tool=false'); expect(args).toContain('features.unified_exec=false');
  expect(args.join(' ')).not.toContain('sandbox_workspace_write.network_access=true');
  const metadata = { models: [{ slug: 'gpt-6.1-sol', multi_agent_version: 'v2', supports_search_tool: true }] };
  expect(restrictedCodexModel('gpt-6.1-sol', metadata, tools)).toMatchObject({ models: [{ input_modalities: ['text'], supports_search_tool: true, experimental_supported_tools: [], apply_patch_tool_type: null }] });
  expect(restrictedCodexModel('gpt-6.1-sol', metadata, { delegation: false, research: false })).toMatchObject({ models: [{ supports_search_tool: false, multi_agent_version: null }] });
});
it('aligns a new shipped Build prompt with its native tools while preserving saved legacy and custom text', () => {
  const value = input(), step = defaultWorkflowDefinition(defaultSettings()).steps.find(step => step.id === 'implement');
  if (step?.kind !== 'ai') throw new Error('Missing default Build');
  value.stage = 'implement'; value.workflow!.step = step; value.workflow!.worktreeCoding = { version: 1, profile: 'native-worktree-v1', maxConcurrent: 2 };
  const prompt = executionSystemPrompt(value);
  expect(prompt).not.toContain('Do not execute commands or install dependencies');
  expect(prompt).not.toContain('marks tests as not run'); expect(prompt).toContain('shell, test and build tools');
  const old = legacyBuildInstructions + '\n\nCustom owner orchestration';
  expect(hasLegacyBuildInstructions(old)).toBe(true); expect(hasLegacyBuildInstructions('Owner says do not execute commands')).toBe(false);
  value.workflow!.step = { ...step, instructions: old };
  expect(executionSystemPrompt(value)).toContain(old); expect(value.workflow!.step.instructions).toBe(old);
});
it('keeps prompt-only analysts and their assistants from being instructed to discover unavailable repository tools', () => {
  const value = input(); value.workflow!.step.access = 'none';
  const args = brokeredClaudeArgs(value, '/private/broker.json'), definitions = claudeNativeDefinitions(value);
  for (const prompt of [args[args.indexOf('--system-prompt') + 1]!, ...Object.values(definitions).map(agent => agent.prompt)]) {
    expect(prompt).toContain('No repository-file tools are available'); expect(prompt).not.toContain('use coforge_list_files');
  }
  for (const agent of Object.values(definitions)) {
    expect(agent.tools.some(tool => tool.startsWith('mcp__'))).toBe(false);
    expect(agent.tools).toContain('WebSearch');
  }
});
