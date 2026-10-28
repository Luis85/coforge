import { expect, it } from 'vitest';
import { ai, fixture, result } from './configured-workflow-fixture';
import { workflowProposalRevision } from '../../../features/coforge/domain/configured-workflow-run';

it('hands a validated proposal into the existing pipeline without skipping screening or final review', async () => {
  const f = await fixture([ai('screen', 'screening'), ai('build', 'codechange', 'editworktree')], async input => {
    if (input.workflow?.step.output === 'codechange') return { increment: { summary: 'Changes', files: [{ path: 'game.ts', additions: 1, deletions: 0 }], tests: [], diff: '+code', simulated: true, createdAt: new Date().toISOString() } };
    return result(input);
  });
  const plan = { summary: 'A selected proposal', steps: ['Build lantern'], acceptanceCriteria: ['Lantern works'], risks: [], markdown: '# Selected plan', createdAt: new Date().toISOString() };
  await f.engine.startWorkflowFromPlan(f.idea.id, { plan, sourceRunId: 'council-run', sourceArtifactId: 'proposal-artifact', expectedProposalRevision: workflowProposalRevision(f.current()) });
  await f.engine.waitUntilIdle();
  expect(f.calls.map(input => input.workflow?.step.id)).toEqual(['screen', 'build']);
  expect(f.calls[0]?.workflow?.inputArtifacts[0]?.plan?.summary).toBe('A selected proposal');
  expect(f.current().workflowRun?.state).toBe('awaiting-review');
  expect(f.current().status).toBe('review');
  expect(f.current().status).not.toBe('shipped');
});

it('rejects a changed target and malformed plans before starting provider work', async () => {
  const f = await fixture([ai('screen', 'screening')]);
  const plan = { summary: 'Valid', steps: ['Build'], acceptanceCriteria: ['Works'], risks: [], markdown: '# Plan', createdAt: new Date().toISOString() };
  await expect(f.engine.startWorkflowFromPlan(f.idea.id, { plan, sourceRunId: 'run', sourceArtifactId: 'artifact', expectedProposalRevision: 'stale' })).rejects.toThrow('changed');
  expect(f.calls).toHaveLength(0);
  expect(f.current().workflowRun).toBeUndefined();
  await expect(f.engine.startWorkflowFromPlan(f.idea.id, { plan: { ...plan, steps: [] }, sourceRunId: 'run', sourceArtifactId: 'artifact', expectedProposalRevision: workflowProposalRevision(f.current()) })).rejects.toThrow();
  expect(f.calls).toHaveLength(0);
  expect(f.current().workflowRun).toBeUndefined();
});
