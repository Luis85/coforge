import { describe, expect, it } from 'vitest';
import { buildClaudeArgs } from '../../../features/coforge/application/claude-protocol';
import { stageSystemPrompt, implementationOutput } from '../../../features/coforge/application/agent-prompts';
import { executionSystemPrompt, executionTaskPrompt, executionSchema, validateExecutionOutput } from '../../../features/coforge/application/workflow-execution';
import type { StageInput } from '../../../features/coforge/application/ports';
import type { WorkflowAccess, WorkflowOutput } from '../../../features/coforge/domain/configured-workflow';
import { createSeed, defaultIntegration, defaultSettings } from '../../../features/coforge/domain/seed';
import { backgroundClaudeArgs } from '../../../infrastructure/coforge/durable-worker/claude';
import { record } from '../../../features/coforge/domain/check';

function input(access: WorkflowAccess, output: WorkflowOutput): StageInput {
  return {
    stage: 'implement', idea: createSeed().ideas[0]!, settings: defaultSettings(), integration: defaultIntegration(),
    workflow: {
      runId: 'run', definitionRevision: 'revision', proposalRevision: 'proposal', attemptId: 'attempt', inputArtifacts: [],
      step: { id: 'build', name: 'Build', kind: 'ai', instructions: 'OWNER: use dedicated subagents, run all checks and polish.',
        access, output, provider: 'claude', model: 'sonnet', automatic: false },
    },
  };
}

describe('honest increment handoffs', () => {
  it.each(['none', 'readproject', 'editworktree'] as const)('describes actual %s access without granting requested capabilities', access => {
    const request = input(access, access === 'editworktree' ? 'codechange' : 'markdown');
    const prompt = executionSystemPrompt(request);
    expect(prompt).toContain(request.workflow!.step.instructions);
    expect(prompt).toContain('The supplied CoForge request-step tools do not provide subagent delegation, command execution, test runners, browser inspection or web research');
    expect(prompt).toContain('unavailable to native workflow invocations');
    expect(prompt).toContain('an external client must identify the source');
    expect(prompt).toContain(access === 'none' ? 'No repository tools are available' : access === 'readproject' ? 'Repository access is read-only' : 'Repository access is file-only');
    expect(prompt).toContain('requires final human review');
    const args = buildClaudeArgs(request.stage, request.settings, request.workflow);
    expect(args[args.indexOf('--tools') + 1]).toBe(access === 'none' ? '' : access === 'readproject' ? 'Read,Glob,Grep' : 'Read,Glob,Grep,Edit,Write');
    for (const denied of ['Bash', 'Agent', 'WebFetch', 'WebSearch']) expect(args[args.indexOf('--disallowedTools') + 1]!.split(',')).toContain(denied);
  });

  it('requests acceptance coverage, factual verification and unfinished work within the existing summary schema', () => {
    const request = input('editworktree', 'codechange');
    const prompt = executionSystemPrompt(request);
    for (const evidence of ['delivered behavior', 'acceptance criteria', 'tests written', 'checks actually executed', 'unfinished work', 'review steps', 'unknowns']) expect(prompt).toContain(evidence);
    expect(prompt).toContain('Do not claim tests passed');
    expect(prompt).toContain('within the existing summary field');
    expect(executionSchema(request)).toMatchObject({ properties: { summary: { type: 'string', maxLength: 6000 } }, required: ['summary'], additionalProperties: false });
    const result = { summary: 'Delivered the pool. Tests written; checks not run. Styling unfinished; inspect in Obsidian.' };
    expect(validateExecutionOutput(request, result)).toEqual(result);
    expect(implementationOutput(result)).toEqual(result);
    expect(() => validateExecutionOutput(request, { ...result, testsPassed: true })).toThrow();
  });

  it('guides narrow discovery and source-backed plans without adding unselected artifacts or changing saved instructions', () => {
    const request = input('readproject', 'plan');
    const before = structuredClone(request);
    const prompt = executionSystemPrompt(request);
    for (const evidence of ['narrow listing and search', 'truncated', 'styles', 'tests', 'documentation', 'open questions', 'Do not invent owner decisions']) expect(prompt).toContain(evidence);
    expect(prompt).toContain('existing plan schema');
    expect(record(JSON.parse(executionTaskPrompt(request))).boundArtifacts).toEqual([]);
    expect(request).toEqual(before);
  });

  it('requires analytical reviews to separate prior claims from inspected evidence and unexecuted checks', () => {
    const prompt = executionSystemPrompt(input('readproject', 'markdown'));
    expect(prompt).toContain('Separate inspected source evidence from prior artifact claims');
    expect(prompt).toContain('unexecuted checks');
    expect(prompt).toContain('unresolved decisions');
  });

  it('applies the same handoff contract to legacy defaults, custom prompts and the durable Claude broker', () => {
    const settings = { ...defaultSettings(), stagePrompts: { implement: 'OWNER: implement carefully.' } };
    for (const current of [stageSystemPrompt('implement'), stageSystemPrompt('implement', settings)]) {
      expect(current).toContain('checks actually executed');
      expect(current).toContain('CoForge request-step tools do not provide subagent delegation, command execution');
    }
    expect(stageSystemPrompt('implement', settings)).toContain(settings.stagePrompts.implement);
    expect(stageSystemPrompt('plan')).toContain('open questions');
    const request = input('editworktree', 'codechange');
    const args = backgroundClaudeArgs(request, '/private/broker.json');
    const prompt = args[args.indexOf('--system-prompt') + 1]!;
    expect(prompt).toContain('checks actually executed');
    expect(prompt).toContain('Native file, shell, browser and agent tools are unavailable');
    expect(args[args.indexOf('--tools') + 1]).toBe('');
    expect(args[args.indexOf('--allowedTools') + 1]).not.toContain('Agent');
  });
});
