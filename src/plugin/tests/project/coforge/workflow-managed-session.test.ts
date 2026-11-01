import { expect, it } from 'vitest';
import { ai, fixture } from './configured-workflow-fixture';
import { configuredStepExecutionCheck } from '../../../features/coforge/domain/configured-workflow-run';

it('captures completion-driven lifetime for a new read-only refinement without granting coding tools or changing saved limits', async () => {
  const step = { ...ai('refinement', 'markdown', 'readproject'), provider: 'claude' as const };
  const f = await fixture([step]);
  await f.store.transaction(state => { state.projects.find(project => project.id === f.idea.projectId)!.projectPath = '/synthetic/game'; });
  const original = structuredClone(f.store.snapshot().settings.workflow);
  try {
    await f.engine.startWorkflow(f.idea.id); await f.engine.waitUntilIdle();
    expect(f.calls[0]?.workflow).toMatchObject({ lifecycle: { version: 1, mode: 'managed-session' }, step });
    expect(f.calls[0]?.workflow?.worktreeCoding).toBeUndefined();
    expect(f.store.snapshot().settings.workflow).toEqual(original);
    expect(configuredStepExecutionCheck(f.calls[0]?.workflow)).toMatchObject({ lifecycle: { version: 1, mode: 'managed-session' } });
    expect(f.current().workflowRun?.artifacts[0]?.markdown).toBe('# refinement');
  } finally { await f.engine.stop(); }
});

it('does not upgrade an already admitted legacy snapshot or broaden its read-only access when reading it', () => {
  const step = { ...ai('refinement', 'markdown', 'readproject'), provider: 'claude' as const };
  const legacy = { runId: 'run', attemptId: 'attempt', definitionRevision: 'definition', proposalRevision: 'proposal', inputArtifacts: [], step };
  const parsed = configuredStepExecutionCheck(legacy);
  expect(parsed).not.toHaveProperty('lifecycle', expect.anything());
  const managed = configuredStepExecutionCheck({ ...legacy, lifecycle: { version: 1, mode: 'managed-session' } });
  expect(managed.step.access).toBe('readproject'); expect(managed.worktreeCoding).toBeUndefined();
  expect(() => configuredStepExecutionCheck({ ...legacy, lifecycle: { version: 2, mode: 'managed-session' } })).toThrow();
});

it('persists native lifetime ownership for managed read-only sessions with no native tool grant', async () => {
  const f = await fixture([{ ...ai('refine', 'markdown', 'readproject'), provider: 'claude' as const }], async input => {
    const workflow = input.workflow!;
    const original = { runId: workflow.runId, attemptId: workflow.attemptId, projectId: input.idea.projectId!, identity: { pid: 321, platform: 'win32', birth: '123', image: 'a'.repeat(64) } };
    await input.onNativeProcess?.({ ...original, phase: 'launched', observedAt: new Date().toISOString() });
    await input.onNativeProcess?.({ ...original, phase: 'terminated', observedAt: new Date().toISOString() });
    return { markdown: '# Refined' };
  });
  await f.store.transaction(state => { state.projects.find(project => project.id === f.idea.projectId)!.projectPath = '/synthetic/game'; });
  try {
    await f.engine.startWorkflow(f.idea.id); await f.engine.waitUntilIdle();
    expect(f.store.snapshot().jobs.at(-1)).toMatchObject({ status: 'succeeded', nativeProcess: { phase: 'terminated' } });
  } finally { await f.engine.stop(); }
});
