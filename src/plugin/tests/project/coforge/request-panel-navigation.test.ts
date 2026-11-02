// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { expect, it } from 'vitest';
import { createSeed } from '../../../features/coforge/domain/seed';
import IdeaDrawer from '../../../presentation/components/coforge/IdeaDrawer.vue';
import { workflowUiFixture } from './workflow-ui-fixture';

it('preserves an unsaved RICE estimate across every detail section without starting work', async () => {
  const f = await workflowUiFixture();
  const seeded = createSeed().ideas.find(idea => idea.rice && idea.screening?.verdict === 'clear');
  if (!seeded) throw new Error('Missing scored seed request');
  const idea = { ...seeded, projectId: f.project.id, status: 'ranked' as const, workflowRun: undefined };
  f.store.state!.ideas = [idea]; f.store.state!.jobs = [];
  f.store.select(idea.id, 'overview');
  const wrapper = mount(IdeaDrawer, { global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
  try {
    const adjust = wrapper.findAll('button').find(button => button.text().trim() === 'Adjust score');
    if (!adjust) throw new Error('Missing score editor');
    await adjust.trigger('click');
    await wrapper.get('.cf-idea-rice-form input[type="number"]').setValue(4321);
    await wrapper.get('.cf-idea-rice-form textarea').setValue('Keep this unsaved reasoning while inspecting the request.');
    for (const label of ['Workflow runs', 'Plan & Design', 'Increment', 'Sessions', 'AI costs', 'Activity', 'Overview']) {
      await wrapper.get(`nav[aria-label="Idea sections"] button[aria-label="${label}"]`).trigger('click');
      await flushPromises();
      expect(wrapper.get('.cf-idea-pane-intro h3').text()).toBe(label);
    }
    expect(wrapper.get('.cf-idea-rice-form input[type="number"]').element).toHaveProperty('value', '4321');
    expect(wrapper.get('.cf-idea-rice-form textarea').element).toHaveProperty('value', 'Keep this unsaved reasoning while inspecting the request.');
    expect(f.store.selectedIdea?.rice?.reach).toBe(seeded.rice?.reach);
    expect(f.runner).not.toHaveBeenCalled();
    expect(f.store.state!.jobs).toHaveLength(0);
  } finally { wrapper.unmount(); await f.dispose(); }
});

it('explains an invalid review note beside the decision without writing or dispatching', async () => {
  const f = await workflowUiFixture();
  const seeded = createSeed().ideas.find(idea => idea.status === 'review' && idea.increment);
  if (!seeded) throw new Error('Missing review seed request');
  f.store.state!.ideas = [{ ...seeded, projectId: f.project.id, workflowRun: undefined }];
  f.store.select(seeded.id, 'increment');
  const wrapper = mount(IdeaDrawer, { global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
  const writes = f.storage.saves;
  try {
    const footer = wrapper.get('.cf-idea-footer');
    const changes = footer.findAll('button').find(button => button.text() === 'Request changes');
    if (!changes) throw new Error('Missing changes action');
    await changes.trigger('click');
    const error = footer.get('[role="alert"]');
    expect(error.text()).toContain('at least 3 characters');
    expect(footer.get('textarea').attributes('aria-invalid')).toBe('true');
    expect(footer.get('textarea').attributes('aria-describedby')).toBe(error.attributes('id'));
    expect(wrapper.findAll('[role="alert"]')).toHaveLength(1);
    expect(f.storage.saves).toBe(writes);
    expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});
