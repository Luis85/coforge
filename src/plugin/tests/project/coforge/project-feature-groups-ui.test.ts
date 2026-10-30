// @vitest-environment happy-dom
import { mount, flushPromises } from '@vue/test-utils';
import { nextTick } from 'vue';
import { expect, it } from 'vitest';
import StudioApp from '../../../presentation/components/coforge/StudioApp.vue';
import { workflowUiFixture } from './workflow-ui-fixture';

it('saves feature choices explicitly and hides Stream navigation and panels without losing chat drafts', async () => {
  const fixture = await workflowUiFixture();
  fixture.store.navigate('settings');
  const wrapper = mount(StudioApp, { global: { plugins: [fixture.pinia, fixture.provider], stubs: { CfIcon: true, ObsLiveDock: true, ChatPanel: true, IdeaBoard: true, PipelineStrip: true } } });
  try {
    fixture.store.chatDraft.text = 'Keep this chat draft';
    const checkbox = wrapper.get('input[aria-label="Show Stream features"]');
    await checkbox.setValue(false);
    expect(wrapper.find('button[title="Stream studio"]').exists()).toBe(true);
    fixture.storage.failNextSave = true;
    await wrapper.get('form.cf-settings-form').trigger('submit'); await flushPromises();
    expect(wrapper.get('input[aria-label="Show Stream features"]').element).toHaveProperty('checked', false);
    expect(wrapper.find('button[title="Stream studio"]').exists()).toBe(true);
    await wrapper.get('form.cf-settings-form').trigger('submit'); await flushPromises();
    expect(wrapper.find('button[title="Stream studio"]').exists()).toBe(false);
    expect(wrapper.find('.cf-streamer-profile').exists()).toBe(false);
    fixture.store.navigate('board'); await nextTick();
    expect(wrapper.find('chat-panel-stub').exists()).toBe(false);
    expect(wrapper.find('obs-live-dock-stub').exists()).toBe(false);
    expect(wrapper.find('button[aria-label="Expand chat panel"]').exists()).toBe(false);
    expect(wrapper.find('button[aria-label="Collapse chat panel"]').exists()).toBe(false);
    expect(wrapper.classes()).not.toContain('is-chat-expanded');
    expect(fixture.store.chatDraft.text).toBe('Keep this chat draft');
    expect(fixture.runner).not.toHaveBeenCalled();
    fixture.store.navigate('settings'); await nextTick();
    await wrapper.get('input[aria-label="Show Stream features"]').setValue(true);
    await wrapper.get('form.cf-settings-form').trigger('submit'); await flushPromises();
    fixture.store.navigate('board'); await nextTick();
    expect(wrapper.find('chat-panel-stub').exists()).toBe(true);
  } finally { wrapper.unmount(); await fixture.dispose(); }
});

it('restores project choices on switch and keeps settings reachable with every group hidden', async () => {
  const fixture = await workflowUiFixture();
  const other = await fixture.studio.createProject({ projectName: 'Minimal project', projectBrief: 'Workspace with no visible groups.', projectPath: '/synthetic/minimal' });
  const wrapper = mount(StudioApp, { global: { plugins: [fixture.pinia, fixture.provider], stubs: { CfIcon: true, BroadcastView: true, IdeaBoard: true, PipelineStrip: true, ChatPanel: true, ObsLiveDock: true } } });
  try {
    await fixture.studio.updateProject({ featureGroups: [] }, other.id); await nextTick();
    expect(wrapper.find('.cf-nav-group').exists()).toBe(false);
    expect(fixture.store.view).toBe('settings');
    expect(fixture.store.navigate('broadcast')).toBe(true);
    expect(fixture.store.view).toBe('settings');
    expect(wrapper.find('button[title="Project settings"]').exists()).toBe(true);
    expect(wrapper.find('button[title="Manage projects"]').exists()).toBe(true);
    await fixture.studio.selectProject(fixture.project.id); await nextTick();
    expect(wrapper.find('button[title="Stream studio"]').exists()).toBe(true);
    fixture.store.navigate('broadcast');
    await wrapper.get('button[title="Manage projects"]').trigger('click');
    await wrapper.get('button[aria-label="Open project for Minimal project"]').trigger('click'); await flushPromises();
    expect(fixture.store.view).toBe('settings');
    fixture.store.dirtySettings = true;
    expect(fixture.store.navigate('projects')).toBe(false);
  } finally { wrapper.unmount(); await fixture.dispose(); }
});
