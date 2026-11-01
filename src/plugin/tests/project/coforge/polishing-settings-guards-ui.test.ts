// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { expect, it } from 'vitest';
import SettingsView from '../../../presentation/components/coforge/SettingsView.vue';
import type { PolishingRun } from '../../../features/coforge/domain/polishing';
import { workflowArtifactHash } from '../../../features/coforge/domain/configured-workflow-run';
import { polishingTargetForView } from '../../../presentation/composables/coforge/polishing-target-for-view';
import { retryUiFixture } from './background-build-retry-ui-fixture';

it('uses pending auxiliary work to block repository changes and unlocks after apply or dismissal', async () => {
  const f = await retryUiFixture(); f.run.state = 'finished'; f.run.cursor = f.run.definition.steps.length;
  f.run.artifacts[0]!.contentHash = workflowArtifactHash(f.run.artifacts[0]!);
  const target = polishingTargetForView(f.idea); const at = new Date().toISOString();
  const pass: PolishingRun = { id: 'aux-pending', feedback: 'Polish the text.', target, sourceHash: target.contentHash, consent: { oldExecutorStopped: false, changesReviewed: true, releaseStopHold: false },
    previousStatus: f.idea.status, sourceArtifacts: [], policySourceRevision: 'policy', createdAt: at, review: 'pending',
    workflow: { ...f.run, id: 'aux-pending', cursor: 0, state: 'attention', attempts: [], artifacts: [], definition: { ...f.run.definition,
      steps: [{ ...f.preview.step, id: 'polish', output: 'markdown', access: 'none' }] } } };
  f.idea.polishingRuns = [pass]; f.store.openSettingsTool('repository');
  const wrapper = mount(SettingsView, { global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
  try {
    await wrapper.get('input[placeholder="C:/Games/my-game"]').setValue('/changed/repository');
    const save = () => wrapper.findAll('button').find(item => item.text().trim() === 'Save settings')!;
    expect(save().attributes('disabled')).toBeDefined(); expect(wrapper.text()).toContain('Improve & polish');
    f.idea.polishingRuns[0]!.review = 'applied'; await flushPromises(); expect(save().attributes('disabled')).toBeUndefined();
    f.idea.polishingRuns[0]!.review = 'pending'; await flushPromises(); expect(save().attributes('disabled')).toBeDefined();
    f.idea.polishingRuns[0]!.review = 'rejected'; await flushPromises(); expect(save().attributes('disabled')).toBeUndefined();
    expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});
