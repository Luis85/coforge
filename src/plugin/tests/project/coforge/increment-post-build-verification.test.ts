// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { expect, it } from 'vitest';
import { workflowArtifactHash, workflowProposalRevision, type WorkflowArtifact } from '../../../features/coforge/domain/configured-workflow-run';
import type { AgentJob, Idea } from '../../../features/coforge/domain/types';
import { createSeed } from '../../../features/coforge/domain/seed';
import IdeaDrawer from '../../../presentation/components/coforge/IdeaDrawer.vue';
import { incrementReviewEvidence } from '../../../presentation/composables/coforge/use-increment-review';
import { ai, definition } from './configured-workflow-fixture';
import { workflowUiFixture } from './workflow-ui-fixture';

async function fixture(status: AgentJob['status'] = 'succeeded') {
  const f = await workflowUiFixture();
  const builtAt = '2026-11-01T08:00:00.000Z'; const startedAt = '2026-11-01T08:01:00.000Z'; const finishedAt = '2026-11-01T08:02:00.000Z';
  const idea: Idea = { ...createSeed().ideas.find(item => item.increment)!, projectId: f.project.id, status: 'review',
    increment: { ...createSeed().ideas.find(item => item.increment)!.increment!, simulated: false, createdAt: builtAt,
      branch: 'coforge/native-review', worktree: '/fixture/owned-worktree', snapshotHash: 'a'.repeat(64), tests: ['Not run: shell tools are disabled. Run the project checks before accepting.'] } };
  const proposalRevision = workflowProposalRevision(idea);
  const buildStep = { ...ai('build', 'codechange', 'editworktree'), provider: 'claude' as const };
  const reviewStep = { ...ai('review', 'markdown', 'readproject'), name: 'Quality review', provider: 'claude' as const, nativeTools: { verification: { commandIds: ['check'] } } };
  const workflow = definition([buildStep, reviewStep]);
  const build: WorkflowArtifact = { id: 'build-capture', runId: 'run', stepId: 'build', attemptId: 'build-attempt', proposalRevision, output: 'codechange', createdAt: builtAt,
    summary: idea.increment!.summary, increment: idea.increment, hostSnapshot: true, contentHash: '' };
  build.contentHash = workflowArtifactHash(build);
  idea.workflowRun = { id: 'run', ideaId: idea.id, projectId: f.project.id, definition: workflow, proposalRevision, revision: 2, cursor: status === 'succeeded' ? 2 : 1,
    state: status === 'succeeded' ? 'awaiting-review' : 'attention', workspaceId: 'workspace', createdAt: builtAt, updatedAt: finishedAt,
    artifacts: [build], attempts: [{ id: 'build-attempt', stepId: 'build', stepName: 'Build', kind: 'ai', status: 'succeeded', inputs: [], startedAt: builtAt, finishedAt: builtAt, jobId: 'build-job' },
      { id: 'review-attempt', stepId: 'review', stepName: 'Quality review', kind: 'ai', status, inputs: [build.id], startedAt, finishedAt, jobId: 'review-job' }] };
  const job: AgentJob = { id: 'review-job', ideaId: idea.id, projectId: f.project.id, provider: 'claude', stage: 'plan', status, startedAt, finishedAt, logs: [],
    workflow: { runId: 'run', attemptId: 'review-attempt', proposalRevision, definitionRevision: workflow.revision, workspaceId: 'workspace', step: reviewStep, inputArtifacts: [structuredClone(build)],
      verificationProfile: { enabled: true, imageId: 'sha256:' + 'b'.repeat(64), dockerBin: 'docker', maxRuns: 2, timeoutSeconds: 30, commands: [{ id: 'check', label: 'Review tests', executable: 'node', args: ['--test'] }] } },
    verification: [{ id: 'review-check', runId: 'run', attemptId: 'review-attempt', projectId: f.project.id, workspaceId: 'workspace', commandId: 'check', label: 'Review tests', executable: 'node', args: ['--test'],
      runtime: 'docker', imageId: 'sha256:' + 'b'.repeat(64), sourceHash: 'c'.repeat(64), startedAt, finishedAt, status: 'completed', exitCode: 0, output: 'One review check passed', truncated: false }] };
  f.store.state!.ideas = [idea]; f.store.state!.jobs = [job]; f.store.select(idea.id, 'increment');
  return { ...f, idea, job, close: f.dispose };
}
it.each(['succeeded', 'failed'] as const)('shows factual post-Build command evidence for a %s native review without changing approval or data', async status => {
  const f = await fixture(status); const original = JSON.stringify(f.idea); const writes = f.storage.saves;
  const wrapper = mount(IdeaDrawer, { global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
  try {
    const section = wrapper.get('[aria-label="Post-build verification for Quality review"]');
    expect(section.text()).toContain(status === 'succeeded' ? 'Succeeded' : 'Failed');
    expect(section.text()).toContain('Review tests'); expect(section.text()).toContain('Completed · exit 0');
    expect(section.text()).toContain('current snapshot match not recorded');
    expect(section.text()).toContain('One review check passed');
    expect(wrapper.text()).not.toContain('Not run: shell tools are disabled');
    expect(JSON.stringify(f.idea)).toBe(original); expect(f.storage.saves).toBe(writes); expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.close(); }
});
it('labels only a recorded matching Build source hash as current and deduplicates its existing command IDs', async () => {
  const f = await fixture();
  try {
    f.idea.increment!.verificationSourceHash = f.job.verification![0]!.sourceHash;
    const build = f.idea.workflowRun!.artifacts[0]!; build.contentHash = workflowArtifactHash(build);
    f.job.workflow!.inputArtifacts = [structuredClone(build)];
    const evidence = incrementReviewEvidence(f.idea, [f.job]);
    expect(evidence.postBuildChecks[0]?.currentHash).toBe(f.job.verification![0]!.sourceHash);
    f.idea.increment!.verification = structuredClone(f.job.verification); build.contentHash = workflowArtifactHash(build);
    f.job.workflow!.inputArtifacts = [structuredClone(build)];
    expect(incrementReviewEvidence(f.idea, [f.job]).postBuildChecks).toEqual([]);
  } finally { await f.close(); }
});
it.each(['project', 'run', 'proposal', 'workspace', 'record attempt', 'record workspace', 'command', 'input hash', 'invalidated', 'unbound', 'pre-build', 'stale attempt'] as const)('excludes %s verification provenance from the current increment', async reason => {
  const f = await fixture();
  try {
    const snapshot = f.job.workflow!; const run = f.idea.workflowRun!;
    if (reason === 'project') f.job.projectId = 'CFP-999';
    if (reason === 'run') snapshot.runId = 'foreign';
    if (reason === 'proposal') snapshot.proposalRevision = 'foreign';
    if (reason === 'workspace') snapshot.workspaceId = 'foreign';
    if (reason === 'record attempt') f.job.verification![0]!.attemptId = 'foreign';
    if (reason === 'record workspace') f.job.verification![0]!.workspaceId = 'foreign';
    if (reason === 'command') f.job.verification![0]!.args = ['--unapproved'];
    if (reason === 'input hash') snapshot.inputArtifacts[0]!.contentHash = 'changed';
    if (reason === 'invalidated') run.invalidatedArtifactIds = ['build-capture'];
    if (reason === 'unbound') run.attempts[1]!.inputs = [];
    if (reason === 'pre-build') f.job.verification![0]!.startedAt = '2026-11-01T07:00:00.000Z';
    if (reason === 'stale attempt') run.attempts.push({ ...run.attempts[1]!, id: 'review-retry', status: 'running' });
    expect(incrementReviewEvidence(f.idea, [f.job]).postBuildChecks).toEqual([]);
  } finally { await f.close(); }
});
