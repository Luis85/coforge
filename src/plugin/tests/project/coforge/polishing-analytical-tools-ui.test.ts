// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { expect, it } from 'vitest';
import WorkflowEditorView from '../../../presentation/components/coforge/WorkflowEditorView.vue';
import { useWorkflowEditorStore } from '../../../presentation/stores/coforge-workflow-editor';
import { workflowUiFixture } from './workflow-ui-fixture';

for (const provider of ['claude', 'codex'] as const) it(`saves and reopens ${provider} text-only opt-outs, then re-enables both tools without changing coding scope or dispatching`, async () => {
  const f = await workflowUiFixture();
  let wrapper = mount(WorkflowEditorView, { global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
  try {
    await wrapper.get('[aria-label="Enable Improve & polish"]').setValue(true);
    await wrapper.get('[aria-label="Improvement provider"]').setValue(provider);
    const editor = useWorkflowEditorStore(f.pinia); const writes = f.storage.saves;
    let panel = wrapper.get('[aria-label="Improve & polish configuration"]');
    let options = panel.get('[aria-label="Text-only improvement tools"]');
    expect(options.element.tagName).toBe('DETAILS'); expect(options.attributes('open')).toBeUndefined();
    expect(options.get('[aria-label="Improvement Allow provider-native assistants"]').element).toHaveProperty('checked', true);
    expect(options.get('[aria-label="Improvement Allow native web research"]').element).toHaveProperty('checked', true);
    expect(editor.draft.improvementPass?.nativeTools).toBeUndefined(); expect(f.storage.saves).toBe(writes);
    await options.get('[aria-label="Improvement Allow provider-native assistants"]').setValue(false);
    await options.get('[aria-label="Improvement Allow native web research"]').setValue(false);
    expect(editor.draft.improvementPass?.nativeTools).toEqual({ delegation: false, research: false });
    expect(panel.get('[aria-label="Improvement Native worktree coding"]').text()).toContain('normal file tools, shell, project tests');
    expect(panel.get('[aria-label="Improvement Maximum concurrent native assistants"]').element).toHaveProperty('value', '2');
    expect(panel.get('[aria-label="Improvement Maximum concurrent native assistants"]').attributes('disabled')).toBeDefined();
    expect(panel.text()).toContain('Code improvements still use the default of 2 concurrent native assistants');
    await wrapper.get('form.cf-workflow-editor').trigger('submit'); await flushPromises();
    expect(f.studio.state().settings.workflow?.improvementPass?.nativeTools).toEqual({ delegation: false, research: false });
    wrapper.unmount();
    wrapper = mount(WorkflowEditorView, { global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
    await flushPromises(); panel = wrapper.get('[aria-label="Improve & polish configuration"]');
    options = panel.get('[aria-label="Text-only improvement tools"]');
    expect(options.get('[aria-label="Improvement Allow provider-native assistants"]').element).toHaveProperty('checked', false);
    expect(options.get('[aria-label="Improvement Allow native web research"]').element).toHaveProperty('checked', false);
    await options.get('[aria-label="Improvement Allow native web research"]').setValue(true);
    await options.get('[aria-label="Improvement Allow provider-native assistants"]').setValue(true);
    expect(editor.draft.improvementPass?.nativeTools).toEqual({ delegation: { maxConcurrent: 2 }, research: true });
    expect(panel.get('[aria-label="Improvement Maximum concurrent native assistants"]').attributes('disabled')).toBeUndefined();
    await wrapper.get('form.cf-workflow-editor').trigger('submit'); await flushPromises();
    expect(f.studio.state().settings.workflow?.improvementPass?.nativeTools).toEqual({ delegation: { maxConcurrent: 2 }, research: true });
    expect(f.studio.state().jobs).toEqual([]); expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});
