// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { defineComponent, h, reactive } from 'vue';
import { expect, it } from 'vitest';
import ProviderModelFields from '../../../presentation/components/coforge/ProviderModelFields.vue';
import CoWorkerInventory from '../../../presentation/components/coforge/CoWorkerInventory.vue';
import WorkflowAiStepFields from '../../../presentation/components/coforge/WorkflowAiStepFields.vue';
import { useWorkflowEditor, type WorkflowEditorModel } from '../../../presentation/composables/coforge/use-workflow-editor';
import type { ProviderModelChoice } from '../../../presentation/composables/coforge/use-provider-model-fields';
import { CouncilCatalogue, type CouncilCatalogueSnapshot } from '../../../features/coforge/application/council-catalogue';
import { definitionRevision } from '../../../features/coforge/domain/council-definitions';
import { workflowUiFixture } from './workflow-ui-fixture';

it('offers documented model choices, filters effort, preserves custom IDs and disables simulation', async () => {
  const choice = reactive<ProviderModelChoice>({ provider: 'claude', model: 'sonnet', effort: 'high' });
  const wrapper = mount(ProviderModelFields, { props: { choice } });
  try {
    expect(wrapper.get('[aria-label="Model"]').findAll('option').map(item => item.attributes('value'))).toContain('opus');
    await wrapper.get('[aria-label="Model"]').setValue('claude-opus-4-6');
    expect(wrapper.get('[aria-label="Reasoning effort"]').text()).not.toContain('Extra high');
    await wrapper.get('[aria-label="Reasoning effort"]').setValue('max');
    expect(choice.effort).toBe('max');
    await wrapper.get('[aria-label="Model"]').setValue('claude-haiku-4-5');
    expect(choice.effort).toBeUndefined();
    expect(wrapper.get('[aria-label="Reasoning effort"]').attributes('disabled')).toBeDefined();
    await wrapper.get('[aria-label="Model"]').setValue('__custom');
    await wrapper.get('[aria-label="Custom model ID"]').setValue('my-provider-deployment');
    expect(choice.model).toBe('my-provider-deployment');
    choice.provider = 'demo'; await flushPromises();
    expect(wrapper.get('[aria-label="Model"]').attributes('disabled')).toBeDefined();
    expect(wrapper.get('[aria-label="Model"]').element).toHaveProperty('value', 'my-provider-deployment');
    expect(choice.model).toBe('my-provider-deployment');
    choice.provider = 'herdr'; await flushPromises();
    expect(wrapper.get('[aria-label="Custom model ID"]').element).toHaveProperty('value', 'my-provider-deployment');
    await wrapper.get('[aria-label="Model"]').setValue('opus');
    await wrapper.get('[aria-label="Reasoning effort"]').setValue('high');
    choice.provider = 'demo'; await flushPromises();
    expect(choice.effort).toBeUndefined();
    choice.provider = 'codex'; await flushPromises();
    expect(choice.model).toBe('gpt-6.1-sol');
    expect(wrapper.get('[aria-label="Model"]').text()).not.toContain('Sonnet');
    await wrapper.get('[aria-label="Reasoning effort"]').setValue('xhigh');
    expect(choice.effort).toBe('xhigh');
  } finally { wrapper.unmount(); }
});

it('saves workflow model and effort explicitly without calling the provider', async () => {
  const f = await workflowUiFixture();
  const binding: { model?: WorkflowEditorModel } = {};
  const Probe = defineComponent({ setup() { binding.model = useWorkflowEditor(); return () => h(WorkflowAiStepFields); } });
  const wrapper = mount(Probe, { global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
  try {
    const model = binding.model!;
    const step = model.selected;
    if (step?.kind !== 'ai') throw new Error('Expected an AI step');
    const writes = f.storage.saves;
    await wrapper.get('[aria-label="AI provider"]').setValue('claude');
    await wrapper.get('[aria-label="AI model"]').setValue('claude-opus-4-6');
    await wrapper.get('[aria-label="Reasoning effort"]').setValue('max');
    expect(f.storage.saves).toBe(writes);
    model.save(); await flushPromises();
    expect(f.studio.state().settings.workflow?.steps.find(item => item.id === step.id)).toMatchObject({ model: 'claude-opus-4-6', effort: 'max' });
    expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});

it('saves a CoWorker model and effort and keeps the draft after a failed save', async () => {
  let snapshot: CouncilCatalogueSnapshot = { valid: [], invalid: [] };
  let fail = false;
  const catalogue = new CouncilCatalogue({ scan: async () => structuredClone(snapshot), open: async () => {}, save: async definition => {
    if (fail) throw new Error('Save failed');
    snapshot = { valid: [{ definition: structuredClone(definition), path: 'agent.md', revision: definitionRevision(definition) }], invalid: [] };
  } });
  const wrapper = mount(CoWorkerInventory, { props: { catalogue }, global: { plugins: [createPinia()], stubs: { CfIcon: true } } });
  try {
    await flushPromises();
    await wrapper.findAll('button').find(item => item.text().trim() === 'Create CoWorker')!.trigger('click');
    await wrapper.get('[aria-label="Provider"]').setValue('claude');
    await wrapper.get('[aria-label="Model"]').setValue('sonnet');
    await wrapper.get('[aria-label="Reasoning effort"]').setValue('high');
    expect(snapshot.valid).toHaveLength(0);
    await wrapper.get('form').trigger('submit'); await flushPromises();
    expect(snapshot.valid[0]?.definition).toMatchObject({ provider: 'claude', model: 'sonnet', effort: 'high' });
    fail = true;
    await wrapper.get('[aria-label="Reasoning effort"]').setValue('max');
    await wrapper.get('form').trigger('submit'); await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('Save failed');
    expect(wrapper.get('[aria-label="Reasoning effort"]').element).toHaveProperty('value', 'max');
    expect(snapshot.valid[0]?.definition).toMatchObject({ effort: 'high' });
  } finally { wrapper.unmount(); }
});
