// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { expect, it } from 'vitest';
import SettingsView from '../../../presentation/components/coforge/SettingsView.vue';
import ProjectsView from '../../../presentation/components/coforge/ProjectsView.vue';
import { workflowUiFixture } from './workflow-ui-fixture';

it('creates a private owner project through the explicit visibility field', async () => {
  const fixture = await workflowUiFixture();
  const wrapper = mount(ProjectsView, { global: { plugins: [fixture.pinia, fixture.provider], stubs: { CfIcon: true } } });
  try {
    await wrapper.findAll('button').find(button => button.text() === 'Add project')?.trigger('click');
    const form = wrapper.get('form');
    await form.findAll('input')[0]!.setValue('Private owner game');
    await form.get('select').setValue('private');
    await form.findAll('input')[1]!.setValue('/synthetic/private-owner');
    await form.get('textarea').setValue('Owner-only work must not appear in viewer discovery.');
    await form.trigger('submit'); await flushPromises();
    expect(fixture.studio.state().projects?.at(-1)?.visibility).toBe('private');
    expect(wrapper.text()).toContain('Private');
    expect(fixture.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await fixture.dispose(); }
});
it('retains the private visibility draft after failure and surfaces a fail-closed publication hold', async () => {
  const fixture = await workflowUiFixture();
  const wrapper = mount(SettingsView, { global: { plugins: [fixture.pinia, fixture.provider], stubs: { CfIcon: true } } });
  try {
    const visibility = wrapper.findAll('label').find(label => label.find('span').exists() && label.find('span').text() === 'Project visibility');
    if (!visibility) throw new Error('Missing project visibility');
    await visibility.get('select').setValue('private');
    fixture.storage.failNextSave = true;
    await wrapper.get('form.cf-settings-form').trigger('submit'); await flushPromises();
    expect(visibility.get('select').element).toHaveProperty('value', 'private');
    expect(fixture.studio.state().projects?.[0]?.visibility ?? 'public').toBe('public');
    expect(wrapper.text()).toContain('Publication is blocked');
    expect(wrapper.text()).toContain('Disk full');
    expect(fixture.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await fixture.dispose(); }
});

it('allows only the visibility field to save during active work and keeps mixed configuration changes blocked', async () => {
  const fixture = await workflowUiFixture();
  await fixture.studio.store.transaction(state => { state.jobs.push({ id: 'active-job', ideaId: 'CF-101', projectId: fixture.project.id, stage: 'plan', provider: 'demo', status: 'running', startedAt: new Date().toISOString(), logs: [] }); });
  const wrapper = mount(SettingsView, { global: { plugins: [fixture.pinia, fixture.provider], stubs: { CfIcon: true } } });
  try {
    const visibility = wrapper.get('select[aria-label="Project visibility"]');
    const save = wrapper.findAll('button').find(button => button.text().trim() === 'Save settings');
    if (!save) throw new Error('Missing save action');
    await visibility.setValue('private'); await flushPromises();
    expect(save.attributes('disabled')).toBeUndefined();
    const brief = wrapper.findAll('label').find(label => label.find('span').exists() && label.find('span').text() === 'Description');
    if (!brief) throw new Error('Missing project brief');
    const edited = 'A configuration change must still wait for active work.';
    await brief.get('textarea').setValue(edited); await flushPromises();
    expect(save.attributes('disabled')).toBeDefined();
    await expect(fixture.studio.updateProject({ visibility: 'private', projectBrief: edited }, fixture.project.id)).rejects.toThrow('queued runs');
    await brief.get('textarea').setValue(fixture.project.settings.projectBrief); await flushPromises();
    expect(save.attributes('disabled')).toBeUndefined();
    const jobs = fixture.studio.state().jobs;
    await wrapper.get('form.cf-settings-form').trigger('submit'); await flushPromises();
    expect(fixture.studio.state().projects?.[0]?.visibility).toBe('private');
    expect(fixture.studio.state().jobs).toEqual(jobs);
    expect(fixture.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await fixture.dispose(); }
});
