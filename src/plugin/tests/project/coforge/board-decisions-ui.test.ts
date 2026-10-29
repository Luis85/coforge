// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { expect, it } from 'vitest';
import IdeaBoard from '../../../presentation/components/coforge/IdeaBoard.vue';
import StudioSidebar from '../../../presentation/components/coforge/StudioSidebar.vue';
import { createSeed } from '../../../features/coforge/domain/seed';
import { workflowUiFixture } from './workflow-ui-fixture';

it('shows the board filters without a decision summary and keeps review and moderation available', async () => {
  const fixture = await workflowUiFixture();
  const sample = createSeed();
  if (!fixture.store.state) throw new Error('Missing studio state');
  fixture.store.state.ideas = sample.ideas.map(idea => ({ ...idea, projectId: fixture.project.id }));
  fixture.store.state.contributors = sample.contributors;
  const wrapper = mount(IdeaBoard, { global: { plugins: [fixture.pinia, fixture.provider], stubs: { CfIcon: true } } });
  try {
    expect(wrapper.find('.cf-board-decisions').exists()).toBe(false);
    expect(wrapper.find('[aria-label="Project request decisions"]').exists()).toBe(false);
    expect(wrapper.get('.cf-board-page').element.children[1]).toBe(wrapper.get('.cf-board-tabs').element);
    await wrapper.get('[aria-label="Search ideas"]').setValue('No request can match this phrase');
    expect(wrapper.findAll('.cf-idea-card')).toHaveLength(0);
    const writes = fixture.storage.saves;
    await wrapper.get('[aria-label="Clear search"]').trigger('click');
    await wrapper.findAll('.cf-board-tabs button')[1]?.trigger('click');
    const selected = wrapper.get('.cf-board-tabs button.is-active');
    expect(selected.text()).toContain('Needs review');
    expect(wrapper.get('[aria-label="Search ideas"]').element).toHaveProperty('value', '');
    expect(wrapper.findAll('.cf-idea-card')).toHaveLength(2);
    await wrapper.findAll('.cf-board-tabs button')[2]?.trigger('click');
    expect(wrapper.get('.cf-board-tabs button.is-active').text()).toContain('Flagged');
    expect(wrapper.findAll('.cf-idea-card')).toHaveLength(1);
    expect(fixture.storage.saves).toBe(writes);
    expect(fixture.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await fixture.dispose(); }
});

it('keeps a dirty configuration and its destination when changing project from the switcher', async () => {
  const fixture = await workflowUiFixture();
  fixture.store.view = 'workflow-settings';
  fixture.store.dirtyWorkflow = true;
  const wrapper = mount(StudioSidebar, { global: { plugins: [fixture.pinia, fixture.provider], stubs: { CfIcon: true } } });
  try {
    expect(wrapper.text()).toContain(fixture.project.id);
    await wrapper.get('.cf-project-switcher').trigger('click');
    expect(fixture.store.view).toBe('workflow-settings');
    expect(fixture.store.dirtyWorkflow).toBe(true);
    expect(fixture.store.toasts.at(-1)?.message).toContain('workflow settings');
  } finally { wrapper.unmount(); await fixture.dispose(); }
});
