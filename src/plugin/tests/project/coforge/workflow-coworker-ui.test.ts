// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import WorkflowEditorView from '../../../presentation/components/coforge/WorkflowEditorView.vue';
import { coforgeKey } from '../../../presentation/context/coforge-context';
import { councilAskFixture } from './council-ask-fixture';

it('assigns an enabled saved CoWorker over an invalid manual draft, saves explicitly and allows manual customization', async () => {
  const f = await councilAskFixture();
  f.wrapper.unmount();
  const catalogue = await f.module.actions.catalogue.list();
  const entry = catalogue.valid.find(item => item.definition.id === 'agent');
  if (!entry || entry.definition.schema !== 'agent/v1') throw new Error('Missing CoWorker fixture');
  await f.module.actions.catalogue.save({ ...entry.definition, provider: 'claude', model: 'sonnet', effort: 'high', role: 'Compatibility reviewer', instructions: 'Preserve supported saved files.' }, entry.revision);
  const wrapper = mount(WorkflowEditorView, { global: { plugins: [f.pinia], provide: { [coforgeKey as symbol]: f.context }, directives: { 'cf-icon': () => {} } } });
  try {
    await flushPromises();
    const originalInstructions = wrapper.get('[data-workflow-field="instructions"]').element;
    await wrapper.get('[aria-label="AI provider"]').setValue('claude');
    await wrapper.get('[aria-label="AI model"]').setValue('__custom');
    await wrapper.get('[aria-label="Custom model ID"]').setValue('--invalid');
    expect(wrapper.findAll('button').find(button => button.text().trim() === 'Save workflow')!.attributes('disabled')).toBeDefined();
    await wrapper.get('[aria-label="Step agent configuration"]').setValue('coworker');
    await wrapper.get('[aria-label="Assigned CoWorker"]').setValue('agent');
    expect(wrapper.find('[aria-label="AI provider"]').exists()).toBe(false);
    expect(wrapper.text()).toContain(entry.definition.name);
    expect(wrapper.get('[data-workflow-field="instructions"]').element).toBe(originalInstructions);
    expect(f.studio.state().settings.workflow).toBeUndefined();
    await wrapper.get('form.cf-workflow-editor').trigger('submit'); await flushPromises();
    expect(f.studio.state().settings.workflow?.steps[0]).toMatchObject({ coworkerId: 'agent', provider: 'claude', model: 'sonnet', effort: 'high', access: 'none' });
    const fresh = (await f.module.actions.catalogue.list()).valid.find(item => item.definition.id === 'agent');
    if (!fresh || fresh.definition.schema !== 'agent/v1') throw new Error('Missing fresh CoWorker');
    await f.module.actions.catalogue.save({ ...fresh.definition, model: 'opus', effort: 'medium' }, fresh.revision);
    await wrapper.findAll('button').find(button => button.text().trim() === 'Refresh saved CoWorkers')!.trigger('click');
    await flushPromises();
    await wrapper.get('[aria-label="Step agent configuration"]').setValue('manual');
    expect(wrapper.get('[aria-label="AI provider"]').element).toHaveProperty('value', 'claude');
    expect(wrapper.get('[aria-label="AI model"]').element).toHaveProperty('value', 'opus');
    expect(wrapper.get('[aria-label="Reasoning effort"]').element).toHaveProperty('value', 'medium');
    await wrapper.get('[aria-label="AI model"]').setValue('haiku');
    await wrapper.get('form.cf-workflow-editor').trigger('submit'); await flushPromises();
    expect(f.studio.state().settings.workflow?.steps[0]).not.toHaveProperty('coworkerId');
    expect(f.studio.state().settings.workflow?.steps[0]).toMatchObject({ model: 'haiku', effort: 'medium' });
    expect(f.module.actions.snapshot().runs).toHaveLength(0);
  } finally { wrapper.unmount(); await f.dispose(false); }
});

it('keeps an unavailable saved assignment visible for repair and allows returning to manual configuration', async () => {
  const f = await councilAskFixture(); f.wrapper.unmount();
  const wrapper = mount(WorkflowEditorView, { global: { plugins: [f.pinia], provide: { [coforgeKey as symbol]: f.context }, directives: { 'cf-icon': () => {} } } });
  try {
    await flushPromises();
    await wrapper.get('[aria-label="Step agent configuration"]').setValue('coworker');
    await wrapper.get('[aria-label="Assigned CoWorker"]').setValue('agent');
    const catalogue = await f.module.actions.catalogue.list();
    const entry = catalogue.valid.find(item => item.definition.id === 'agent');
    if (!entry || entry.definition.schema !== 'agent/v1') throw new Error('Missing saved CoWorker');
    await f.module.actions.catalogue.save({ ...entry.definition, enabled: false }, entry.revision);
    await wrapper.findAll('button').find(button => button.text().trim() === 'Refresh saved CoWorkers')!.trigger('click');
    await flushPromises();
    expect(wrapper.get('[aria-label="Assigned CoWorker"]').element).toHaveProperty('value', 'agent');
    expect(wrapper.text()).toContain('missing or disabled');
    await wrapper.get('[aria-label="Step agent configuration"]').setValue('manual');
    expect(wrapper.find('[aria-label="AI provider"]').exists()).toBe(true);
    expect(f.module.actions.snapshot().runs).toHaveLength(0);
  } finally { wrapper.unmount(); await f.dispose(false); }
});
