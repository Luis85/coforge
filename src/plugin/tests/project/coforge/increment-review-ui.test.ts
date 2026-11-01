// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { expect, it } from 'vitest';
import { workflowArtifactHash, workflowProposalRevision, type WorkflowArtifact, type WorkflowAttempt } from '../../../features/coforge/domain/configured-workflow-run';
import { createSeed } from '../../../features/coforge/domain/seed';
import IdeaDrawer from '../../../presentation/components/coforge/IdeaDrawer.vue';
import { ai, definition } from './configured-workflow-fixture';
import { workflowUiFixture } from './workflow-ui-fixture';
import { appendAgentSessionEvent } from '../../../features/coforge/domain/agent-session';

async function fixture() {
  const f = await workflowUiFixture();
  const idea = { ...createSeed().ideas.find(item => item.increment)!, projectId: f.project.id, status: 'review' as const };
  const proposalRevision = workflowProposalRevision(idea);
  const at = '2026-10-31T19:00:00.000Z';
  const attempt = (id: string, stepId: string, inputs: string[] = []): WorkflowAttempt => ({ id, stepId, stepName: stepId === 'followup' ? 'Product assessment' : stepId, kind: 'ai', status: 'succeeded', inputs, startedAt: at, finishedAt: at });
  const artifact = (id: string, stepId: string, output: WorkflowArtifact['output'], extra: Partial<WorkflowArtifact>): WorkflowArtifact => {
    const payload = { id, stepId, output, runId: 'run', attemptId: `${stepId}-attempt`, proposalRevision, createdAt: at, ...extra };
    return { ...payload, contentHash: workflowArtifactHash(payload) };
  };
  const build = artifact('build', 'build', 'codechange', { increment: idea.increment, summary: idea.increment!.summary, hostSnapshot: true });
  const submitted = artifact('submitted', 'build', 'codechange', { increment: idea.increment, summary: idea.increment!.summary });
  const review = artifact('review', 'followup', 'markdown', { markdown: '**Polish before publishing.** Missing styles and checks.' });
  const before = artifact('before', 'refine', 'markdown', { markdown: 'Earlier PRD must not appear here.' });
  const plan = artifact('plan', 'plan', 'plan', { plan: structuredClone(idea.plan) });
  idea.workflowRun = {
    id: 'run', ideaId: idea.id, projectId: f.project.id,
    definition: definition([ai('refine'), ai('plan', 'plan'), ai('build', 'codechange', 'editworktree'), ai('followup', 'markdown', 'readproject')]),
    proposalRevision, revision: 1, cursor: 4, state: 'awaiting-review',
    attempts: [attempt('refine-attempt', 'refine'), attempt('plan-attempt', 'plan'), attempt('build-attempt', 'build', ['plan']), attempt('followup-attempt', 'followup', ['build'])],
    artifacts: [before, plan, build, submitted, review], createdAt: at, updatedAt: at,
  };
  f.store.state!.ideas = [idea];
  f.store.select(idea.id, 'increment');
  const wrapper = mount(IdeaDrawer, { global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
  return { ...f, wrapper, current: () => f.store.state!.ideas[0]!, close: async () => { wrapper.unmount(); await f.dispose(); } };
}

it('keeps producing-attempt provider tool observations separate from isolated verification and never infers a passing current-source test', async () => {
  const f = await fixture();
  try {
    const idea = f.current(); const run = idea.workflowRun!;
    idea.increment!.simulated = false;
    for (const artifact of run.artifacts) if (artifact.increment) artifact.contentHash = workflowArtifactHash(artifact);
    const build = run.definition.steps.find(step => step.id === 'build');
    if (!build || build.kind !== 'ai') throw new Error('Missing Build.');
    f.store.state!.jobs = [{ id: 'native-build', ideaId: idea.id, projectId: f.project.id, provider: 'codex', model: 'captured-model', stage: 'implement', status: 'succeeded', startedAt: run.createdAt, logs: [],
      workflow: { runId: run.id, attemptId: 'build-attempt', definitionRevision: run.definition.revision, proposalRevision: run.proposalRevision, step: { ...build, provider: 'codex' }, inputArtifacts: [],
        worktreeCoding: { version: 1, profile: 'native-worktree-v1', maxConcurrent: 2 } },
      sessionTrace: appendAgentSessionEvent(undefined, { kind: 'tool', tool: 'shell', status: 'completed', text: '<script>captured tool output, not an independently verified test verdict</script>' }, run.createdAt) }];
    await flushPromises();
    const observations = f.wrapper.get('[aria-label="Provider tool observations"]');
    expect(observations.text()).toContain('not a passing test result');
    expect(observations.text()).toContain('build-attempt'); expect(observations.text()).toContain('captured tool output');
    expect(observations.find('script').exists()).toBe(false);
    expect(observations.text()).not.toContain('Completed · exit 0'); expect(observations.text()).not.toContain('Matches the captured source snapshot');
    expect(f.wrapper.find('[aria-label="Observed verification commands"]').exists()).toBe(false);
    expect(f.runner).not.toHaveBeenCalled();
  } finally { await f.close(); }
});

it('presents planned criteria, attributed post-build findings and evidence boundaries without executing or accepting', async () => {
  const f = await fixture();
  try {
    const writes = f.storage.saves;
    expect(f.wrapper.get('[aria-label="Planned acceptance criteria"]').text()).toContain('Saved plan · not verified');
    expect(f.wrapper.get('[aria-label="Planned acceptance criteria"]').text()).toContain(f.current().plan!.acceptanceCriteria[0]);
    const findings = f.wrapper.get('[aria-label="Post-build findings"]');
    expect(findings.text()).toContain('Product assessment');
    expect(findings.text()).toContain('Simulated assessment');
    expect(findings.text()).toContain('Polish before publishing.');
    expect(findings.get('time').attributes('datetime')).toBe('2026-10-31T19:00:00.000Z');
    expect(f.wrapper.text()).not.toContain('Earlier PRD must not appear here.');
    expect(f.wrapper.text()).toContain('Agent-reported summary');
    expect(f.wrapper.text()).toContain('Illustrative changes');
    expect(f.wrapper.get('pre[aria-label="Illustrative diff"]').attributes('tabindex')).toBe('0');
    expect(f.wrapper.findAll('button').some(button => button.text().includes('Accept increment'))).toBe(true);
    expect(f.current().status).toBe('review');
    expect(f.storage.saves).toBe(writes);
    expect(f.runner).not.toHaveBeenCalled();
  } finally { await f.close(); }
});

it('uses the exact Build input plan despite later plan edits and accepts either host/result input alias', async () => {
  const f = await fixture();
  try {
    const idea = f.current();
    const original = idea.plan!.acceptanceCriteria[0];
    idea.plan!.acceptanceCriteria = ['Later unrelated criteria'];
    idea.workflowRun!.attempts[3]!.inputs = ['submitted'];
    await flushPromises();
    expect(f.wrapper.get('[aria-label="Planned acceptance criteria"]').text()).toContain(original);
    expect(f.wrapper.text()).not.toContain('Later unrelated criteria');
    expect(f.wrapper.get('[aria-label="Post-build findings"]').text()).toContain('Polish before publishing.');
    idea.workflowRun!.invalidatedArtifactIds = ['plan'];
    await flushPromises();
    expect(f.wrapper.get('[aria-label="Planned acceptance criteria"]').text()).toContain('No saved acceptance criteria are bound to this Build');
  } finally { await f.close(); }
});

it('includes a successful Council assessment bound to this Build with its own attribution', async () => {
  const f = await fixture();
  try {
    const run = f.current().workflowRun!;
    run.definition.steps[3] = { id: 'followup', name: 'Council assessment', kind: 'council', councilId: 'review-council', instructions: 'Assess this increment.', automatic: false, inputs: ['codechange'] };
    run.attempts[3]!.kind = 'council';
    run.attempts[3]!.stepName = 'Council assessment';
    await flushPromises();
    expect(f.wrapper.get('[aria-label="Post-build findings"]').text()).toContain('Council assessment');
    expect(f.wrapper.get('[aria-label="Post-build findings"]').text()).toContain('Polish before publishing.');
  } finally { await f.close(); }
});

it.each(['invalidated', 'tampered', 'failed', 'retry', 'foreign project', 'foreign run', 'changed proposal', 'unbound', 'old build', 'pre-build date'] as const)('keeps %s findings out of the current increment', async reason => {
  const f = await fixture();
  try {
    const idea = f.current();
    const run = idea.workflowRun!;
    const review = run.artifacts.find(item => item.id === 'review')!;
    if (reason === 'invalidated') run.invalidatedArtifactIds = ['review'];
    if (reason === 'tampered') review.markdown = 'Corrupted';
    if (reason === 'failed') run.attempts[3]!.status = 'failed';
    if (reason === 'retry') run.attempts.push({ ...run.attempts[3]!, id: 'retry', status: 'running' });
    if (reason === 'foreign project') run.projectId = 'CFP-999';
    if (reason === 'foreign run') review.runId = 'foreign';
    if (reason === 'changed proposal') idea.description += ' A new proposal.';
    if (reason === 'unbound') run.attempts[3]!.inputs = [];
    if (reason === 'old build') idea.increment = { ...idea.increment!, createdAt: '2026-10-31T18:00:00.000Z' };
    if (reason === 'pre-build date') { review.createdAt = '2026-10-31T18:00:00.000Z'; review.contentHash = workflowArtifactHash(review); }
    await flushPromises();
    expect(f.wrapper.find('[aria-label="Post-build findings"]').exists()).toBe(false);
    expect(f.wrapper.text()).not.toContain('Polish before publishing.');
    expect(f.runner).not.toHaveBeenCalled();
  } finally { await f.close(); }
});
