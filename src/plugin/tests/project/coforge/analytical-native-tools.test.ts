import { expect, it } from 'vitest';
import { ai, fixture, definition } from './configured-workflow-fixture';
import { configuredStepExecutionCheck } from '../../../features/coforge/domain/configured-workflow-run';
import { resolvedAnalyticalWorkflowTools } from '../../../features/coforge/domain/workflow-analytical-tools';
import { configuredAttempt } from '../../../features/coforge/application/configured-workflow-policy';
import { nativeWorkflowToolsCheck } from '../../../features/coforge/domain/native-workflow-tools';
import { seededStore } from './memory-storage';
import { ConfiguredWorkflowEngine } from '../../../features/coforge/application/configured-workflow-engine';

it('captures scoped analytical assistants and research for a new refinement without changing its saved definition', async () => {
  const f = await fixture([{ ...ai('refine', 'markdown', 'readproject'), provider: 'claude' }]);
  try {
    await f.engine.startWorkflow(f.idea.id); await f.engine.waitUntilIdle();
    const state = f.store.snapshot(), job = state.jobs.at(-1)!;
    expect(job.status).toBe('succeeded');
    expect(job.workflow?.step.nativeTools).toEqual({ delegation: { maxConcurrent: 2 }, research: true });
    expect(job.workflow).toMatchObject({ analyticalTools: { version: 1, profile: 'scoped-analyst-v1' } });
    expect(f.current().workflowRun?.definition.steps[0]).not.toHaveProperty('nativeTools');
    expect(f.calls[0]?.workflow?.step.nativeTools).toEqual(job.workflow?.step.nativeTools);
    expect(configuredStepExecutionCheck(job.workflow)).toEqual(job.workflow);
  } finally { await f.engine.stop(); }
});
it('captures explicit analytical opt-outs rather than silently replacing them with defaults', async () => {
  const f = await fixture([{ ...ai('refine', 'markdown', 'none'), provider: 'claude', nativeTools: { delegation: false, research: false } }]);
  try {
    await f.engine.startWorkflow(f.idea.id); await f.engine.waitUntilIdle();
    expect(f.store.snapshot().jobs.at(-1)?.workflow?.step.nativeTools).toEqual({ delegation: false, research: false });
  } finally { await f.engine.stop(); }
});
it('retains the exact absent-tool policy of historical analytical captures', () => {
  const old = { runId: 'run', attemptId: 'attempt', definitionRevision: 'definition', proposalRevision: 'proposal', inputArtifacts: [],
    step: { ...ai('refine', 'markdown', 'readproject'), provider: 'claude' } };
  expect(configuredStepExecutionCheck(old)).toEqual(old);
  expect(configuredStepExecutionCheck(old).step.nativeTools).toBeUndefined();
});
it('keeps an explicit six-assistant policy while supplying research only at new analytical admission', async () => {
  const f = await fixture([{ ...ai('design', 'design', 'readproject'), provider: 'claude', nativeTools: { delegation: { maxConcurrent: 6 } } }]);
  try {
    await f.engine.startWorkflow(f.idea.id); await f.engine.waitUntilIdle();
    expect(f.store.snapshot().jobs.at(-1)?.workflow?.step.nativeTools).toEqual({ delegation: { maxConcurrent: 6 }, research: true });
    expect(f.current().workflowRun?.definition.steps[0]).toMatchObject({ nativeTools: { delegation: { maxConcurrent: 6 } } });
  } finally { await f.engine.stop(); }
});
it('does not default assistants or research for classifiers, coding, external clients or unsupported providers', () => {
  for (const provider of ['demo', 'mcp', 'herdr']) expect(resolvedAnalyticalWorkflowTools(ai('analysis', 'markdown', 'readproject'), provider)).toBeUndefined();
  for (const output of ['screening', 'rice', 'codechange'] as const) expect(resolvedAnalyticalWorkflowTools(ai('step', output, 'none'), 'claude')).toBeUndefined();
  expect(resolvedAnalyticalWorkflowTools(ai('edit', 'markdown', 'editworktree'), 'claude')).toBeUndefined();
  expect(resolvedAnalyticalWorkflowTools({ kind: 'council', output: 'markdown', access: 'none' }, 'claude')).toBeUndefined();
  expect(nativeWorkflowToolsCheck({ delegation: false, research: false })).toEqual({ delegation: false, research: false });
});
it('rejects a changed captured grant against its immutable source definition and leaves a historical missing grant unchanged', async () => {
  const f = await fixture([{ ...ai('refine', 'markdown', 'none'), provider: 'claude' }], async input => {
    const state = structuredClone(f.store.internalSnapshot()), job = state.jobs.find(value => value.id === input.jobId)!;
    job.workflow!.step.nativeTools = { delegation: { maxConcurrent: 8 }, research: true };
    expect(() => configuredAttempt(state, job)).toThrow('changed');
    delete job.workflow!.analyticalTools; delete job.workflow!.step.nativeTools;
    expect(configuredAttempt(state, job).snapshot.step.nativeTools).toBeUndefined();
    return { markdown: '# Verified policy' };
  });
  try { await f.engine.startWorkflow(f.idea.id); await f.engine.waitUntilIdle(); expect(f.store.snapshot().jobs.at(-1)?.status).toBe('succeeded'); }
  finally { await f.engine.stop(); }
});
it('rejects an analytical capture when the actual executor is external or disagrees with the captured native provider', async () => {
  const f = await fixture([{ ...ai('refine', 'markdown', 'none'), provider: 'claude' }], async input => {
    for (const provider of ['mcp', 'codex'] as const) {
      const state = structuredClone(f.store.internalSnapshot()), job = state.jobs.find(value => value.id === input.jobId)!;
      job.provider = provider;
      if (provider === 'mcp') state.ideas.find(value => value.id === f.idea.id)!.workflowRun!.external = true;
      expect(() => configuredAttempt(state, job)).toThrow('analytical');
    }
    return { markdown: '# Valid native result' };
  });
  try { await f.engine.startWorkflow(f.idea.id); await f.engine.waitUntilIdle(); expect(f.store.snapshot().jobs.at(-1)?.status).toBe('succeeded'); }
  finally { await f.engine.stop(); }
});
it('rejects only-forged analytical rights on a genuinely admitted active external MCP task', async () => {
  const { store } = await seededStore();
  await store.transaction(state => { state.settings.workflow = definition([{ ...ai('refine', 'markdown', 'none'), provider: 'claude' }]); });
  const idea = store.snapshot().ideas.find(value => value.status === 'inbox')!;
  const runner = async () => ({ markdown: '# External result' });
  const engine = new ConfiguredWorkflowEngine(store, { runners: { demo: runner, claude: runner, mcp: runner }, cost: async () => {}, usage: async () => {} });
  try {
    await engine.start(idea.id, true, undefined, true);
    const state = structuredClone(store.internalSnapshot()), job = state.jobs.at(-1)!;
    expect(job.provider).toBe('mcp'); expect(job.workflow?.analyticalTools).toBeUndefined();
    expect(() => configuredAttempt(state, job)).not.toThrow();
    job.workflow!.analyticalTools = { version: 1, profile: 'scoped-analyst-v1' };
    job.workflow!.step.nativeTools = { delegation: { maxConcurrent: 2 }, research: true };
    expect(() => configuredAttempt(state, job)).toThrow('analytical');
  } finally { await engine.dispose(); store.disposeObservers(); }
});
it('preserves a valid active analytical admission after its persisted snapshot is parsed in canonical field order', async () => {
  const f = await fixture([{ ...ai('refine', 'markdown', 'none'), provider: 'claude' }], async input => {
    const state = structuredClone(f.store.internalSnapshot()), job = state.jobs.find(value => value.id === input.jobId)!;
    job.workflow = configuredStepExecutionCheck(job.workflow);
    expect(() => configuredAttempt(state, job)).not.toThrow();
    expect(configuredAttempt(state, job).snapshot.step.nativeTools).toEqual({ delegation: { maxConcurrent: 2 }, research: true });
    return { markdown: '# Valid persisted admission' };
  });
  try { await f.engine.startWorkflow(f.idea.id); await f.engine.waitUntilIdle(); expect(f.store.snapshot().jobs.at(-1)?.status).toBe('succeeded'); }
  finally { await f.engine.stop(); }
});
