// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { expect, it } from 'vitest';
import WorkflowView from '../../../presentation/components/coforge/WorkflowView.vue';
import WorkflowEditorView from '../../../presentation/components/coforge/WorkflowEditorView.vue';
import { useWorkflowEditorStore } from '../../../presentation/stores/coforge-workflow-editor';
import { workflowUiFixture } from './workflow-ui-fixture';

it('configures a refinement task without task deadlines, spending caps or execution plumbing', async () => {
  const f = await workflowUiFixture(); f.store.openWorkflowTool('settings');
  const wrapper = mount(WorkflowView, { global: { plugins: [f.pinia, f.provider], directives: { 'cf-icon': () => {} } } });
  try {
    const editor = useWorkflowEditorStore(f.pinia);
    const legacyLimits = { ...editor.draft.limits };
    expect(wrapper.get('nav[aria-label="Agent workflow pages"]').text()).not.toContain('Timing & limits');
    await wrapper.get('[aria-label="AI provider"]').setValue('claude');
    await wrapper.get('[aria-label="Step instructions"]').setValue('Refine this proposal and report the useful next increment.');
    await wrapper.get('[aria-label="Enable Improve & polish"]').setValue(true);
    await wrapper.get('[aria-label="Improvement provider"]').setValue('claude');
    for (const selector of ['[data-workflow-field="limits.timeoutSeconds"]', '[data-workflow-field="limits.maxTurns"]', '[data-workflow-field="limits.maxBudgetUsd"]',
      '[aria-label="Improvement timeout seconds"]', '[aria-label="Set improvement code deadline"]', '[aria-label="Build execution policy"]']) {
      expect(wrapper.find(selector).exists(), selector).toBe(false);
    }
    expect(wrapper.text()).toContain('Quiet periods do not end the task');
    expect(wrapper.text()).toContain('Stop');
    expect(editor.draft.limits).toEqual(legacyLimits);
    expect(f.runner).not.toHaveBeenCalled();
    await wrapper.get('form.cf-workflow-editor').trigger('submit'); await flushPromises();
    expect(f.studio.state().settings.workflow?.steps.find(step => step.kind === 'ai')?.kind).toBe('ai');
    expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});

it('keeps an old timing deep link informative and read-only without exposing obsolete task-limit controls', async () => {
  const f = await workflowUiFixture();
  const wrapper = mount(WorkflowEditorView, { props: { pane: 'limits' }, global: { plugins: [f.pinia, f.provider], directives: { 'cf-icon': () => {} } } });
  try {
    expect(wrapper.get('h1').text()).toBe('Agent behavior');
    const panel = wrapper.get('[aria-label="Managed agent behavior"]');
    expect(panel.find('input').exists()).toBe(false);
    expect(panel.text()).toContain('completion');
    expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});
