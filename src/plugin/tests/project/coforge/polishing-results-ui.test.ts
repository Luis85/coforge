// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { expect, it, vi } from 'vitest';
import IdeaWorkflowTab from '../../../presentation/components/coforge/IdeaWorkflowTab.vue';
import type { PolishingRun } from '../../../features/coforge/domain/polishing';
import type { WorkflowArtifact } from '../../../features/coforge/domain/configured-workflow-run';
import { workflowArtifactHash } from '../../../features/coforge/domain/configured-workflow-run';
import { selectPolishingTarget } from '../../../features/coforge/domain/polishing-target';
import { workflowAttemptRows } from '../../../presentation/composables/coforge/configured-workflow-history';
import { retryUiFixture } from './background-build-retry-ui-fixture';
import { completedPolish } from './polishing-amendment-fixture';
import { toRaw } from 'vue';
import { polishingTargetForView } from '../../../presentation/composables/coforge/polishing-target-for-view';

it('reviews genuine auxiliary output separately, applies by its exact revision and exposes the approved current result without mutating the main run', async () => {
  const f = await retryUiFixture(); delete f.idea.increment;
  f.run.artifacts[0]!.contentHash = workflowArtifactHash(f.run.artifacts[0]!);
  const target = selectPolishingTarget(f.idea); const at = '2026-10-31T12:00:00Z';
  const artifact: WorkflowArtifact = { id: 'polished-answer', runId: 'aux-polish', stepId: 'polish', attemptId: 'aux-attempt',
    proposalRevision: f.run.proposalRevision, output: 'markdown', createdAt: at, markdown: 'The polished current result.', contentHash: '' };
  artifact.contentHash = workflowArtifactHash(artifact);
  const pass: PolishingRun = { id: 'aux-polish', feedback: 'Tighten the wording.', target, sourceHash: target.contentHash,
    consent: { oldExecutorStopped: false, changesReviewed: true, releaseStopHold: false }, previousStatus: f.idea.status,
    sourceArtifacts: [...f.run.artifacts], policySourceRevision: 'pass-policy', createdAt: at, review: 'pending',
    primaryCheckpoint: { runId: f.run.id, revision: f.run.revision, cursor: f.run.cursor, state: f.run.state, contentHash: 'checkpoint' },
    workflow: { id: 'aux-polish', ideaId: f.idea.id, projectId: f.project.id, proposalRevision: f.run.proposalRevision, revision: 3, cursor: 1, state: 'finished',
      definition: { ...f.run.definition, steps: [{ id: 'polish', kind: 'ai', name: 'Improve & polish', output: 'markdown', access: 'none', provider: 'claude', model: 'sonnet', instructions: 'Polish', automatic: false }] },
      createdAt: at, updatedAt: at, attempts: [{ id: 'aux-attempt', stepId: 'polish', stepName: 'Improve & polish', kind: 'ai', status: 'succeeded', inputs: [], startedAt: at }], artifacts: [artifact] } };
  f.idea.polishingRuns = [pass]; const earlier = JSON.stringify(f.run);
  const apply = vi.spyOn(f.studio, 'applyPolishingResult').mockResolvedValue();
  const wrapper = mount(IdeaWorkflowTab, { props: { idea: f.idea }, global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
  try {
    const history = wrapper.get('[aria-label="Improve & polish results"]');
    expect(history.text()).toContain('The polished current result.'); expect(history.text()).toContain('Tighten the wording.');
    expect(wrapper.find('[aria-label="Current polished result"]').exists()).toBe(false);
    const button = history.findAll('button').find(item => item.text() === 'Apply polished result'); expect(button).toBeDefined();
    await button!.trigger('click'); await flushPromises();
    expect(apply).toHaveBeenCalledExactlyOnceWith(f.idea.id, pass.id, 3); expect(JSON.stringify(f.run)).toBe(earlier);
    const intent = { id: 'copy-intent', sourceArtifactId: artifact.id, sourceArtifactHash: artifact.contentHash, createdAt: at, targetRunId: f.run.id,
      mode: 'background' as const, workspaceEpoch: 'copy-epoch', primaryCheckpointHash: 'checkpoint', sourceHash: 'source-hash',
      snapshot: f.preview.inspection.snapshot, baseline: f.preview.inspection.snapshot };
    f.idea.polishingRuns[0]!.applyIntent = intent; await flushPromises();
    expect(history.findAll('button').some(item => item.text() === 'Check existing Apply')).toBe(true);
    expect(history.text()).toContain('No fresh copy');
    f.idea.polishingRuns[0]!.applyFailure = { intentId: 'another-intent', code: 'POLISHING_COPY_RETAINED', message: 'Retained target', at }; await flushPromises();
    expect(history.findAll('button').some(item => item.text() === 'Retry Apply with a fresh copy')).toBe(false);
    f.idea.polishingRuns[0]!.applyFailure!.intentId = intent.id; await flushPromises();
    const retry = history.findAll('button').find(item => item.text() === 'Retry Apply with a fresh copy'); expect(retry).toBeDefined();
    await retry!.trigger('click'); await flushPromises(); expect(apply).toHaveBeenLastCalledWith(f.idea.id, pass.id, 3);
    expect(history.text()).toContain('The polished current result.'); expect(history.text()).toContain('Tighten the wording.');
    f.idea.polishingRuns[0]!.review = 'applied';
    f.idea.polishingAmendments = [{ id: 'approved-amendment', polishingRunId: pass.id, artifactId: artifact.id, artifactHash: artifact.contentHash,
      targetIdentity: target.identity, proposalRevision: f.run.proposalRevision, approvedAt: at }];
    await flushPromises();
    expect(wrapper.get('[aria-label="Current polished result"]').text()).toContain('The polished current result.');
    expect(JSON.stringify(f.run)).toBe(earlier); expect(f.runner).not.toHaveBeenCalled();
    expect(workflowAttemptRows([f.idea], []).some(row => row.id === 'aux-attempt' && row.stageLabel === 'Improve & polish')).toBe(true);
  } finally { wrapper.unmount(); await f.dispose(); }
});

it('keeps accepted code polishing visible with genuine producer provenance and a separate retained workspace owner', async () => {
  const f = await retryUiFixture(); f.idea.status = 'shipped'; delete f.idea.workflowRun; f.idea.increment = f.preview.inspection.increment!;
  const pass = completedPolish(toRaw(f.idea), { increment: { ...toRaw(f.idea.increment), summary: 'Approved polished code', diff: '+approved polished code' }, summary: 'Approved polished code' });
  const step = pass.workflow.definition.steps[0]; if (step?.kind !== 'ai') throw new Error('Missing pass'); step.provider = 'claude'; step.access = 'editworktree'; step.execution = { mode: 'background' };
  pass.review = 'applied'; const artifact = pass.workflow.artifacts[0]!;
  const binding = { id: 'retained-materialization', workspaceId: 'bg-reviewed-result', ownerRunId: 'retained-resource-owner', mode: 'background' as const, workspaceEpoch: 'retained-materialization',
    increment: { ...artifact.increment!, worktree: '/fixture/reviewed-result' }, evidenceHash: 'b'.repeat(64) };
  f.idea.increment = binding.increment; f.idea.polishingAmendments = [{ id: 'code-amendment', polishingRunId: pass.id, artifactId: artifact.id, artifactHash: artifact.contentHash,
    targetIdentity: pass.target.identity, proposalRevision: pass.workflow.proposalRevision, approvedAt: new Date().toISOString(), resourceBinding: binding }];
  const wrapper = mount(IdeaWorkflowTab, { props: { idea: f.idea }, global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
  try {
    const current = wrapper.get('[aria-label="Current polished result"]'); expect(current.text()).toContain('+approved polished code');
    expect(current.text()).toContain(pass.id); expect(current.text()).toContain(binding.ownerRunId);
    expect(polishingTargetForView(f.idea)).toMatchObject({ sourceRunId: pass.id, sourceArtifactId: artifact.id, workspaceOwnerRunId: binding.ownerRunId });
    expect(f.idea.workflowRun).toBeUndefined(); expect(f.idea.status).toBe('shipped'); expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});
