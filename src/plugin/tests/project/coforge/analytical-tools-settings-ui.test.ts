// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { expect, it } from 'vitest';
import WorkflowEditorView from '../../../presentation/components/coforge/WorkflowEditorView.vue';
import { useWorkflowEditorStore } from '../../../presentation/stores/coforge-workflow-editor';
import { workflowUiFixture } from './workflow-ui-fixture';

it('offers scoped assistants and research by default for native analytical work without changing saved permissions or dispatching', async () => {
  const f = await workflowUiFixture();
  const wrapper = mount(WorkflowEditorView, { global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
  try {
    const editor = useWorkflowEditorStore(f.pinia); editor.selectedId = 'plan';
    await flushPromises(); await wrapper.get('[aria-label="AI provider"]').setValue('claude');
    const step = editor.draft.steps.find(step => step.id === 'plan');
    if (!step || step.kind !== 'ai') throw new Error('Expected Plan');
    const saved = JSON.stringify(f.studio.state().settings.workflow); const writes = f.storage.saves;
    expect(wrapper.get('[aria-label="Allow provider-native assistants"]').element).toHaveProperty('checked', true);
    expect(wrapper.get('[aria-label="Allow native web research"]').element).toHaveProperty('checked', true);
    expect(wrapper.get('[aria-label="Native workflow tools"]').text()).toContain('Research and native assistants');
    expect(wrapper.get('[aria-label="Native workflow tools"]').text()).toContain('do not allow shell commands or repository writes');
    expect(wrapper.get('[aria-label="Maximum concurrent native assistants"]').element).toHaveProperty('value', '2');
    expect(step.nativeTools).toBeUndefined();
    expect(f.storage.saves).toBe(writes); expect(JSON.stringify(f.studio.state().settings.workflow)).toBe(saved);
    expect(f.studio.state().jobs).toEqual([]); expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});

it('saves explicit analytical opt-outs across reopening and provider changes instead of restoring inherited defaults', async () => {
  const f = await workflowUiFixture();
  let wrapper = mount(WorkflowEditorView, { global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
  try {
    const editor = useWorkflowEditorStore(f.pinia); editor.selectedId = 'plan';
    await flushPromises(); await wrapper.get('[aria-label="AI provider"]').setValue('claude');
    await wrapper.get('[aria-label="Allow provider-native assistants"]').setValue(false);
    await wrapper.get('[aria-label="Allow native web research"]').setValue(false);
    const step = editor.draft.steps.find(step => step.id === 'plan');
    if (!step || step.kind !== 'ai') throw new Error('Expected Plan');
    expect(step.nativeTools).toEqual({ delegation: false, research: false });
    await wrapper.get('form.cf-workflow-editor').trigger('submit'); await flushPromises();
    expect(wrapper.text()).toContain('Workflow saved.');
    expect(f.studio.state().settings.workflow?.steps.find(step => step.id === 'plan')).toMatchObject({ nativeTools: { delegation: false, research: false } });
    wrapper.unmount();
    wrapper = mount(WorkflowEditorView, { global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
    await flushPromises(); editor.selectedId = 'plan'; await flushPromises();
    expect(wrapper.get('[aria-label="Allow provider-native assistants"]').element).toHaveProperty('checked', false);
    expect(wrapper.get('[aria-label="Allow native web research"]').element).toHaveProperty('checked', false);
    await wrapper.get('[aria-label="AI provider"]').setValue('codex');
    expect(wrapper.get('[aria-label="Allow provider-native assistants"]').element).toHaveProperty('checked', false);
    await wrapper.get('[aria-label="AI provider"]').setValue('demo');
    expect(wrapper.find('[aria-label="Allow native web research"]').exists()).toBe(false);
    expect(wrapper.get('[aria-label="Allow provider-native assistants"]').attributes('disabled')).toBeDefined();
    await wrapper.get('form.cf-workflow-editor').trigger('submit'); await flushPromises();
    expect(wrapper.text()).toContain('Workflow saved.');
    await wrapper.get('[aria-label="AI provider"]').setValue('claude');
    expect(wrapper.get('[aria-label="Allow native web research"]').element).toHaveProperty('checked', false);
    expect(editor.draft.steps.find(step => step.id === 'plan')).toMatchObject({ nativeTools: { delegation: false, research: false } });
    expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});

it('lets an unsupported provider clear a previously saved research request without hiding the field needed to save', async () => {
  const f = await workflowUiFixture();
  const wrapper = mount(WorkflowEditorView, { global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
  try {
    const editor = useWorkflowEditorStore(f.pinia); editor.selectedId = 'plan';
    await flushPromises(); await wrapper.get('[aria-label="AI provider"]').setValue('claude');
    await wrapper.get('[aria-label="Allow native web research"]').setValue(false);
    await wrapper.get('[aria-label="Allow native web research"]').setValue(true);
    await wrapper.get('[aria-label="AI provider"]').setValue('demo');
    expect(wrapper.get('[aria-label="Native workflow tools"]').text()).toContain('unavailable for this provider or result contract');
    await wrapper.get('[aria-label="Allow native web research"]').setValue(false);
    await wrapper.get('form.cf-workflow-editor').trigger('submit'); await flushPromises();
    expect(wrapper.text()).toContain('Workflow saved.');
    expect(f.studio.state().settings.workflow?.steps.find(step => step.id === 'plan')).toMatchObject({ nativeTools: { research: false } });
    expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});

it('keeps invalid assistant-count drafts editable and blocks saving until repaired without losing the tool defaults', async () => {
  const f = await workflowUiFixture();
  const wrapper = mount(WorkflowEditorView, { global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
  try {
    const editor = useWorkflowEditorStore(f.pinia); editor.selectedId = 'plan';
    await flushPromises(); await wrapper.get('[aria-label="AI provider"]').setValue('claude');
    const saved = JSON.stringify(f.studio.state().settings.workflow); const writes = f.storage.saves;
    await wrapper.get('[aria-label="Maximum concurrent native assistants"]').setValue(0);
    expect(wrapper.get('[aria-label="Allow provider-native assistants"]').element).toHaveProperty('checked', true);
    expect(wrapper.get('[aria-label="Allow native web research"]').element).toHaveProperty('checked', true);
    await wrapper.get('form.cf-workflow-editor').trigger('submit'); await flushPromises();
    expect(JSON.stringify(f.studio.state().settings.workflow)).toBe(saved); expect(f.storage.saves).toBe(writes);
    await wrapper.get('[aria-label="Maximum concurrent native assistants"]').setValue(2);
    await wrapper.get('form.cf-workflow-editor').trigger('submit'); await flushPromises();
    expect(wrapper.text()).toContain('Workflow saved.'); expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});

it('keeps classifiers outside analytical defaults and explains text polishing separately from coding permissions', async () => {
  const f = await workflowUiFixture();
  const wrapper = mount(WorkflowEditorView, { global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
  try {
    const editor = useWorkflowEditorStore(f.pinia); editor.selectedId = 'screen';
    await flushPromises(); await wrapper.get('[aria-label="AI provider"]').setValue('claude');
    expect(wrapper.get('[aria-label="Allow provider-native assistants"]').element).toHaveProperty('checked', false);
    expect(wrapper.find('[aria-label="Allow native web research"]').exists()).toBe(false);
    await wrapper.get('[aria-label="Enable Improve & polish"]').setValue(true);
    await wrapper.get('[aria-label="Improvement provider"]').setValue('claude');
    expect(wrapper.get('[aria-label="Improvement Native workflow tools"]').text()).toContain('Text-only improvements');
    expect(wrapper.get('[aria-label="Improvement Native workflow tools"]').text()).toContain('research');
    expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});
