// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { expect, it } from 'vitest';
import IdeaDrawer from '../../../presentation/components/coforge/IdeaDrawer.vue';
import { incrementReviewEvidence } from '../../../presentation/composables/coforge/use-increment-review';
import { polishingTargetForView } from '../../../presentation/composables/coforge/polishing-target-for-view';
import { workflowArtifactCheck, workflowArtifactHash, workflowProposalRevision, type WorkflowArtifact, type WorkflowRun } from '../../../features/coforge/domain/configured-workflow-run';
import type { PolishingRun } from '../../../features/coforge/domain/polishing';
import { createSeed } from '../../../features/coforge/domain/seed';
import { polishingResultArtifact, selectPolishingTarget } from '../../../features/coforge/domain/polishing-target';
import { workflowRunHistoryHash } from '../../../features/coforge/domain/workflow-run-history-hash';
import { ai, definition } from './configured-workflow-fixture';
import { workflowUiFixture } from './workflow-ui-fixture';

async function fixture(primary = true) {
  const f = await workflowUiFixture();
  const idea = { ...createSeed().ideas.find(item => item.increment)!, projectId: f.project.id, status: 'shipped' as const };
  idea.increment = { ...idea.increment!, simulated: false, diff: '+original code', branch: 'original', worktree: '/fixture/original', snapshotHash: 'a'.repeat(64) };
  const proposalRevision = workflowProposalRevision(idea); const at = '2026-10-31T19:00:00Z';
  const artifact = (id: string, runId: string, stepId: string, output: WorkflowArtifact['output'], extra: Partial<WorkflowArtifact>): WorkflowArtifact => {
    const value = { id, runId, stepId, attemptId: `${stepId}-attempt`, output, proposalRevision, createdAt: at, ...extra }; return { ...value, contentHash: workflowArtifactHash(value) };
  };
  const plan = artifact('bound-plan', 'primary', 'plan', 'plan', { plan: structuredClone(idea.plan) });
  const build = artifact('old-code', 'primary', 'build', 'codechange', { increment: idea.increment, summary: idea.increment.summary, hostSnapshot: true });
  const finding = artifact('old-finding', 'primary', 'assessment', 'markdown', { markdown: 'Old primary assessment must not describe the polished bytes.' });
  const main: WorkflowRun = { id: 'primary', ideaId: idea.id, projectId: f.project.id, definition: definition([ai('plan', 'plan'), ai('build', 'codechange', 'editworktree'), ai('assessment')]),
    proposalRevision, revision: 8, cursor: 3, state: 'awaiting-review', createdAt: at, updatedAt: at, artifacts: [plan, build, finding], workspaceId: 'original-workspace',
    attempts: ['plan', 'build', 'assessment'].map(stepId => ({ id: `${stepId}-attempt`, stepId, stepName: stepId, kind: 'ai', status: 'succeeded', inputs: stepId === 'build' ? [plan.id] : stepId === 'assessment' ? [build.id] : [], startedAt: at })) };
  if (primary) idea.workflowRun = main; else delete idea.workflowRun;
  const target = selectPolishingTarget(idea);
  const output = artifact('polished-code', 'auxiliary', 'polish', 'codechange', { summary: 'Polished code', increment: { ...idea.increment, diff: '+polished code', worktree: '/fixture/aux', branch: 'aux', snapshotHash: 'b'.repeat(64) } });
  const host = artifact('polished-host-capture', 'auxiliary', 'polish', 'codechange', { summary: 'Host captured code', increment: structuredClone(output.increment), hostSnapshot: true });
  const pass: PolishingRun = { id: 'auxiliary', feedback: 'Polish the actual code.', target, sourceHash: 'source', consent: { oldExecutorStopped: true, changesReviewed: true, releaseStopHold: false },
    ...(primary ? { primaryCheckpoint: { runId: main.id, revision: main.revision, cursor: main.cursor, state: main.state, contentHash: workflowRunHistoryHash(main) } } : {}),
    reviewedSnapshot: { version: 1, id: 'reviewed-initial', contentHash: 'a'.repeat(64) },
    reviewedSource: { projectId: f.project.id, ideaId: idea.id, runRevision: primary ? main.revision : 0, proposalRevision, stepId: 'build', projectPath: '/fixture/project',
      ...(primary ? { runId: main.id, sourceKind: 'workspace', sourceWorkspaceId: main.workspaceId } : { sourceKind: 'repository' }) },
    previousStatus: idea.status, sourceArtifacts: primary ? [plan, build, finding] : [], policySourceRevision: 'policy', createdAt: at, review: 'applied',
    workflow: { id: 'auxiliary', ideaId: idea.id, projectId: f.project.id, definition: definition([{ ...ai('polish', 'codechange', 'editworktree'), provider: 'claude', automatic: false, execution: { mode: 'background' } }]),
      proposalRevision, revision: 4, cursor: 1, state: 'awaiting-review', createdAt: at, updatedAt: at, artifacts: [host, output], workspaceId: 'aux-workspace',
      attempts: [{ id: 'polish-attempt', jobId: 'polish-job', stepId: 'polish', stepName: 'Improve & polish', kind: 'ai', status: 'succeeded', inputs: primary ? [plan.id, build.id, finding.id] : [], startedAt: at }] } };
  const binding = { id: 'materialization', workspaceId: 'current-workspace', ownerRunId: primary ? main.id : pass.id, workspaceEpoch: 'materialization', mode: 'background' as const,
    increment: { ...output.increment!, summary: 'Reviewed current copy', createdAt: '2026-10-31T20:00:00Z', worktree: '/fixture/current', branch: 'current' }, evidenceHash: 'c'.repeat(64) };
  pass.applyIntent = { id: binding.id, sourceArtifactId: output.id, sourceArtifactHash: output.contentHash, createdAt: at, targetRunId: binding.ownerRunId,
    mode: binding.mode, workspaceEpoch: binding.workspaceEpoch, primaryCheckpointHash: pass.primaryCheckpoint?.contentHash ?? 'none', snapshot: { version: 1, id: 'snapshot', contentHash: 'b'.repeat(64) },
    baseline: structuredClone(pass.reviewedSnapshot!), sourceHash: 'e'.repeat(64) };
  if (primary) { main.workspaceId = binding.workspaceId; main.polishingResources = [{ id: binding.id, workspaceId: binding.workspaceId, priorWorkspaceId: 'original-workspace', priorAttemptCount: main.attempts.length, fromRunRevision: main.revision }]; main.revision++; }
  expect(target.kind).toBe('codechange');
  expect(workflowArtifactCheck(output).id).toBe(output.id);
  expect(polishingResultArtifact(pass).id).toBe(output.id);
  idea.polishingRuns = [pass]; idea.polishingAmendments = [{ id: 'amendment', polishingRunId: pass.id, artifactId: output.id, artifactHash: output.contentHash,
    targetIdentity: target.identity, proposalRevision, approvedAt: at, resourceBinding: binding }]; idea.increment = structuredClone(binding.increment);
  f.store.state!.ideas = [idea];
  return { ...f, idea: f.store.state!.ideas[0]!, plan, pass, binding };
}

it.each([true, false])('projects only genuine applied polishing code and bound plan evidence with primary=%s', async primary => {
  const f = await fixture(primary);
  try {
    const evidence = incrementReviewEvidence(f.idea);
    expect(evidence.hostCaptured).toBe(true); expect(evidence.followups).toEqual([]);
    expect(evidence.criteria).toEqual(primary ? f.plan.plan!.acceptanceCriteria : []);
    f.store.select(f.idea.id, 'increment');
    const wrapper = mount(IdeaDrawer, { global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
    expect(wrapper.text()).toContain('Host-captured changes'); expect(wrapper.text()).toContain('auxiliary'); expect(wrapper.text()).toContain(f.binding.ownerRunId);
    expect(wrapper.text()).not.toContain('Old primary assessment must not describe'); wrapper.unmount();
    expect(f.runner).not.toHaveBeenCalled();
  } finally { await f.dispose(); }
});

it.each([false, true])('keeps historical hash absence honest when the fresh binding adds a hash=%s', async gainsHash => {
  const f = await fixture(false);
  try {
    const pass = f.idea.polishingRuns![0]!; const amendment = f.idea.polishingAmendments![0]!;
    for (const artifact of pass.workflow.artifacts) { delete artifact.increment!.snapshotHash; artifact.contentHash = workflowArtifactHash(artifact); }
    const output = polishingResultArtifact(pass); amendment.artifactHash = output.contentHash; pass.applyIntent!.sourceArtifactHash = output.contentHash;
    if (!gainsHash) { delete amendment.resourceBinding!.increment.snapshotHash; delete f.idea.increment!.snapshotHash; }
    expect(incrementReviewEvidence(f.idea).hostCaptured).toBe(true);
    expect(output.increment!.snapshotHash).toBeUndefined();
  } finally { await f.dispose(); }
});

it('preserves a retained auxiliary resource owner independently of the new producer with no primary run', async () => {
  const f = await fixture(false);
  try {
    const current = f.idea.polishingRuns![0]!; const amendment = f.idea.polishingAmendments![0]!;
    const older = structuredClone(f.pass); older.id = 'retained-owner'; older.workflow.id = older.id; older.workflow.workspaceId = 'retained-producer-workspace';
    for (const artifact of older.workflow.artifacts) { artifact.id = `retained-${artifact.id}`; artifact.runId = older.id; artifact.contentHash = workflowArtifactHash(artifact); }
    const oldOutput = polishingResultArtifact(older); older.applyIntent = { ...older.applyIntent!, id: 'retained-epoch', targetRunId: older.id, workspaceEpoch: 'retained-epoch', sourceArtifactId: oldOutput.id, sourceArtifactHash: oldOutput.contentHash };
    const priorBinding = { ...f.binding, id: older.applyIntent.id, ownerRunId: older.id, workspaceEpoch: older.applyIntent.workspaceEpoch, workspaceId: 'retained-operator-workspace',
      increment: { ...f.binding.increment, worktree: '/fixture/retained', branch: 'retained' } };
    f.idea.polishingRuns = [older]; f.idea.polishingAmendments = [{ ...amendment, id: 'older-amendment', polishingRunId: older.id, artifactId: oldOutput.id, artifactHash: oldOutput.contentHash, resourceBinding: priorBinding }];
    f.idea.increment = structuredClone(priorBinding.increment); current.target = polishingTargetForView(f.idea);
    expect(current.target.workspaceOwnerRunId).toBe(older.id);
    current.reviewedSource = { ...current.reviewedSource!, runId: older.id, sourceKind: 'workspace', sourceWorkspaceId: priorBinding.workspaceId, sourceMaterializationId: priorBinding.id };
    current.sourceArtifacts = [oldOutput]; current.workflow.attempts[0]!.inputs = [oldOutput.id];
    current.applyIntent!.targetRunId = older.id; amendment.resourceBinding!.ownerRunId = older.id; amendment.targetIdentity = current.target.identity;
    f.idea.polishingRuns.push(current); f.idea.polishingAmendments.push(amendment); f.idea.increment = structuredClone(f.binding.increment);
    const evidence = incrementReviewEvidence(f.idea);
    expect(evidence.hostCaptured).toBe(true); expect(evidence.polishing).toMatchObject({ runId: current.id, ownerRunId: older.id });
    expect(older.workflow.workspaceId).toBe('retained-producer-workspace'); expect(older.workflow.polishingResources).toBeUndefined();
  } finally { await f.dispose(); }
});

it.each(['pending', 'foreign producer', 'changed proposal', 'artifact hash', 'resource identity', 'snapshot hash', 'unbound plan', 'plan hash', 'unrelated plan', 'target identity', 'missing intent', 'intent tuple', 'foreign owner', 'stale workspace', 'missing host', 'missing producer', 'simulated producer', 'host hash', 'host attempt', 'missing binding hash'] as const)('does not borrow polished %s evidence', async reason => {
  const f = await fixture();
  try {
    const pass = f.idea.polishingRuns![0]!; const amendment = f.idea.polishingAmendments![0]!;
    if (reason === 'pending') pass.review = 'pending';
    if (reason === 'foreign producer') pass.workflow.projectId = 'CFP-foreign';
    if (reason === 'changed proposal') f.idea.description += ' changed';
    if (reason === 'artifact hash') amendment.artifactHash = 'tampered';
    if (reason === 'resource identity') f.idea.increment!.worktree += '-changed';
    if (reason === 'snapshot hash') f.idea.increment!.snapshotHash = 'd'.repeat(64);
    if (reason === 'unbound plan') pass.workflow.attempts[0]!.inputs = [];
    if (reason === 'plan hash') pass.sourceArtifacts[0]!.plan!.acceptanceCriteria = ['Tampered criteria'];
    if (reason === 'unrelated plan') { const plan = structuredClone(f.plan); plan.id = 'unrelated-plan'; plan.contentHash = workflowArtifactHash(plan); pass.sourceArtifacts[0] = plan; pass.workflow.attempts[0]!.inputs = [plan.id]; }
    if (reason === 'target identity') amendment.targetIdentity = 'foreign-target';
    if (reason === 'missing intent') delete pass.applyIntent;
    if (reason === 'intent tuple') pass.applyIntent!.sourceArtifactId = 'foreign-artifact';
    if (reason === 'foreign owner') { amendment.resourceBinding!.ownerRunId = 'foreign-owner'; pass.applyIntent!.targetRunId = 'foreign-owner'; }
    if (reason === 'stale workspace') f.idea.workflowRun!.workspaceId = 'later-workspace';
    if (reason === 'missing host') pass.workflow.artifacts = pass.workflow.artifacts.filter(item => !item.hostSnapshot);
    if (reason === 'missing producer') { const output = pass.workflow.artifacts.at(-1)!; delete output.increment; output.contentHash = workflowArtifactHash(output); amendment.artifactHash = output.contentHash; pass.applyIntent!.sourceArtifactHash = output.contentHash; }
    if (reason === 'simulated producer') { pass.workflow.artifacts.at(-1)!.increment!.simulated = true; pass.workflow.artifacts.at(-1)!.contentHash = workflowArtifactHash(pass.workflow.artifacts.at(-1)!); amendment.artifactHash = pass.workflow.artifacts.at(-1)!.contentHash; pass.applyIntent!.sourceArtifactHash = amendment.artifactHash; }
    if (reason === 'host hash') { const host = pass.workflow.artifacts.find(item => item.hostSnapshot)!; host.increment!.snapshotHash = 'e'.repeat(64); host.contentHash = workflowArtifactHash(host); }
    if (reason === 'host attempt') { const host = pass.workflow.artifacts.find(item => item.hostSnapshot)!; host.attemptId = 'earlier-attempt'; host.contentHash = workflowArtifactHash(host); }
    if (reason === 'missing binding hash') { delete amendment.resourceBinding!.increment.snapshotHash; delete f.idea.increment!.snapshotHash; }
    const evidence = incrementReviewEvidence(f.idea);
    if (reason === 'unbound plan' || reason === 'plan hash' || reason === 'unrelated plan') { expect(evidence.hostCaptured).toBe(true); expect(evidence.criteria).toEqual([]); }
    else expect(evidence.hostCaptured).toBe(false);
    expect(evidence.followups).toEqual([]);
  } finally { await f.dispose(); }
});

it('keeps independent result review reachable with no main run when workflow authoring is disabled', async () => {
  const f = await fixture(false); f.idea.polishingRuns![0]!.review = 'pending'; f.idea.polishingRuns![0]!.workflow.state = 'attention';
  delete f.idea.polishingRuns![0]!.applyIntent;
  f.store.state!.projects!.find(item => item.id === f.project.id)!.features = ['board'];
  f.store.select(f.idea.id, 'increment'); const wrapper = mount(IdeaDrawer, { global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
  try {
    const workflow = wrapper.findAll('button').find(item => item.text().trim() === 'Workflow runs'); expect(workflow).toBeDefined();
    await workflow!.trigger('click'); await flushPromises();
    expect(wrapper.find('[aria-label="Improve & polish results"]').exists()).toBe(true);
    expect(wrapper.findAll('button').some(item => item.text() === 'Dismiss polishing attempt')).toBe(true); expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});
