// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { expect, it } from 'vitest';
import IdeaBoard from '../../../presentation/components/coforge/IdeaBoard.vue';
import { createSeed } from '../../../features/coforge/domain/seed';
import { workflowUiFixture } from './workflow-ui-fixture';

it('places planned requests in Design before Build while preserving filters and read-only navigation', async () => {
  const f = await workflowUiFixture();
  const seed = createSeed();
  if (!f.store.state) throw new Error('Missing state');
  f.store.state.ideas = seed.ideas.map(idea => ({ ...idea, projectId: f.project.id }));
  f.store.state.contributors = seed.contributors;
  const menuStub = { template: '<div><slot /></div>' };
  const wrapper = mount(IdeaBoard, { global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true, UContextMenu: menuStub, UDropdownMenu: menuStub } } });
  try {
    expect(wrapper.findAll('.cf-column-header h2').map(item => item.text())).toEqual(['Inbox', 'Up next', 'Design', 'In progress', 'Accepted']);
    const design = wrapper.findAll('.cf-kanban-column')[2]!;
    expect(design.text()).toContain('A firefly trail after sunset');
    expect(wrapper.findAll('.cf-kanban-column')[1]!.text()).not.toContain('A firefly trail after sunset');
    await wrapper.get('[aria-label="Search ideas"]').setValue('firefly');
    expect(design.findAll('.cf-idea-card')).toHaveLength(1);
    expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});
