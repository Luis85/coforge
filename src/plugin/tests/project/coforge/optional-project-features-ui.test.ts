// @vitest-environment happy-dom
import { mount, flushPromises } from '@vue/test-utils';
import { nextTick, defineComponent, h } from 'vue';
import { expect, it } from 'vitest';
import StudioApp from '../../../presentation/components/coforge/StudioApp.vue';
import { workflowUiFixture } from './workflow-ui-fixture';
import { OPTIONAL_PROJECT_FEATURES } from './optional-project-features-fixture';
import { useIdeaCardMenu } from '../../../presentation/composables/coforge/use-idea-card-menu';
import CommunitySettingsView from '../../../presentation/components/coforge/CommunitySettingsView.vue';

const stubs = { CfIcon: true, ObsLiveDock: true, ChatPanel: true, IdeaBoard: true, PipelineStrip: true, WorkflowView: true };
it('renders Community settings and shows its Economy shortcut only when selected', async () => {
  const fixture = await workflowUiFixture();
  await fixture.studio.updateProject({ features: ['community-settings'] });
  const wrapper = mount(CommunitySettingsView, { global: { plugins: [fixture.pinia, fixture.provider], stubs: { CfIcon: true } } });
  try {
    expect(wrapper.text()).toContain('Community settings');
    expect(wrapper.text()).not.toContain('Open Economy');
    await fixture.studio.updateProject({ features: ['community-settings', 'economy'] }); await nextTick();
    expect(wrapper.text()).toContain('Open Economy');
  } finally { wrapper.unmount(); await fixture.dispose(); }
});
it('lists all 18 features and explicitly saves Service Design independently', async () => {
  const fixture = await workflowUiFixture(); fixture.store.navigate('settings');
  const wrapper = mount(StudioApp, { global: { plugins: [fixture.pinia, fixture.provider], stubs } });
  try {
    for (const [, label] of OPTIONAL_PROJECT_FEATURES) expect(wrapper.get(`input[aria-label="Show ${label}"]`).element).toHaveProperty('checked', true);
    await wrapper.get('input[aria-label="Show Service Design"]').setValue(false);
    expect(wrapper.find('button[title="Service Design"]').exists()).toBe(true);
    fixture.storage.failNextSave = true;
    await wrapper.get('form.cf-settings-form').trigger('submit'); await flushPromises();
    expect(wrapper.get('input[aria-label="Show Service Design"]').element).toHaveProperty('checked', false);
    expect(wrapper.find('button[title="Service Design"]').exists()).toBe(true);
    await wrapper.get('form.cf-settings-form').trigger('submit'); await flushPromises();
    expect(wrapper.find('button[title="Service Design"]').exists()).toBe(false);
    expect(wrapper.find('button[title="The Council"]').exists()).toBe(true);
    expect(wrapper.find('button[title="Idea board"]').exists()).toBe(true);
    await wrapper.get('input[aria-label="Show Build & Improve features"]').setValue(false);
    expect(wrapper.get('input[aria-label="Show Service Design"]').element.closest('fieldset')?.hasAttribute('disabled')).toBe(true);
    await wrapper.get('input[aria-label="Show Build & Improve features"]').setValue(true);
    expect(wrapper.get('input[aria-label="Show Service Design"]').element).toHaveProperty('checked', false);
    expect(fixture.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await fixture.dispose(); }
});

it('keeps a dirty workflow mounted when an external feature preference hides it', async () => {
  const fixture = await workflowUiFixture(); fixture.store.openWorkflowTool('settings');
  const wrapper = mount(StudioApp, { global: { plugins: [fixture.pinia, fixture.provider], stubs } });
  try {
    fixture.store.dirtyWorkflow = true;
    await fixture.studio.updateProject({ features: [] }); await nextTick();
    expect(fixture.store.view).toBe('workflow-settings');
    expect(fixture.store.settingsTool).toBe('workflow');
    expect(wrapper.find('workflow-view-stub').exists()).toBe(true);
    fixture.store.dirtyWorkflow = false; await nextTick();
    expect(fixture.store.view).toBe('settings');
    expect(fixture.store.settingsTool).toBe('general');
    expect(wrapper.find('input[aria-label="Show Service Design"]').exists()).toBe(true);
  } finally { wrapper.unmount(); await fixture.dispose(); }
});

it('hides Council and workflow launch shortcuts without removing the request itself', async () => {
  const fixture = await workflowUiFixture();
  await fixture.studio.createIdea({ title: 'Keep this manual request', description: 'An independently useful request board.', category: 'Gameplay', username: 'Owner' });
  await fixture.studio.updateProject({ features: ['board'] });
  const idea = fixture.studio.state().ideas[0]!;
  const Menu = defineComponent({ setup() {
    const menu = useIdeaCardMenu({ idea }, { voted: false, voteDisabled: false, vote() {} });
    return () => h('div', menu.items.flat().map(item => item.label).join(' | '));
  } });
  const wrapper = mount(Menu, { global: { plugins: [fixture.pinia, fixture.provider] } });
  try {
    expect(wrapper.text()).toContain(`Open ${idea.id}`);
    expect(wrapper.text()).not.toContain('Send to the Council');
    expect(wrapper.text()).not.toContain('Configured workflow');
    expect(fixture.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await fixture.dispose(); }
});

it('separates stream chat from live controls and recovers settings from a hidden workflow', async () => {
  const fixture = await workflowUiFixture();
  const wrapper = mount(StudioApp, { global: { plugins: [fixture.pinia, fixture.provider], stubs } });
  try {
    await fixture.studio.updateProject({ features: ['board', 'stream', 'workflow'] });
    fixture.store.navigate('board'); await nextTick();
    expect(wrapper.find('chat-panel-stub').exists()).toBe(true);
    expect(wrapper.find('obs-live-dock-stub').exists()).toBe(false);
    fixture.store.openWorkflowTool('settings'); await nextTick();
    await fixture.studio.updateProject({ features: ['board', 'broadcast'] }); await nextTick();
    expect(wrapper.find('chat-panel-stub').exists()).toBe(false);
    expect(wrapper.find('obs-live-dock-stub').exists()).toBe(true);
    fixture.store.navigate('settings'); await nextTick();
    expect(wrapper.find('input[aria-label="Show Service Design"]').exists()).toBe(true);
    expect(wrapper.find('.cf-settings-navigation button[aria-current="page"]').text()).toContain('General');
    expect(wrapper.find('.cf-settings-navigation').text()).not.toContain('Agent workflow');
    await fixture.studio.updateProject({ features: [] }); await nextTick();
    expect(wrapper.find('.cf-nav-group').exists()).toBe(false);
    expect(wrapper.find('button[title="Project settings"]').exists()).toBe(true);
    expect(wrapper.find('button[title="Manage projects"]').exists()).toBe(true);
    expect(fixture.store.view).toBe('settings');
  } finally { wrapper.unmount(); await fixture.dispose(); }
});
