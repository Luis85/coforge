// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { expect, it, vi } from 'vitest';
import StudioApp from '../../../presentation/components/coforge/StudioApp.vue';
import { workflowUiFixture } from './workflow-ui-fixture';
import { defaultWorkflowDefinition, workflowDefinition } from '../../../features/coforge/domain/configured-workflow';
import { defaultImprovementPass } from '../../../features/coforge/domain/polishing-pass-configuration';
import { selectPolishingTarget } from '../../../features/coforge/domain/polishing-target';
import type { PolishingPreview } from '../../../features/coforge/domain/polishing';
import PolishingFeedbackDialog from '../../../presentation/components/coforge/PolishingFeedbackDialog.vue';
import { usePolishingUiStore } from '../../../presentation/stores/coforge-polishing-ui';
import { polishingTargetForView } from '../../../presentation/composables/coforge/polishing-target-for-view';
import { retryUiFixture } from './background-build-retry-ui-fixture';
import { createPinia, disposePinia } from 'pinia';
import { nextTick } from 'vue';

it('opens a separate feedback modal for the selected result, suspends the detail dialog, validates feedback and restores its trigger', async () => {
  const f = await workflowUiFixture();
  await f.studio.createIdea({ title: 'Polish the current request', description: 'Preserve my original request and workflow progress.', category: 'Gameplay', username: 'streamer' });
  const idea = f.studio.state().ideas[0]; if (!idea) throw new Error('Missing canonical request');
  f.store.select(idea.id, 'workflow');
  const wrapper = mount(StudioApp, { attachTo: document.body, global: { plugins: [f.pinia, f.provider], directives: { 'cf-icon': () => {} } } });
  try {
    await flushPromises(); const saves = f.storage.saves;
    const trigger = wrapper.findAll('button').find(item => item.text() === 'Improve & polish');
    expect(trigger).toBeDefined(); trigger!.element.focus(); await trigger!.trigger('click'); await flushPromises();
    const modal = wrapper.get('[aria-label="Improve & polish current result"]');
    expect(modal.isVisible()).toBe(true); expect(wrapper.get('.cf-idea-drawer').isVisible()).toBe(false);
    expect(wrapper.findAll('[role="dialog"]').filter(item => item.isVisible())).toHaveLength(1);
    expect(document.activeElement).toBe(modal.get('[aria-label="Feedback for this polishing pass"]').element);
    await modal.get('form').trigger('submit'); await flushPromises();
    expect(modal.text()).toContain('Enter feedback');
    await modal.get('[aria-label="Feedback for this polishing pass"]').setValue('Keep this feedback when setup or validation needs attention.');
    await modal.get('form').trigger('submit'); await flushPromises();
    expect(modal.get('[aria-label="Feedback for this polishing pass"]').element).toHaveProperty('value', 'Keep this feedback when setup or validation needs attention.');
    expect(modal.text()).toContain('Configure Improve & polish');
    expect(f.storage.saves).toBe(saves); expect(f.runner).not.toHaveBeenCalled();
    await modal.trigger('keydown', { key: 'Escape' }); await flushPromises();
    expect(wrapper.find('[aria-label="Improve & polish current result"]').exists()).toBe(false);
    expect(wrapper.get('.cf-idea-drawer').isVisible()).toBe(true); expect(document.activeElement).toBe(trigger!.element);
  } finally { wrapper.unmount(); await f.dispose(); }
});

it('separates a legacy accepted code result from the actual reviewed clean repository base', async () => {
  const f = await retryUiFixture(); f.idea.status = 'shipped'; delete f.idea.workflowRun; f.idea.increment = f.preview.inspection.increment!;
  f.store.state!.projects!.find(item => item.id === f.project.id)!.settings.workflow!.improvementPass = { ...defaultImprovementPass(f.project.settings), provider: 'claude', model: 'sonnet' };
  const ui = usePolishingUiStore(f.pinia); ui.open(f.idea.id);
  const inspection = { ...f.preview.inspection, captureScope: 'coforge-source-code/v1' as const,
    excludedPaths: [{ path: 'node_modules', reason: 'git-ignored-agent-denied-directory' as const }, { path: '.codex', reason: 'git-ignored-agent-denied-link' as const }],
    sourceKind: 'repository' as const, sourceWorkspaceId: undefined, increment: null, fileCount: 0, totalBytes: 0, humanCessationRequired: false };
  const preview: PolishingPreview = { id: 'clean-code-review', ideaId: f.idea.id, sourceHash: 'source', feedback: '', target: polishingTargetForView(f.idea),
    step: { ...f.preview.step, execution: f.preview.policy }, sourceArtifacts: [], policySourceRevision: 'current-saved-policy', inheritedLimits: f.preview.inheritedLimits,
    effectiveLimits: f.preview.effectiveLimits, inspection, readiness: f.preview.readiness, stopHold: false, oldExecutorAcknowledgementRequired: false, createdAt: f.preview.createdAt };
  vi.spyOn(f.studio, 'previewPolishingPass').mockImplementation(async (_id, feedback) => ({ ...preview, feedback }));
  const wrapper = mount(PolishingFeedbackDialog, { global: { plugins: [f.pinia, f.provider] } });
  try {
    await wrapper.get('[aria-label="Feedback for this polishing pass"]').setValue('Polish from the reviewed base.');
    await wrapper.get('form').trigger('submit'); await flushPromises();
    const snapshot = wrapper.get('[aria-label="Reviewed code snapshot"]');
    expect(snapshot.text()).toContain('Repository base'); expect(snapshot.text()).toContain('Current clean repository');
    expect(snapshot.text()).toContain(inspection.baseCommit); expect(snapshot.text()).toContain('0 changed files'); expect(snapshot.text()).toContain('0 bytes');
    expect(snapshot.text()).toContain('Earlier result context');
    expect(snapshot.get('[aria-label="Reviewed snapshot capture scope"]').text()).toContain('node_modules');
    expect(snapshot.text()).toContain('Git-ignored link already denied'); expect(snapshot.text()).toContain('not transferred');
    expect(snapshot.text()).not.toContain('continues these reviewed changes');
    expect(wrapper.find('[aria-label="I inspected earlier polishing source executors"]').exists()).toBe(false); expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});

it('clears a reviewed receipt when only the primary checkpoint changes and retains the feedback', async () => {
  const f = await workflowUiFixture(); const settings = f.studio.state().settings;
  await f.studio.saveWorkflow(f.project.id, { ...defaultWorkflowDefinition(settings), steps: [{ id: 'human', kind: 'approval', name: 'Human checkpoint', instructions: 'Review before proceeding.' }],
    improvementPass: { ...defaultImprovementPass(settings), provider: 'claude', model: 'sonnet' } }, JSON.stringify(workflowDefinition(settings)));
  await f.studio.createIdea({ title: 'Stable current request', description: 'Keep this body unchanged.', category: 'Gameplay', username: 'streamer' });
  const idea = f.studio.state().ideas[0]!; const target = selectPolishingTarget(idea); f.store.select(idea.id, 'workflow');
  vi.spyOn(f.studio, 'previewPolishingPass').mockImplementation(async (_id, feedback): Promise<PolishingPreview> => ({ id: 'checkpoint-review', ideaId: idea.id, feedback, target, sourceHash: 'source',
    step: { id: 'polish', kind: 'ai', name: 'Polish', provider: 'claude', model: 'sonnet', output: 'markdown', access: 'none', instructions: 'Polish', automatic: false },
    sourceArtifacts: [], policySourceRevision: f.studio.state().settings.workflow!.revision, inheritedLimits: { maxTurns: 12, maxBudgetUsd: 1 }, effectiveLimits: { maxTurns: 12, maxBudgetUsd: 1 },
    stopHold: false, oldExecutorAcknowledgementRequired: false, createdAt: new Date().toISOString() }));
  const wrapper = mount(StudioApp, { attachTo: document.body, global: { plugins: [f.pinia, f.provider], directives: { 'cf-icon': () => {} } } });
  try {
    await flushPromises(); await wrapper.findAll('button').find(item => item.text() === 'Improve & polish')!.trigger('click'); await flushPromises();
    const modal = wrapper.get('[aria-label="Improve & polish current result"]');
    await modal.get('[aria-label="Feedback for this polishing pass"]').setValue('Preserve the checkpoint.');
    await modal.get('form').trigger('submit'); await flushPromises();
    await modal.get('[aria-label="I reviewed the current result and feedback"]').setValue(true);
    expect(modal.findAll('button').find(item => item.text() === 'Confirm Improve & polish')!.attributes('disabled')).toBeUndefined();
    await f.studio.startWorkflow(idea.id); await flushPromises();
    expect(selectPolishingTarget(f.studio.state().ideas[0]!).contentHash).toBe(target.contentHash);
    expect(modal.find('[aria-label="Review polishing pass"]').exists()).toBe(false);
    expect(modal.get('[aria-label="Feedback for this polishing pass"]').element).toHaveProperty('value', 'Preserve the checkpoint.');
    expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});

it('restores a replaced trigger inside its originating studio rather than another app showing the same request', async () => {
  const first = createPinia(); const second = createPinia(); const ui = usePolishingUiStore(second);
  const host = document.createElement('div'); document.body.append(host);
  const one = document.createElement('div'); one.className = 'cf-studio'; const two = one.cloneNode(); host.append(one, two);
  if (!(two instanceof HTMLElement)) throw new Error('Missing second studio');
  const firstButton = document.createElement('button'); firstButton.dataset.polishingTrigger = 'CF-901'; firstButton.textContent = 'First'; one.append(firstButton);
  const old = document.createElement('button'); old.dataset.polishingTrigger = 'CF-901'; old.textContent = 'Old second'; two.append(old);
  try {
    old.focus(); ui.open('CF-901', old); old.remove();
    const replacement = document.createElement('button'); replacement.dataset.polishingTrigger = 'CF-901'; replacement.textContent = 'Replacement second'; two.append(replacement);
    ui.close(); await nextTick();
    expect(document.activeElement).toBe(replacement); expect(document.activeElement).not.toBe(firstButton);
    expect(usePolishingUiStore(first).isOpen).toBe(false);
  } finally { host.remove(); disposePinia(first); disposePinia(second); }
});

it('projects actual reactive code snapshots into plain contract data and invalidates consent when their reviewed bytes change', async () => {
  const f = await retryUiFixture(); f.idea.increment = f.preview.inspection.increment!;
  f.store.state!.projects!.find(item => item.id === f.project.id)!.settings.workflow!.improvementPass = { ...defaultImprovementPass(f.project.settings), provider: 'claude', model: 'sonnet' };
  const target = polishingTargetForView(f.idea); const ui = usePolishingUiStore(f.pinia); ui.open(f.idea.id);
  const preview: PolishingPreview = { id: 'code-review', ideaId: f.idea.id, sourceHash: 'source', feedback: '', target, step: { ...f.preview.step, execution: f.preview.policy },
    sourceArtifacts: [], policySourceRevision: 'current-saved-policy', inheritedLimits: f.preview.inheritedLimits, effectiveLimits: f.preview.effectiveLimits,
    inspection: f.preview.inspection, readiness: f.preview.readiness, stopHold: false, oldExecutorAcknowledgementRequired: true, createdAt: f.preview.createdAt };
  vi.spyOn(f.studio, 'previewPolishingPass').mockImplementation(async (_id, feedback) => ({ ...preview, feedback }));
  const wrapper = mount(PolishingFeedbackDialog, { global: { plugins: [f.pinia, f.provider] } });
  try {
    await wrapper.get('[aria-label="Feedback for this polishing pass"]').setValue('Polish the actual changed files.');
    await wrapper.get('form').trigger('submit'); await flushPromises();
    expect(wrapper.get('[aria-label="Reviewed code snapshot"]').text()).toContain('actual reviewed partial code');
    await wrapper.get('[aria-label="I reviewed the current result and feedback"]').setValue(true);
    await wrapper.get('[aria-label="I inspected earlier polishing source executors"]').setValue(true);
    f.idea.increment!.diff += '\n+changed after review'; await flushPromises();
    expect(wrapper.find('[aria-label="Review polishing pass"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('current result, feedback or saved pass changed');
    expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});

it('captures feedback separately, requires all applicable consents, invalidates changed feedback and retains it when admission fails', async () => {
  const f = await workflowUiFixture();
  const settings = f.studio.state().settings;
  await f.studio.saveWorkflow(f.project.id, { ...defaultWorkflowDefinition(settings), improvementPass: { ...defaultImprovementPass(settings), provider: 'claude', model: 'sonnet' } }, JSON.stringify(workflowDefinition(settings)));
  await f.studio.createIdea({ title: 'Current original request', description: 'Keep the canonical body intact.', category: 'Gameplay', username: 'streamer' });
  const idea = f.studio.state().ideas[0]!; f.store.select(idea.id, 'workflow');
  const source = selectPolishingTarget(idea); const policy = f.studio.state().settings.workflow!;
  const preview: PolishingPreview = { id: 'polish-preview', ideaId: idea.id, feedback: '', target: source, sourceHash: 'source-hash',
    step: { id: 'polish', name: 'Improve & polish', kind: 'ai', provider: 'claude', model: 'sonnet', effort: 'high', instructions: 'Trusted saved pass instructions.', output: 'markdown', access: 'none', automatic: false },
    sourceArtifacts: [], policySourceRevision: policy.revision, inheritedLimits: { maxTurns: 12, maxBudgetUsd: 1 }, effectiveLimits: { maxTurns: 12, maxBudgetUsd: 1 },
    stopHold: true, oldExecutorAcknowledgementRequired: true, createdAt: new Date().toISOString() };
  const inspect = vi.spyOn(f.studio, 'previewPolishingPass').mockImplementation(async (_id, feedback) => ({ ...preview, feedback }));
  const confirm = vi.spyOn(f.studio, 'confirmPolishingPass').mockRejectedValueOnce(new Error('Current result changed. Preview again.'));
  const wrapper = mount(StudioApp, { attachTo: document.body, global: { plugins: [f.pinia, f.provider], directives: { 'cf-icon': () => {} } } });
  try {
    await flushPromises(); const original = JSON.stringify(f.studio.state().ideas[0]);
    await wrapper.findAll('button').find(item => item.text() === 'Improve & polish')!.trigger('click'); await flushPromises();
    const modal = wrapper.get('[aria-label="Improve & polish current result"]');
    const feedback = modal.get('[aria-label="Feedback for this polishing pass"]'); await feedback.setValue('Make the wording clearer.');
    await modal.get('form').trigger('submit'); await flushPromises();
    expect(inspect).toHaveBeenCalledWith(idea.id, 'Make the wording clearer.'); expect(confirm).not.toHaveBeenCalled();
    expect(modal.text()).toContain('Trusted saved pass instructions.');
    const approve = () => modal.findAll('button').find(item => item.text() === 'Confirm Improve & polish')!;
    await modal.get('[aria-label="I reviewed the current result and feedback"]').setValue(true); expect(approve().attributes('disabled')).toBeDefined();
    await modal.get('[aria-label="I inspected earlier polishing source executors"]').setValue(true); expect(approve().attributes('disabled')).toBeDefined();
    await modal.get('[aria-label="Release this Stop hold for polishing"]').setValue(true); expect(approve().attributes('disabled')).toBeUndefined();
    await feedback.setValue('Keep this newer feedback after a failed admission.'); await flushPromises();
    expect(modal.find('[aria-label="Review polishing pass"]').exists()).toBe(false);
    await modal.get('form').trigger('submit'); await flushPromises();
    await modal.get('[aria-label="I reviewed the current result and feedback"]').setValue(true);
    await modal.get('[aria-label="I inspected earlier polishing source executors"]').setValue(true);
    await modal.get('[aria-label="Release this Stop hold for polishing"]').setValue(true);
    await approve().trigger('click'); await flushPromises();
    expect(confirm).toHaveBeenCalledExactlyOnceWith(idea.id, preview.id, { oldExecutorStopped: true, changesReviewed: true, releaseStopHold: true });
    expect(modal.text()).toContain('Current result changed'); expect(feedback.element).toHaveProperty('value', 'Keep this newer feedback after a failed admission.');
    expect(modal.find('[aria-label="Review polishing pass"]').exists()).toBe(false);
    expect(JSON.stringify(f.studio.state().ideas[0])).toBe(original); expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});
