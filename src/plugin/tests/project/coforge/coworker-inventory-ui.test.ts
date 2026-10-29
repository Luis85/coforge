// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { expect, it } from 'vitest';
import CoWorkerInventory from '../../../presentation/components/coforge/CoWorkerInventory.vue';
import { CouncilCatalogue, type CouncilCatalogueSnapshot } from '../../../features/coforge/application/council-catalogue';
import { definitionRevision } from '../../../features/coforge/domain/council-definitions';

it('creates, edits, finds and disables a CoWorker without admitting work; failed saves keep the draft', async () => {
  let snapshot: CouncilCatalogueSnapshot = { valid: [], invalid: [] };
  let fail = false;
  const catalogue = new CouncilCatalogue({ scan: async () => structuredClone(snapshot), open: async () => {}, save: async definition => {
    if (fail) throw new Error('Save failed');
    snapshot = { valid: [...snapshot.valid.filter(item => item.definition.id !== definition.id), { definition: structuredClone(definition), path: `${definition.id}.md`, revision: definitionRevision(definition) }], invalid: [] };
  } });
  const wrapper = mount(CoWorkerInventory, { props: { catalogue }, global: { plugins: [createPinia()], stubs: { CfIcon: true } } });
  const click = async (label: string) => { const button = wrapper.findAll('button').find(item => item.text().trim() === label); if (!button) throw new Error(`Missing ${label}`); await button.trigger('click'); await flushPromises(); };
  try {
    await flushPromises(); await click('Create CoWorker');
    await wrapper.get('[aria-label="Definition name"]').setValue('Boundary reviewer');
    await wrapper.get('[aria-label="CoWorker instructions"]').setValue('Identify missing boundaries.');
    await wrapper.get('input[maxlength="500"]').setValue('Architecture review');
    await wrapper.findAll('input[type="checkbox"]')[0]?.setValue(true);
    await wrapper.get('form').trigger('submit'); await flushPromises();
    expect(snapshot.valid).toHaveLength(1);
    const id = snapshot.valid[0]?.definition.id;
    expect(snapshot.valid[0]?.definition.schema).toBe('agent/v1');
    expect(wrapper.text()).toContain('CoForge MCP only');
    expect(wrapper.find('[aria-label="Saved CoWorkers"]').text()).toContain('Boundary reviewer');
    fail = true; await wrapper.get('[aria-label="Definition name"]').setValue('Retained draft');
    await wrapper.get('form').trigger('submit'); await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('Save failed');
    expect(wrapper.get('[aria-label="Definition name"]').element).toHaveProperty('value', 'Retained draft');
    expect(snapshot.valid[0]?.definition.id).toBe(id);
    expect(snapshot.valid[0]?.definition.name).toBe('Boundary reviewer');
    await click('Discard draft');
    expect(wrapper.get('[aria-label="Definition name"]').element).toHaveProperty('value', 'Boundary reviewer');
    fail = false; await click('Archive CoWorker');
    expect(snapshot.valid[0]?.definition).toMatchObject({ id, enabled: false });
    await wrapper.get('.cf-coworker-toolbar select').setValue('available');
    expect(wrapper.findAll('.cf-coworker-card')).toHaveLength(0);
    expect(wrapper.text()).toContain('No matching CoWorkers');
  } finally { wrapper.unmount(); }
});
