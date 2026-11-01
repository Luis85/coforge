// @vitest-environment happy-dom
import { flushPromises, mount, type DOMWrapper } from '@vue/test-utils';
import { expect, it } from 'vitest';
import StudioApp from '../../../presentation/components/coforge/StudioApp.vue';
import { workflowUiFixture } from './workflow-ui-fixture';

function button(wrapper: Pick<DOMWrapper<Element>, 'findAll'>, text: string) {
  const target = wrapper.findAll('button').find(item => item.text().trim() === text);
  if (!target) throw new Error(`Missing button: ${text}`); return target;
}

it('confirms the named request, focuses Keep, preserves a failed deletion and removes only that card after retry', async () => {
  const f = await workflowUiFixture();
  await f.studio.createIdea({ title: 'Remove this board request', description: 'Explicit recoverable deletion.', category: 'Gameplay', username: 'Owner' });
  await f.studio.createIdea({ title: 'Keep this other board request', description: 'Another request must remain.', category: 'Gameplay', username: 'Owner' });
  const idea = f.studio.state().ideas[0]!; f.store.navigate('board'); f.store.select(idea.id);
  const wrapper = mount(StudioApp, { attachTo: document.body, global: { plugins: [f.pinia, f.provider], directives: { 'cf-icon': () => {} } } });
  try {
    await flushPromises();
    const trigger = wrapper.get(`button[aria-label="Delete request ${idea.id}"]`);
    if (!(trigger.element instanceof HTMLElement)) throw new Error('Missing request deletion trigger'); trigger.element.focus();
    await trigger.trigger('click'); await flushPromises();
    let dialog = wrapper.get('[role="alertdialog"][aria-label="Delete request"]');
    expect(dialog.text()).toContain(idea.id); expect(dialog.text()).toContain(idea.title); expect(dialog.text()).toContain('Obsidian deletion preference');
    expect(document.activeElement).toBe(button(dialog, 'Keep request').element);
    expect(wrapper.get('.cf-idea-drawer').isVisible()).toBe(false);
    await button(dialog, 'Keep request').trigger('click'); await flushPromises();
    expect(f.studio.state().ideas).toHaveLength(2); expect(document.activeElement).toBe(trigger.element);
    await trigger.trigger('click'); await flushPromises(); dialog = wrapper.get('[role="alertdialog"]');
    f.storage.failNextSave = true; await button(dialog, 'Delete request').trigger('click'); await flushPromises();
    expect(dialog.get('[role="alert"]').text()).toContain('Disk full'); expect(f.studio.state().ideas).toHaveLength(2);
    await button(dialog, 'Refresh deletion preview').trigger('click'); await flushPromises();
    await button(dialog, 'Delete request').trigger('click'); await flushPromises();
    expect(wrapper.find('[role="alertdialog"]').exists()).toBe(false);
    expect(f.studio.state().ideas.map(item => item.title)).toEqual(['Keep this other board request']);
    expect(f.store.selected).toBeNull(); expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});

it('disables deletion while the selected request has active work without dispatching or cancelling it', async () => {
  const f = await workflowUiFixture();
  await f.studio.createIdea({ title: 'An active request remains', description: 'Deletion must wait.', category: 'Gameplay', username: 'Owner' });
  const idea = f.studio.state().ideas[0]!;
  await f.studio.store.transaction(state => { state.jobs.push({ id: 'active-for-delete', ideaId: idea.id, stage: 'score', provider: 'demo', status: 'running', startedAt: idea.createdAt, logs: [] }); });
  f.store.navigate('board'); f.store.select(idea.id);
  const wrapper = mount(StudioApp, { global: { plugins: [f.pinia, f.provider], directives: { 'cf-icon': () => {} } } });
  try {
    await flushPromises();
    const trigger = wrapper.get(`button[aria-label="Delete request ${idea.id}"]`);
    expect(trigger.attributes('disabled')).toBeDefined(); expect(trigger.attributes('aria-description')).toContain('active');
    expect(f.runner).not.toHaveBeenCalled(); expect(f.studio.state().jobs[0]?.status).toBe('running');
  } finally { wrapper.unmount(); await f.dispose(); }
});
