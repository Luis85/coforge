// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { expect, it } from 'vitest';
import IdeaBoard from '../../../presentation/components/coforge/IdeaBoard.vue';
import { createSeed } from '../../../features/coforge/domain/seed';
import { defaultWorkflowDefinition } from '../../../features/coforge/domain/configured-workflow';
import { materializeWorkflowBuckets } from '../../../features/coforge/domain/workflow-buckets';
import { workflowUiFixture } from './workflow-ui-fixture';

it('shows saved bucket configuration with stable keys while preserving search, filters and explicit actions', async () => {
  const f = await workflowUiFixture();
  const definition = materializeWorkflowBuckets(defaultWorkflowDefinition(f.project.settings));
  definition.buckets![0]!.name = 'Intake';
  definition.buckets![1]!.name = 'Ready for planning';
  definition.buckets!.splice(2, 0, { id: 'explore', name: 'Explore', description: 'Optional discovery', role: 'process' });
  if (!f.store.state) throw new Error('Missing state');
  const project = f.store.state.projects?.find(item => item.id === f.project.id);
  if (!project) throw new Error('Missing project');
  project.settings.workflow = definition;
  f.store.state.ideas = createSeed().ideas.map(idea => ({ ...idea, projectId: f.project.id }));
  const menuStub = { template: '<div><slot /></div>' };
  const wrapper = mount(IdeaBoard, { global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true, UContextMenu: menuStub, UDropdownMenu: menuStub } } });
  try {
    const writes = f.storage.saves;
    expect(wrapper.findAll('.cf-column-header h2').map(item => item.text())).toEqual(['Intake', 'Ready for planning', 'Explore', 'Design', 'In progress', 'Accepted']);
    expect(wrapper.get('[data-bucket-id="explore"]').text()).toContain('Optional discovery');
    await wrapper.get('[aria-label="Search ideas"]').setValue('firefly');
    expect(wrapper.get('[data-bucket-id="design"]').findAll('.cf-idea-card')).toHaveLength(1);
    expect(wrapper.findAll('.cf-idea-card')).toHaveLength(1);
    await wrapper.get('[aria-label="Add idea to inbox"]').trigger('click');
    expect(f.store.creating).toBe(true);
    expect(f.runner).not.toHaveBeenCalled();
    expect(f.storage.saves).toBe(writes);
  } finally { wrapper.unmount(); await f.dispose(); }
});
