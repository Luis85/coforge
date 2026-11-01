import { expect, it } from 'vitest';
import { incrementReviewEvidence } from '../../../presentation/composables/coforge/use-increment-review';
import { ai, fixture, increment, result } from './configured-workflow-fixture';
import type { Increment } from '../../../features/coforge/domain/types';

async function nativeReadReview(changed = false) {
  let edit: Increment | undefined;
  const f = await fixture([
    ai('plan', 'plan'),
    { ...ai('build', 'codechange', 'editworktree'), provider: 'claude', inputs: ['plan'] },
    { ...ai('assessment', 'markdown', 'readproject'), provider: 'claude', inputs: ['codechange'] },
  ], async input => {
    if (input.workflow?.step.id === 'plan') return result(input);
    await input.onWorkspace?.('wf-native-review');
    if (input.workflow?.step.id === 'build') {
      edit = { ...increment, simulated: false, createdAt: new Date().toISOString(), branch: 'native-review', worktree: '/fixture/native-review', snapshotHash: 'a'.repeat(64) };
      await input.onChanges?.(edit); return { summary: 'Delivered the change.', increment: edit };
    }
    if (!edit) throw new Error('The native Build must run before its assessment.');
    // A local readproject lease still captures the cumulative tree at transport completion.
    const observed = { ...edit, summary: 'Cumulative changes after assessment', createdAt: new Date(Date.parse(edit.createdAt) + 1).toISOString(), snapshotHash: changed ? 'b'.repeat(64) : edit.snapshotHash };
    await input.onChanges?.(observed);
    return { markdown: 'Native read-only assessment: checks remain not run.', increment: observed };
  });
  await f.engine.startWorkflow(f.idea.id); await f.engine.waitUntilIdle(); return f;
}

it('retains the genuine editing producer, bound criteria and assessment after a same-tree native foreground read capture', async () => {
  const f = await nativeReadReview();
  try {
    const idea = f.current(); const run = idea.workflowRun!;
    expect(f.calls.map(input => input.workflow?.step.id)).toEqual(['plan', 'build', 'assessment']);
    expect(run.state).toBe('awaiting-review');
    const build = run.artifacts.find(artifact => artifact.stepId === 'build' && artifact.hostSnapshot)!;
    const hostRead = run.artifacts.find(artifact => artifact.stepId === 'assessment' && artifact.hostSnapshot)!;
    expect(hostRead.increment?.snapshotHash).toBe(build.increment?.snapshotHash); expect(hostRead.increment?.createdAt).not.toBe(build.increment?.createdAt);
    expect(idea.increment).toEqual(hostRead.increment); expect(run.attempts.find(attempt => attempt.stepId === 'assessment')?.inputs).toContain(build.id);
    const evidence = incrementReviewEvidence(idea);
    expect(evidence.hostCaptured).toBe(true); expect(evidence.criteria).toEqual(idea.plan!.acceptanceCriteria);
    expect(evidence.followups).toHaveLength(1); expect(evidence.followups[0]?.markdown).toContain('Native read-only assessment');
  } finally { await f.engine.stop(); }
});

it('does not borrow a read-only assessment across changed tree bytes', async () => {
  const f = await nativeReadReview(true);
  try {
    const evidence = incrementReviewEvidence(f.current());
    expect(evidence.hostCaptured).toBe(false); expect(evidence.criteria).toEqual([]); expect(evidence.followups).toEqual([]);
  } finally { await f.engine.stop(); }
});

it('does not borrow evidence when the displayed physical resource changed despite the same tree hash', async () => {
  const f = await nativeReadReview();
  try {
    const idea = f.current(); const changed = { ...idea, increment: { ...idea.increment!, worktree: '/fixture/another-resource' } };
    const evidence = incrementReviewEvidence(changed);
    expect(evidence.hostCaptured).toBe(false); expect(evidence.criteria).toEqual([]); expect(evidence.followups).toEqual([]);
  } finally { await f.engine.stop(); }
});
