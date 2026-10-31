// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { expect, it } from 'vitest';
import IdeaDrawer from '../../../presentation/components/coforge/IdeaDrawer.vue';
import { createSeed } from '../../../features/coforge/domain/seed';
import { defaultWorkflowDefinition } from '../../../features/coforge/domain/configured-workflow';
import { workflowUiFixture } from './workflow-ui-fixture';

it('preserves human review of a held Inbox increment and exposes no execution action from its detail', async () => {
  const f = await workflowUiFixture();
  const idea = createSeed().ideas.find(item => item.increment)!;
  idea.id = 'CF-800'; idea.projectId = f.project.id; idea.status = 'inbox';
  const at = new Date().toISOString();
  idea.workflowRun = { id: 'held-run', ideaId: idea.id, projectId: f.project.id, definition: defaultWorkflowDefinition(f.project.settings), proposalRevision: 'held-proposal', revision: 1, cursor: 5, state: 'awaiting-review', attempts: [], artifacts: [], createdAt: at, updatedAt: at };
  f.store.state!.ideas = [idea];
  Object.assign(f.store.state!, { workflowStopHolds: [idea.id] });
  f.store.select(idea.id, 'increment');
  const wrapper = mount(IdeaDrawer, { global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
  const button = (name: string) => wrapper.findAll('button').find(item => item.text().trim() === name);
  try {
    await flushPromises();
    expect(wrapper.text()).toContain('Stopped — preserved changes need review');
    expect(button('Accept increment')?.isVisible()).toBe(true);
    expect(button('Accept increment')?.attributes('disabled')).toBeUndefined();
    expect(button('Request changes')?.isVisible()).toBe(true);
    await button('Workflow runs')!.trigger('click');
    expect(button('Review code changes')?.isVisible()).toBe(true);
    expect(button('Start a new workflow run')).toBeUndefined();
    expect(wrapper.text()).toContain('Right-click this card and choose Restart workflow');
    expect(wrapper.find('.cf-idea-footer').exists()).toBe(false);
    await button('Review code changes')!.trigger('click');
    expect(f.store.drawerTab).toBe('increment');
    expect(button('Accept increment')?.isVisible()).toBe(true);
    Object.assign(f.store.state!, { workflowStopHolds: [] }); await flushPromises();
    expect(button('Accept increment')).toBeUndefined();
    Object.assign(f.store.state!, { workflowStopHolds: [idea.id] });
    f.store.state!.ideas[0]!.increment = undefined;
    f.store.state!.ideas[0]!.workflowRun!.state = 'stopped';
    await button('Workflow runs')!.trigger('click');
    expect(button('Start a new workflow run')).toBeUndefined();
    expect(wrapper.text()).toContain('Right-click this card and choose Restart workflow');
    expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});
