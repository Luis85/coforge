// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { expect, it, vi } from 'vitest';
import IdeaWorkflowTab from '../../../presentation/components/coforge/IdeaWorkflowTab.vue';
import type { PolishingRun } from '../../../features/coforge/domain/polishing';
import { polishingTargetForView } from '../../../presentation/composables/coforge/polishing-target-for-view';
import { retryUiFixture } from './background-build-retry-ui-fixture';

for (const state of ['waiting-human', 'finished'] as const) for (const polishingState of ['attention', 'running'] as const) it(`keeps primary ${state} held while the ${polishingState} improvement offers its appropriate action`, async () => {
  const f = await retryUiFixture(); delete f.idea.increment;
  f.run.definition.steps = [{ id: 'human', name: 'Primary human checkpoint', kind: 'approval', instructions: 'Review the main work.' }];
  f.run.cursor = state === 'finished' ? 1 : 0; f.run.state = state; f.run.attempts = []; f.run.artifacts = [];
  const target = polishingTargetForView(f.idea); const at = new Date().toISOString();
  const pass: PolishingRun = { id: 'pending-pass', feedback: 'Retained feedback', target, sourceHash: 'source', previousStatus: f.idea.status,
    consent: { oldExecutorStopped: false, changesReviewed: true, releaseStopHold: false }, sourceArtifacts: [], policySourceRevision: 'policy', createdAt: at, review: 'pending',
    workflow: { id: 'pending-pass', ideaId: f.idea.id, projectId: f.project.id, definition: { ...f.run.definition, steps: [{ id: 'polish', name: 'Improve & polish', kind: 'ai', output: target.kind === 'request' ? 'markdown' : target.kind, access: 'none', provider: 'claude', model: 'sonnet', instructions: 'Polish', automatic: false }] },
      proposalRevision: f.run.proposalRevision, revision: 1, cursor: 0, state: polishingState, error: 'The independent pass needs attention.', createdAt: at, updatedAt: at,
      attempts: [], artifacts: [] } };
  f.idea.polishingRuns = [pass]; const before = JSON.stringify(f.run);
  const restart = vi.spyOn(f.studio, 'startWorkflow'); const manual = vi.spyOn(f.studio, 'completeWorkflowManual');
  const wrapper = mount(IdeaWorkflowTab, { props: { idea: f.idea }, global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
  try {
    expect(wrapper.find('[aria-label="Manual workflow step"]').exists()).toBe(false);
    expect(wrapper.findAll('button').some(item => item.text() === 'Start a new workflow run')).toBe(false);
    expect(wrapper.get('[aria-label="Next workflow action"]').text()).toContain('Review Improve & polish pass');
    expect(wrapper.findAll('button').some(item => item.text() === 'Stop polishing pass')).toBe(polishingState === 'running');
    expect(wrapper.findAll('button').some(item => item.text() === 'Start new improvement')).toBe(polishingState === 'attention');
    expect(wrapper.findAll('button').some(item => item.text() === 'Dismiss polishing attempt')).toBe(polishingState === 'attention');
    expect(JSON.stringify(f.run)).toBe(before); expect(restart).not.toHaveBeenCalled(); expect(manual).not.toHaveBeenCalled();
    f.idea.polishingRuns[0]!.workflow.state = 'stopped';
    f.idea.polishingRuns[0]!.review = 'rejected'; await flushPromises();
    if (state === 'waiting-human') expect(wrapper.find('[aria-label="Manual workflow step"]').exists()).toBe(true);
    else expect(wrapper.findAll('button').some(item => item.text() === 'Start a new workflow run')).toBe(true);
    expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});
