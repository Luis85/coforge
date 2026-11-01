import { expect, it } from 'vitest';
import { captureWorktreeCodingCapability, nativeCodingProfileCheck } from '../../../features/coforge/domain/worktree-coding';
import { configuredStepExecutionCheck } from '../../../features/coforge/domain/configured-workflow-run';
import { ai, fixture } from './configured-workflow-fixture';
import { workflowStepCheck } from '../../../features/coforge/domain/configured-workflow';

it('captures ordinary native coding only for authorized native code-change admissions and preserves selected concurrency', () => {
  const step = { ...ai('build', 'codechange', 'editworktree'), provider: 'claude' as const };
  expect(captureWorktreeCodingCapability(step, 'claude', true)).toEqual({ version: 1, profile: 'native-worktree-v1', maxConcurrent: 2 });
  expect(captureWorktreeCodingCapability({ ...step, nativeTools: { delegation: { maxConcurrent: 4 } } }, 'codex', true)).toMatchObject({ maxConcurrent: 4 });
  expect(captureWorktreeCodingCapability(step, 'mcp', true)).toEqual({ version: 1, profile: 'mcp-worktree-v1' }); expect(captureWorktreeCodingCapability(step, 'claude', false)).toBeUndefined();
  expect(captureWorktreeCodingCapability(ai('review', 'markdown', 'readproject'), 'claude', true)).toBeUndefined();
  expect(() => nativeCodingProfileCheck({ version: 1, profile: 'native-worktree-v1', maxConcurrent: 9 })).toThrow();
});

it('new coding admissions in an already-captured definition need no Docker grant and preserve signed instructions and exact plan inputs', async () => {
  const build = { ...ai('build', 'codechange', 'editworktree'), provider: 'claude' as const, inputs: ['plan' as const], instructions: 'Keep the saved owner task exactly.', nativeTools: { verification: { commandIds: ['old-command'] } } };
  const f = await fixture([ai('plan', 'plan'), { id: 'gate', name: 'Review plan', instructions: 'Review the captured plan.', kind: 'approval' }, build]);
  await f.store.transaction(state => { const project = state.projects.find(project => project.id === f.idea.projectId)!; project.projectPath = '/synthetic/game'; project.allowImplementation = true; });
  try {
    await f.engine.startWorkflow(f.idea.id); await f.engine.waitUntilIdle();
    const capturedDefinition = structuredClone(f.current().workflowRun!.definition);
    expect(f.calls[0]?.workflow?.worktreeCoding).toBeUndefined();
    await f.engine.completeWorkflowManual(f.idea.id, f.current().workflowRun!.revision, []); await f.engine.waitUntilIdle();
    const execution = f.calls.find(call => call.workflow?.step.id === 'build')?.workflow;
    expect(execution?.worktreeCoding).toEqual({ version: 1, profile: 'native-worktree-v1', maxConcurrent: 2 });
    expect(execution?.verificationProfile).toBeUndefined(); expect(execution?.step.instructions).toBe(build.instructions);
    expect(execution?.step.nativeTools).toEqual(build.nativeTools); expect(execution?.inputArtifacts.map(artifact => artifact.output)).toEqual(['plan']);
    expect(f.current().workflowRun!.definition).toEqual(capturedDefinition);
    expect(configuredStepExecutionCheck(execution).worktreeCoding).toEqual(execution?.worktreeCoding);
  } finally { await f.engine.stop(); }
});

it('an existing admitted snapshot without the marker remains legacy; a marker cannot authorize read-only or external execution', () => {
  const step = { ...ai('old-build', 'codechange', 'editworktree'), provider: 'claude' as const };
  const legacy = { runId: 'run', attemptId: 'attempt', definitionRevision: 'definition', proposalRevision: 'proposal', inputArtifacts: [], step };
  expect(configuredStepExecutionCheck(legacy).worktreeCoding).toBeUndefined();
  const worktreeCoding = { version: 1, profile: 'native-worktree-v1', maxConcurrent: 2 };
  expect(() => configuredStepExecutionCheck({ ...legacy, worktreeCoding, step: { ...step, access: 'readproject', output: 'markdown' } })).toThrow();
  expect(() => configuredStepExecutionCheck({ ...legacy, worktreeCoding, step: { ...step, provider: 'herdr' } })).toThrow();
});
it('ordinary background coding preserves an absent deadline at every concurrency while admitted legacy delegation retains its old guard', () => {
  const step = { ...ai('background', 'codechange', 'editworktree'), provider: 'codex' as const, execution: { mode: 'background' as const }, nativeTools: { delegation: { maxConcurrent: 3 } } };
  expect(workflowStepCheck(step)).toEqual(step);
  const snapshot = { runId: 'run', attemptId: 'attempt', definitionRevision: 'definition', proposalRevision: 'proposal', inputArtifacts: [], step };
  expect(() => configuredStepExecutionCheck(snapshot)).toThrow('elapsed deadline');
  const captured = configuredStepExecutionCheck({ ...snapshot, worktreeCoding: { version: 1, profile: 'native-worktree-v1', maxConcurrent: 3 } });
  expect(captured.step.execution?.maxRuntimeSeconds).toBeUndefined(); expect(captured.worktreeCoding).toMatchObject({ maxConcurrent: 3 });
});
