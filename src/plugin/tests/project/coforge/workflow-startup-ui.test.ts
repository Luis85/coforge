// @vitest-environment happy-dom
import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import { expect, it } from 'vitest';
import WorkflowStartupMode from '../../../presentation/components/coforge/WorkflowStartupMode.vue';
import { useWorkflowEditor, type WorkflowEditorModel } from '../../../presentation/composables/coforge/use-workflow-editor';
import { StudioStore } from '../../../features/coforge/application/studio-store';
import { workflowUiFixture } from './workflow-ui-fixture';

it('saves the selected startup mode only explicitly and applies it on reopening', async () => {
  const f = await workflowUiFixture();
  const binding: { model?: WorkflowEditorModel } = {};
  const Probe = defineComponent({ setup() { binding.model = useWorkflowEditor(); return () => h(WorkflowStartupMode); } });
  const wrapper = mount(Probe, { global: { plugins: [f.pinia, f.provider] } });
  try {
    const control = wrapper.get('[aria-label="Idea board automation on startup"]');
    expect(control.element).toHaveProperty('value', 'paused');
    const writes = f.storage.saves;
    await control.setValue('play');
    expect(f.storage.saves).toBe(writes);
    expect(f.studio.state().settings.paused).toBe(true);
    await binding.model!.save(); await flushPromises();
    expect(f.studio.state().settings.workflow?.startupMode).toBe('play');
    expect(f.studio.state().settings.paused).toBe(true);
    const reloaded = new StudioStore(f.storage); await reloaded.init();
    expect(reloaded.snapshot().settings.paused).toBe(false);
    expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});

it('keeps the startup draft and current paused state when saving fails', async () => {
  const f = await workflowUiFixture();
  const binding: { model?: WorkflowEditorModel } = {};
  const Probe = defineComponent({ setup() { binding.model = useWorkflowEditor(); return () => h(WorkflowStartupMode); } });
  const wrapper = mount(Probe, { global: { plugins: [f.pinia, f.provider] } });
  try {
    await wrapper.get('[aria-label="Idea board automation on startup"]').setValue('play');
    f.storage.failNextSave = true;
    await binding.model!.save(); await flushPromises();
    expect(binding.model!.error).toContain('Disk full');
    expect(wrapper.get('[aria-label="Idea board automation on startup"]').element).toHaveProperty('value', 'play');
    expect(f.studio.state().settings.workflow).toBeUndefined();
    expect(f.studio.state().settings.paused).toBe(true);
    expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});
