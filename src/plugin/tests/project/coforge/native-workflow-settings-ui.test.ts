// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { expect, it } from 'vitest';
import PluginSettings from '../../../presentation/components/coforge/PluginSettings.vue';
import WorkflowEditorView from '../../../presentation/components/coforge/WorkflowEditorView.vue';
import { workflowUiFixture } from './workflow-ui-fixture';

it('keeps verification as a disabled, unsaved host grant until valid image and explicit commands are saved', async () => {
  const f = await workflowUiFixture();
  const wrapper = mount(PluginSettings, { global: { plugins: [f.pinia, f.provider], directives: { 'cf-icon': () => {} } } });
  try {
    await flushPromises();
    expect(f.studio.integration().workflowVerification).toBeUndefined();
    await wrapper.get('[aria-label="Enable isolated workflow verification"]').setValue(true);
    await wrapper.get('form').trigger('submit'); await flushPromises();
    expect(wrapper.text()).toContain('existing sha256 image ID');
    expect(f.studio.integration().workflowVerification).toBeUndefined();
    await wrapper.get('[aria-label="Verification image ID"]').setValue(`sha256:${'a'.repeat(64)}`);
    await wrapper.findAll('button').find(button => button.text() === 'Add verification command')!.trigger('click');
    await wrapper.get('[aria-label="Command ID"]').setValue('test');
    await wrapper.get('[aria-label="Command label"]').setValue('Run tests');
    await wrapper.get('[aria-label="Command executable"]').setValue('npm');
    await wrapper.get('[aria-label="Command arguments"]').setValue('run\ntest');
    expect(f.studio.integration().workflowVerification).toBeUndefined();
    await wrapper.get('form').trigger('submit'); await flushPromises();
    expect(f.studio.integration().workflowVerification).toMatchObject({ enabled: true, timeoutSeconds: 600, maxRuns: 8, commands: [{ id: 'test', executable: 'npm', args: ['run', 'test'] }] });
    expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});

it('authors native assistants as an explicit future-step policy without dispatching or requiring a CoWorker roster', async () => {
  const f = await workflowUiFixture();
  const wrapper = mount(WorkflowEditorView, { global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
  try {
    await flushPromises();
    const provider = wrapper.get('[aria-label="AI provider"]');
    await provider.setValue('claude');
    await wrapper.get('[aria-label="Allow provider-native assistants"]').setValue(true);
    expect(wrapper.get('[aria-label="Maximum concurrent native assistants"]').element).toHaveProperty('value', '2');
    expect(wrapper.text()).toContain('Existing attempts keep their captured capabilities');
    await wrapper.get('[aria-label="Enable Improve & polish"]').setValue(true);
    await wrapper.get('[aria-label="Improvement provider"]').setValue('claude');
    await wrapper.get('[aria-label="Improvement Allow provider-native assistants"]').setValue(true);
    expect(wrapper.get('[aria-label="Improvement Maximum concurrent native assistants"]').element).toHaveProperty('value', '2');
    expect(wrapper.text()).toContain('Verification applies to code polishing only');
    expect(f.studio.state().jobs).toEqual([]);
    expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});
