// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import IdeaDrawer from '../../../presentation/components/coforge/IdeaDrawer.vue';
import ToastStack from '../../../presentation/components/coforge/ToastStack.vue';
import { workflowUiFixture } from './workflow-ui-fixture';

it('presents the complete attention message in a dedicated body beside a decorative icon', async () => {
  const f = await workflowUiFixture();
  await f.studio.createIdea({ title: 'Preserve stream chat', description: 'Keep chat safely.', category: 'Gameplay', username: 'Owner' });
  const idea = f.studio.state().ideas.find(item => item.projectId === f.project.id)!;
  const detail = 'The game repository has uncommitted changes. Commit or stash them before creating a workflow workspace.';
  await f.studio.store.transaction(state => { state.ideas.find(item => item.id === idea.id)!.lastError = detail; });
  f.store.select(idea.id); f.store.drawerTab = 'plan';
  const wrapper = mount(IdeaDrawer, { attachTo: document.body, global: { plugins: [f.pinia, f.provider], directives: { 'cf-icon': () => {} }, stubs: { IdeaDrawerHeader: true, IdeaPlanTab: true, IdeaReviewActions: true } } });
  try {
    const message = wrapper.get('.cf-idea-alert.is-error');
    expect(message.attributes('role')).toBe('alert');
    expect(message.get('.cf-notice-body').text()).toContain('Request needs attention');
    expect(message.get('.cf-notice-body').text()).toContain(detail);
    expect(message.get('.cf-icon').attributes('aria-hidden')).toBe('true');
    expect(message.get('.cf-notice-body').find('.cf-icon').exists()).toBe(false);
    expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});

it('announces each toast at its severity and keeps dismissal outside the message live region', async () => {
  const f = await workflowUiFixture();
  const wrapper = mount(ToastStack, { global: { plugins: [f.pinia], directives: { 'cf-icon': () => {} } } });
  try {
    f.store.notify('Workflow saved for future runs.');
    f.store.notify('The request could not be saved. Your draft is kept.', true);
    await flushPromises();
    const success = wrapper.get('.cf-toast:not(.cf-toast-error) .cf-notice-body');
    const error = wrapper.get('.cf-toast-error .cf-notice-body');
    expect(success.attributes('role')).toBe('status');
    expect(error.attributes('role')).toBe('alert');
    expect(error.text()).toBe('The request could not be saved. Your draft is kept.');
    expect(error.find('button').exists()).toBe(false);
    await wrapper.get('.cf-toast-error [aria-label="Dismiss notification"]').trigger('click');
    expect(wrapper.findAll('.cf-toast')).toHaveLength(1);
    expect(wrapper.text()).toContain('Workflow saved for future runs.');
    expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});

it('keeps changing run logs outside the concise status announcement and retains cancellation', async () => {
  const f = await workflowUiFixture();
  await f.studio.createIdea({ title: 'A focused active request', description: 'Keep logs available without repeating them.', category: 'Gameplay', username: 'Owner' });
  const idea = f.studio.state().ideas.find(item => item.projectId === f.project.id)!;
  if (!f.store.state) throw new Error('Missing studio state');
  f.store.state.jobs.push({ id: 'notification-job', ideaId: idea.id, projectId: f.project.id, stage: 'plan', status: 'running', provider: 'demo', startedAt: new Date().toISOString(), logs: ['Detailed progress remains readable.'] });
  f.store.select(idea.id);
  const wrapper = mount(IdeaDrawer, { attachTo: document.body, global: { plugins: [f.pinia, f.provider], directives: { 'cf-icon': () => {} }, stubs: { IdeaDrawerHeader: true, IdeaOverviewTab: true, IdeaReviewActions: true } } });
  try {
    const notice = wrapper.get('.cf-idea-alert.is-agent');
    expect(notice.get('[role="status"]').text()).toBe('Simulating: plan');
    expect(notice.get('[role="region"][aria-label="Current run log"]').text()).toContain('Detailed progress remains readable.');
    expect(notice.get('[role="region"]').attributes('tabindex')).toBe('0');
    expect(notice.findAll('button').some(button => button.text().trim() === 'Cancel run')).toBe(true);
    expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});
