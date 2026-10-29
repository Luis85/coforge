// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { expect, it } from 'vitest';
import StudioApp from '../../../presentation/components/coforge/StudioApp.vue';
import { workflowUiFixture } from './workflow-ui-fixture';

it('takes runtime setup links to the owning settings task while retaining project edits without writes', async () => {
  const fixture = await workflowUiFixture();
  const wrapper = mount(StudioApp, { global: { plugins: [fixture.pinia, fixture.provider], directives: { 'cf-icon': () => {} } } });
  try {
    await flushPromises(); fixture.store.navigate('settings'); await flushPromises();
    await wrapper.get('input[aria-label="Project name"]').setValue('Retain these setup edits');
    const writes = fixture.storage.saves;
    fixture.store.openSettingsTool('runtime'); await flushPromises();
    const repository = wrapper.findAll('button').find(button => button.text().trim() === 'Configure repository');
    if (!repository) throw new Error('Missing runtime repository setup action');
    await repository.trigger('click'); await flushPromises();
    expect(fixture.store.settingsTool).toBe('repository');
    expect(wrapper.get('input[aria-label="Project path"]').isVisible()).toBe(true);
    fixture.store.openSettingsTool('runtime'); await flushPromises();
    const herdr = wrapper.findAll('button').find(button => button.text().trim() === 'Manage Herdr workspaces');
    if (!herdr) throw new Error('Missing runtime Herdr setup action');
    await herdr.trigger('click'); await flushPromises();
    expect(fixture.store.settingsTool).toBe('workflow');
    expect(fixture.store.workflowTool).toBe('herdr');
    fixture.store.openSettingsTool('general'); await flushPromises();
    expect(wrapper.get('input[aria-label="Project name"]').element).toHaveProperty('value', 'Retain these setup edits');
    expect(fixture.storage.saves).toBe(writes);
    expect(fixture.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await fixture.dispose(); }
});

it('keeps a project draft across settings tasks and saves deliberately without dispatching work', async () => {
  const fixture = await workflowUiFixture();
  const wrapper = mount(StudioApp, { global: { plugins: [fixture.pinia, fixture.provider], directives: { 'cf-icon': () => {} } } });
  try {
    await flushPromises();
    fixture.store.navigate('settings');
    await flushPromises();
    const page = wrapper.get('.cf-settings-page');
    const select = async (label: string) => {
      const target = page.get('nav[aria-label="Project settings pages"]').findAll('button').find(button => button.get('strong').text() === label);
      if (!target) throw new Error(`Missing settings task ${label}`);
      await target.trigger('click');
      await flushPromises();
    };
    const writes = fixture.storage.saves;
    await page.get('input[aria-label="Project name"]').setValue('A retained project draft');
    await select('Repository');
    expect(page.find('input[aria-label="Project name"]').exists()).toBe(false);
    await page.get('input[aria-label="Project path"]').setValue('/synthetic/new-project');
    await select('Requests');
    expect(page.get('[aria-label="Project Request Object"]').isVisible()).toBe(true);
    expect(page.find('[aria-label="cf-settings-runtime"]').exists()).toBe(false);
    await select('General');
    expect(page.get('input[aria-label="Project name"]').element).toHaveProperty('value', 'A retained project draft');
    expect(page.get('.cf-settings-save').text()).toContain('Unsaved');
    expect(fixture.storage.saves).toBe(writes);
    await page.get('form').trigger('submit');
    await flushPromises();
    expect(fixture.studio.state().settings.projectName).toBe('A retained project draft');
    expect(fixture.studio.state().projects?.find(project => project.id === fixture.project.id)?.projectPath).toBe('/synthetic/new-project');
    expect(fixture.store.dirtySettings).toBe(false);
    expect(fixture.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await fixture.dispose(); }
});

it('keeps save failures visible across settings tasks and isolates data tools from ordinary configuration', async () => {
  const fixture = await workflowUiFixture();
  const wrapper = mount(StudioApp, { global: { plugins: [fixture.pinia, fixture.provider], directives: { 'cf-icon': () => {} } } });
  try {
    await flushPromises();
    fixture.store.navigate('settings');
    await flushPromises();
    const page = wrapper.get('.cf-settings-page');
    expect(page.find('.cf-settings-data').exists()).toBe(false);
    await page.get('input[aria-label="Project name"]').setValue('Keep me');
    await fixture.studio.updateProject({ projectBrief: 'An external update to the source configuration.' }, fixture.project.id);
    await flushPromises();
    fixture.store.openSettingsTool('repository');
    await flushPromises();
    expect(page.get('[role="alert"]').text()).toContain('changed outside');
    expect(page.get('.cf-settings-save').text()).toContain('Unsaved');
    const discard = page.findAll('button').find(button => button.text().trim() === 'Discard changes');
    if (!discard) throw new Error('Missing discard action');
    await discard.trigger('click');
    fixture.store.openSettingsTool('data');
    await flushPromises();
    expect(page.get('.cf-settings-data').text()).toContain('all projects');
    expect(page.find('.cf-project-config-fields').exists()).toBe(false);
    expect(fixture.store.dirtySettings).toBe(false);
    expect(fixture.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await fixture.dispose(); }
});

it('validates the complete draft when saving from another category and keeps the invalid field recoverable', async () => {
  const fixture = await workflowUiFixture();
  const wrapper = mount(StudioApp, { global: { plugins: [fixture.pinia, fixture.provider], directives: { 'cf-icon': () => {} } } });
  try {
    await flushPromises();
    fixture.store.navigate('settings');
    await flushPromises();
    const page = wrapper.get('.cf-settings-page');
    const writes = fixture.storage.saves;
    await page.get('input[aria-label="Project name"]').setValue('');
    fixture.store.openSettingsTool('repository');
    await flushPromises();
    await page.get('form').trigger('submit');
    await flushPromises();
    expect(page.get('[role="alert"]').text()).toContain('Add a project name');
    expect(page.get('[role="alert"]').text()).toContain('review General');
    expect(fixture.storage.saves).toBe(writes);
    fixture.store.openSettingsTool('general');
    await flushPromises();
    expect(page.get('input[aria-label="Project name"]').element).toHaveProperty('value', '');
    expect(fixture.store.dirtySettings).toBe(true);
    expect(fixture.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await fixture.dispose(); }
});

it('keeps sample setup reachable without a project and requires an explicit confirmation', async () => {
  const fixture = await workflowUiFixture();
  await fixture.studio.store.transaction(state => { state.projects = []; state.activeProjectId = ''; });
  const wrapper = mount(StudioApp, { global: { plugins: [fixture.pinia, fixture.provider], directives: { 'cf-icon': () => {} } } });
  try {
    await flushPromises();
    fixture.store.openSettingsTool('data');
    await flushPromises();
    const writes = fixture.storage.saves;
    const load = wrapper.get('.cf-settings-data').findAll('button').find(button => button.text().trim() === 'Load sample workspace');
    if (!load) throw new Error('Missing sample setup');
    expect(load.attributes('disabled')).toBeUndefined();
    await load.trigger('click');
    await flushPromises();
    expect(wrapper.get('.cf-settings-reset-confirm').text()).toContain('Load the illustrative sample workspace?');
    expect(fixture.storage.saves).toBe(writes);
    expect(fixture.studio.state().projects).toEqual([]);
    expect(fixture.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await fixture.dispose(); }
});
