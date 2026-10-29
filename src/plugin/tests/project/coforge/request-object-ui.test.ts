// @vitest-environment happy-dom
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { expect, it } from 'vitest';
import SettingsView from '../../../presentation/components/coforge/SettingsView.vue';
import NewIdeaDrawer from '../../../presentation/components/coforge/NewIdeaDrawer.vue';
import { workflowUiFixture } from './workflow-ui-fixture';
import { REQUEST_OBJECT_FORMAT } from '../../../features/coforge/domain/request-object';
import { workflowDefinition } from '../../../features/coforge/domain/configured-workflow';

const button = (wrapper: VueWrapper, label: string) => {
  const result = wrapper.findAll('button').find(item => item.text().trim() === label);
  if (!result) throw new Error(`Missing request-object action: ${label}`);
  return result;
};
const field = (wrapper: VueWrapper, label: string) => {
  const result = wrapper.findAll('label').find(item => item.find('span').exists() && item.find('span').text() === label);
  if (!result) throw new Error(`Missing request-object field: ${label}`);
  return result.find('input,textarea,select');
};
const definition = { format: REQUEST_OBJECT_FORMAT, className: 'Business Idea', fields: [{ key: 'audience', label: 'Audience', type: 'text' as const }, { key: 'investment', label: 'Investment', type: 'number' as const, defaultValue: 0 }] };

it('saves a project-specific class/schema and keeps invalid field drafts separate from canonical settings', async () => {
  const fixture = await workflowUiFixture();
  const workflow = workflowDefinition(fixture.studio.state().settings);
  await fixture.studio.saveWorkflow(fixture.project.id, workflow, JSON.stringify(workflow));
  const wrapper = mount(SettingsView, { global: { plugins: [fixture.pinia, fixture.provider], directives: { 'cf-icon': () => {} } } });
  try {
    await flushPromises();
    fixture.store.openSettingsTool('requests'); await flushPromises();
    await field(wrapper, 'Request note class').setValue('Business Idea');
    await field(wrapper, 'Request categories').setValue('Strategy\nCommercial');
    await button(wrapper, 'Add request field').trigger('click');
    await field(wrapper, 'Field 1 label').setValue('Investment');
    await field(wrapper, 'Field 1 property key').setValue('investment');
    await field(wrapper, 'Field 1 type').setValue('number');
    await field(wrapper, 'Field 1 default value').setValue('0');
    expect(fixture.studio.state().settings.requestObject).toBeUndefined();
    await wrapper.get('form.cf-settings-form').trigger('submit'); await flushPromises();
    expect(fixture.studio.state().settings.requestObject).toMatchObject({ className: 'Business Idea', categories: ['Strategy', 'Commercial'], fields: [{ key: 'investment', type: 'number', defaultValue: 0 }] });
    await button(wrapper, 'Add request field').trigger('click');
    await field(wrapper, 'Field 2 label').setValue('Reserved');
    await field(wrapper, 'Field 2 property key').setValue('status');
    await wrapper.get('form.cf-settings-form').trigger('submit'); await flushPromises();
    expect(wrapper.get('.cf-settings-alert[role="alert"]').text()).toContain('cannot replace');
    expect(fixture.studio.state().settings.requestObject?.fields).toHaveLength(1);
    expect(field(wrapper, 'Field 2 property key').element).toHaveProperty('value', 'status');
    await button(wrapper, 'Discard changes').trigger('click'); await flushPromises();
    expect(wrapper.findAll('.cf-request-schema-list > li')).toHaveLength(1);
    await field(wrapper, 'Request categories').setValue('Strategy\nstrategy');
    await wrapper.get('form.cf-settings-form').trigger('submit'); await flushPromises();
    expect(wrapper.get('.cf-settings-alert[role="alert"]').text()).toContain('unique');
    expect(field(wrapper, 'Request categories').element).toHaveProperty('value', 'Strategy\nstrategy');
    expect(fixture.studio.state().settings.requestObject?.categories).toEqual(['Strategy', 'Commercial']);
  } finally { wrapper.unmount(); await fixture.dispose(); }
});

it('creates a new request with the captured class and typed custom values including zero', async () => {
  const fixture = await workflowUiFixture();
  await fixture.studio.updateProject({ requestObject: definition }, fixture.project.id);
  const wrapper = mount(NewIdeaDrawer, { global: { plugins: [fixture.pinia, fixture.provider], directives: { 'cf-icon': () => {} } } });
  try {
    await flushPromises();
    expect(wrapper.text()).toContain('Business Idea');
    await wrapper.get('[aria-label="The idea"]').setValue('A new business opportunity');
    await field(wrapper, 'Audience').setValue('Local makers');
    await field(wrapper, 'Investment').setValue('0');
    await wrapper.get('form').trigger('submit'); await flushPromises();
    expect(fixture.studio.state().ideas.at(-1)).toMatchObject({ title: 'A new business opportunity', requestObject: { className: 'Business Idea', values: { audience: 'Local makers', investment: 0 } } });
  } finally { wrapper.unmount(); await fixture.dispose(); }
});

it('keeps an authored request draft when its project schema changes before submission', async () => {
  const fixture = await workflowUiFixture();
  await fixture.studio.updateProject({ requestObject: definition }, fixture.project.id);
  const wrapper = mount(NewIdeaDrawer, { global: { plugins: [fixture.pinia, fixture.provider], directives: { 'cf-icon': () => {} } } });
  try {
    await flushPromises();
    await wrapper.get('[aria-label="The idea"]').setValue('A protected business opportunity');
    await field(wrapper, 'Audience').setValue('Keep this audience draft');
    await fixture.studio.updateProject({ requestObject: { ...definition, className: 'Feature Idea', fields: [] } }, fixture.project.id);
    await flushPromises();
    await wrapper.get('form').trigger('submit'); await flushPromises();
    expect(fixture.studio.state().ideas).toHaveLength(0);
    expect(wrapper.get('[aria-label="The idea"]').element).toHaveProperty('value', 'A protected business opportunity');
    expect(field(wrapper, 'Audience').element).toHaveProperty('value', 'Keep this audience draft');
    expect(wrapper.get('[role="alert"]').text()).toMatch(/changed|schema/i);
  } finally { wrapper.unmount(); await fixture.dispose(); }
});
