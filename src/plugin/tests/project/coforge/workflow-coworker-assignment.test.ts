import { expect, it, vi } from 'vitest';
import { WorkflowEngine } from '../../../features/coforge/application/engine';
import { defaultWorkflowDefinition, workflowDefinitionCheck } from '../../../features/coforge/domain/configured-workflow';
import { createSeed, defaultIntegration, defaultSettings } from '../../../features/coforge/domain/seed';
import { executionSystemPrompt, executionTaskPrompt } from '../../../features/coforge/application/workflow-execution';
import { buildClaudeArgs } from '../../../features/coforge/application/claude-protocol';
import { workflowRunCheck, configuredStepExecutionCheck } from '../../../features/coforge/domain/configured-workflow-run';
import { collectCostTasks } from '../../../features/coforge/domain/ai-cost-snapshot';
import { AgentTaskNotStartedError } from '../../../features/coforge/application/agent-task';
import type { StageInput } from '../../../features/coforge/application/ports';
import { seededStore, nodeTimers } from './memory-storage';

const profile = () => ({ format: 'coforge-workflow-coworker/v1' as const, id: 'reviewer', name: 'Saved reviewer', revision: 'agent-revision-one', role: 'Architect', instructions: 'Inspect compatibility carefully.', provider: 'claude' as const, model: 'sonnet', effort: 'high' as const });
const definition = () => workflowDefinitionCheck({ ...defaultWorkflowDefinition(defaultSettings()), revision: 'assigned-v1', steps: [
  { id: 'review', name: 'Review', kind: 'approval', instructions: 'Review the request.' },
  { id: 'analysis', name: 'Analysis', kind: 'ai', coworkerId: 'reviewer', instructions: 'Explain the smallest useful next increment.', provider: 'demo', model: 'sonnet', automatic: true, output: 'markdown', access: 'none' },
] });

it('captures CoWorker settings and persona for the run, preserving step instructions and access after later edits', async () => {
  const { store } = await seededStore();
  let current = profile();
  const seen: StageInput[] = [];
  const runner = vi.fn(async (input: StageInput) => { seen.push(input); return { markdown: '# Captured contribution' }; });
  const prepareCoworker = vi.fn(async () => structuredClone(current));
  const engine = new WorkflowEngine(store, { runners: { demo: runner, claude: runner }, timers: nodeTimers(), agentTasks: { create: async () => { throw new Error('No delegation'); }, prepareCoworker } });
  await store.transaction(state => { state.settings.workflow = definition(); state.settings.paused = false; state.runtime.cliAvailable = true; });
  const idea = store.snapshot().ideas.find(item => item.status === 'inbox')!;
  try {
    await engine.startWorkflow(idea.id);
    const admitted = store.snapshot().ideas.find(item => item.id === idea.id)!.workflowRun!;
    expect(admitted.definition.steps[1]).toMatchObject({ coworkerId: 'reviewer', provider: 'claude', model: 'sonnet', effort: 'high', access: 'none', instructions: 'Explain the smallest useful next increment.' });
    expect(admitted.coworkerBindings?.[0]).toMatchObject({ stepId: 'analysis', profile: { id: 'reviewer', revision: 'agent-revision-one', name: 'Saved reviewer' } });
    current = { ...current, model: 'opus', instructions: 'Changed after admission.' };
    await engine.completeWorkflowManual(idea.id, admitted.revision, [], 'Reviewed');
    await engine.waitUntilIdle();
    expect(seen).toHaveLength(1);
    const input = seen[0]!;
    expect(input.workflow?.coworker).toMatchObject({ id: 'reviewer', model: 'sonnet', instructions: 'Inspect compatibility carefully.' });
    expect(input.settings).toMatchObject({ provider: 'claude', model: 'sonnet' });
    expect(executionSystemPrompt(input)).toContain('captured assignedCoworker');
    expect(executionTaskPrompt(input)).toContain('Inspect compatibility carefully.');
    expect(executionTaskPrompt(input)).not.toContain('Changed after admission.');
    expect(configuredStepExecutionCheck(input.workflow)).toMatchObject({ coworker: { revision: 'agent-revision-one' } });
    expect(() => configuredStepExecutionCheck({ ...input.workflow, coworker: { ...input.workflow?.coworker, id: 'another-agent' } })).toThrow('CoWorker');
    const saved = store.snapshot();
    expect(workflowRunCheck(saved.ideas.find(item => item.id === idea.id)!.workflowRun)).toMatchObject({ coworkerBindings: [{ profile: { name: 'Saved reviewer' } }] });
    expect(collectCostTasks(saved, [])[0]?.attribution).toMatchObject({ kind: 'agent', agentId: 'reviewer', agentName: 'Saved reviewer', agentRevision: 'agent-revision-one', agentNamespace: 'reusable' });
    expect(store.snapshot().settings.workflow?.steps[1]).toMatchObject({ provider: 'demo' });
  } finally { await engine.stop(); }
});

it('keeps a complete long CoWorker persona in task input instead of growing native system-prompt arguments', () => {
  const source = definition(); const step = source.steps[1]!;
  if (step.kind !== 'ai') throw new Error('Expected AI step');
  const coworker = { ...profile(), instructions: `${'x'.repeat(15900)} END OF SAVED PERSONA` };
  const input: StageInput = { stage: 'plan', idea: createSeed().ideas[0]!, settings: defaultSettings(), integration: defaultIntegration(),
    workflow: { runId: 'run', definitionRevision: source.revision, proposalRevision: 'proposal', attemptId: 'attempt', inputArtifacts: [], step: { ...step, provider: coworker.provider, model: coworker.model, effort: coworker.effort }, coworker } };
  expect(executionTaskPrompt(input)).toContain(coworker.instructions);
  expect(executionSystemPrompt(input)).not.toContain(coworker.instructions);
  const args = buildClaudeArgs(input.stage, input.settings, input.workflow);
  expect(args[args.indexOf('--system-prompt') + 1]).not.toContain(coworker.instructions);
  expect(args.join(' ').length).toBeLessThan(20000);
});

it('does not admit assigned work when its saved CoWorker cannot be resolved', async () => {
  const { store, storage } = await seededStore();
  const runner = vi.fn(async () => ({ markdown: 'Unexpected' }));
  const engine = new WorkflowEngine(store, { runners: { demo: runner, claude: runner }, timers: nodeTimers(), agentTasks: { create: async () => { throw new Error('No delegation'); }, prepareCoworker: async () => { throw new AgentTaskNotStartedError('The selected CoWorker is disabled.'); } } });
  await store.transaction(state => { state.settings.workflow = definition(); });
  const idea = store.snapshot().ideas.find(item => item.status === 'inbox')!;
  const writes = storage.saves;
  await expect(engine.startWorkflow(idea.id)).rejects.toThrow('disabled');
  expect(store.snapshot().ideas.find(item => item.id === idea.id)?.workflowRun).toBeUndefined();
  expect(storage.saves).toBe(writes);
  expect(runner).not.toHaveBeenCalled();
  await engine.stop();
});

it('holds a captured run when the CoWorker is disabled before dispatch without adopting new settings', async () => {
  const { store } = await seededStore();
  let available = true;
  const runner = vi.fn(async () => ({ markdown: 'Unexpected' }));
  const engine = new WorkflowEngine(store, { runners: { demo: runner, claude: runner }, timers: nodeTimers(), agentTasks: { create: async () => { throw new Error('No delegation'); }, prepareCoworker: async () => { if (!available) throw new AgentTaskNotStartedError('The selected CoWorker is disabled.'); return profile(); } } });
  await store.transaction(state => { state.settings.workflow = definition(); state.settings.paused = false; state.runtime.cliAvailable = true; });
  const idea = store.snapshot().ideas.find(item => item.status === 'inbox')!;
  try {
    const run = await engine.startWorkflow(idea.id);
    available = false;
    await engine.completeWorkflowManual(idea.id, run.revision, [], 'Reviewed');
    await engine.waitUntilIdle();
    const held = store.snapshot().ideas.find(item => item.id === idea.id)!.workflowRun!;
    expect(held).toMatchObject({ state: 'attention', error: expect.stringContaining('disabled') });
    expect(held.coworkerBindings?.[0]?.profile).toMatchObject({ name: 'Saved reviewer', model: 'sonnet' });
    expect(runner).not.toHaveBeenCalled();
  } finally { await engine.stop(); }
});

it('uses current CoWorker settings when automatically admitting a new run instead of filtering on its old manual preview', async () => {
  const { store } = await seededStore();
  const runner = vi.fn(async (_input: StageInput) => ({ markdown: '# Simulated profile' }));
  const engine = new WorkflowEngine(store, { runners: { demo: runner, claude: runner }, timers: nodeTimers(), agentTasks: { create: async () => { throw new Error('No delegation'); }, prepareCoworker: async () => ({ ...profile(), provider: 'demo', effort: undefined }) } });
  const source = definition(); const step = source.steps[1]!;
  if (step.kind !== 'ai') throw new Error('Expected AI step');
  await store.transaction(state => { state.settings.workflow = { ...source, steps: [{ ...step, provider: 'claude' }] }; state.settings.paused = false; state.runtime.cliAvailable = false; });
  try {
    expect(await engine.tick(false)).not.toBeNull();
    await engine.waitUntilIdle();
    expect(runner).toHaveBeenCalled();
    expect(runner.mock.calls[0]?.[0]?.settings.provider).toBe('demo');
  } finally { await engine.stop(); }
});
