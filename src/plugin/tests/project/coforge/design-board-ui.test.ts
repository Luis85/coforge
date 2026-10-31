// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { expect, it } from 'vitest';
import IdeaBoard from '../../../presentation/components/coforge/IdeaBoard.vue';
import { createSeed } from '../../../features/coforge/domain/seed';
import { defaultWorkflowDefinition } from '../../../features/coforge/domain/configured-workflow';
import { workflowArtifactHash, workflowProposalRevision } from '../../../features/coforge/domain/configured-workflow-run';
import { workflowUiFixture } from './workflow-ui-fixture';

it('keeps completed Design in its column and clearly labels Build readiness without dispatch', async () => {
  const f = await workflowUiFixture();
  const idea = { ...createSeed().ideas.find(item => item.status === 'planned')!, projectId: f.project.id };
  const at = new Date().toISOString();
  const proposalRevision = workflowProposalRevision(idea);
  const payload = { id: 'spec', runId: 'run', stepId: 'design', attemptId: 'attempt', proposalRevision, output: 'design' as const, markdown: '# Current specification', createdAt: at };
  const run = { id: 'run', ideaId: idea.id, projectId: f.project.id, definition: defaultWorkflowDefinition(f.project.settings), proposalRevision, revision: 1, cursor: 4, state: 'ready' as const,
    attempts: [{ id: 'attempt', stepId: 'design', stepName: 'Design', kind: 'ai' as const, status: 'succeeded' as const, inputs: [], startedAt: at, finishedAt: at }],
    artifacts: [{ ...payload, contentHash: workflowArtifactHash(payload) }], createdAt: at, updatedAt: at };
  if (!f.store.state) throw new Error('Missing state');
  f.store.state.ideas = [{ ...idea, workflowRun: run }];
  const menuStub = { template: '<div><slot /></div>' };
  const wrapper = mount(IdeaBoard, { global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true, UContextMenu: menuStub, UDropdownMenu: menuStub } } });
  try {
    const design = wrapper.findAll('.cf-kanban-column')[2]!;
    expect(design.text()).toContain('Design complete · Ready to build');
    expect(wrapper.findAll('.cf-kanban-column')[3]!.text()).not.toContain(idea.title);
    const writes = f.storage.saves;
    f.store.state.ideas[0]!.workflowRun!.invalidatedArtifactIds = ['spec'];
    await wrapper.vm.$nextTick();
    expect(design.text()).not.toContain('Design complete');
    expect(f.runner).not.toHaveBeenCalled();
    expect(f.storage.saves).toBe(writes);
  } finally { wrapper.unmount(); await f.dispose(); }
});

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
