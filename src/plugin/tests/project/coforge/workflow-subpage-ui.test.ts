// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { expect, it } from 'vitest';
import StudioApp from '../../../presentation/components/coforge/StudioApp.vue';
import { workflowUiFixture } from './workflow-ui-fixture';

it('owns Agent workflow inside bottom project settings and guards a dirty local draft without dispatch', async () => {
  const fixture = await workflowUiFixture();
  const wrapper = mount(StudioApp, { global: { plugins: [fixture.pinia, fixture.provider], directives: { 'cf-icon': () => {} } } });
  try {
    await flushPromises();
    const sidebar = wrapper.get('.cf-sidebar');
    expect(sidebar.findAll('button').filter(button => button.text().trim() === 'Workflow settings')).toHaveLength(0);
    expect(sidebar.findAll('button').filter(button => button.text().trim() === 'Agent workflow')).toHaveLength(0);
    const rootNavigation = sidebar.get('nav[aria-label="CoForge navigation"]');
    expect(rootNavigation.findAll('.cf-nav-item').at(-1)?.text().trim()).toBe('Project settings');
    await sidebar.get('[title="Project settings"]').trigger('click');
    await flushPromises();
    const settingsPages = wrapper.get('nav[aria-label="Project settings pages"]');
    const workflowPage = settingsPages.findAll('button').find(button => button.get('strong').text() === 'Agent workflow');
    if (!workflowPage) throw new Error('Missing Agent workflow settings subpage');
    await workflowPage.trigger('click'); await flushPromises();
    const writes = fixture.storage.saves;
    const local = wrapper.get('nav[aria-label="Agent workflow pages"]');
    const select = async (label: string) => {
      const button = local.findAll('button').find(button => button.text().trim() === label);
      if (!button) throw new Error(`Missing workflow subpage ${label}`);
      await button.trigger('click'); await flushPromises();
    };
    await select('Workflow settings');
    expect(fixture.store.view).toBe('workflow-settings');
    expect(wrapper.findAll('h1').map(heading => heading.text())).toEqual(['Project settings']);
    expect(wrapper.get('.cf-workflow-settings-page h2').text()).toBe('Workflow settings');
    expect(sidebar.get('[title="Project settings"]').attributes('aria-current')).toBe('page');
    const name = wrapper.get('.cf-workflow-editor > fieldset > .cf-field input');
    await name.setValue('A protected local workflow draft'); await flushPromises();
    expect(fixture.store.dirtyWorkflow).toBe(true);
    const general = settingsPages.findAll('button').find(button => button.get('strong').text() === 'General');
    if (!general) throw new Error('Missing General settings subpage');
    await general.trigger('click'); await flushPromises();
    expect(workflowPage.attributes('aria-current')).toBe('page');
    expect(name.element).toHaveProperty('value', 'A protected local workflow draft');
    await select('Workflow runs');
    expect(fixture.store.view).toBe('workflow-settings');
    expect(name.element).toHaveProperty('value', 'A protected local workflow draft');
    await select('Herdr workspaces');
    expect(fixture.store.view).toBe('workflow-settings');
    const discard = wrapper.findAll('button').find(button => button.text().trim() === 'Discard workflow changes');
    if (!discard) throw new Error('Missing discard action');
    await discard.trigger('click'); await flushPromises();
    await select('Workflow runs');
    expect(fixture.store.view).toBe('workflow');
    expect(fixture.store.dirtyWorkflow).toBe(false);
    expect(wrapper.get('[aria-label="Request workflow runs"]').isVisible()).toBe(true);
    expect(local.get('[aria-current="page"]').text()).toBe('Workflow runs');
    expect(fixture.storage.saves).toBe(writes);
    expect(fixture.studio.state().jobs).toEqual([]);
    expect(fixture.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await fixture.dispose(); }
});

it('keeps the local configuration prerequisite reachable before a project exists', async () => {
  const fixture = await workflowUiFixture();
  await fixture.studio.store.transaction(state => { state.projects = []; state.activeProjectId = ''; });
  const wrapper = mount(StudioApp, { global: { plugins: [fixture.pinia, fixture.provider], directives: { 'cf-icon': () => {} } } });
  try {
    await flushPromises();
    const writes = fixture.storage.saves;
    const parent = wrapper.get('.cf-sidebar [title="Project settings"]');
    expect(parent.attributes('disabled')).toBeUndefined();
    await parent.trigger('click'); await flushPromises();
    expect(wrapper.text()).toContain('Choose a project');
    const workflow = wrapper.get('nav[aria-label="Project settings pages"]').findAll('button').find(button => button.get('strong').text() === 'Agent workflow');
    if (!workflow) throw new Error('Missing Agent workflow settings subpage');
    await workflow.trigger('click'); await flushPromises();
    expect(workflow.attributes('aria-current')).toBe('page');
    const settings = wrapper.get('nav[aria-label="Agent workflow pages"]').findAll('button').find(button => button.text().trim() === 'Workflow settings');
    if (!settings) throw new Error('Missing settings subpage');
    await settings.trigger('click'); await flushPromises();
    expect(wrapper.get('.cf-workflow-settings-page').text()).toContain('Choose a project');
    expect(wrapper.findAll('button').some(button => button.text().trim() === 'Resume automation')).toBe(false);
    expect(fixture.store.view).toBe('workflow-settings');
    expect(fixture.storage.saves).toBe(writes);
    expect(fixture.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await fixture.dispose(); }
});
