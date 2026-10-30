// @vitest-environment happy-dom
import { mount, flushPromises } from '@vue/test-utils';
import { expect, it, vi } from 'vitest';
import { workflowArtifactHash, workflowProposalRevision, type WorkflowArtifact } from '../../../features/coforge/domain/configured-workflow-run';
import { defaultWorkflowDefinition } from '../../../features/coforge/domain/configured-workflow';
import { createSeed } from '../../../features/coforge/domain/seed';
import type { Idea } from '../../../features/coforge/domain/types';
import IdeaDrawer from '../../../presentation/components/coforge/IdeaDrawer.vue';
import { workflowUiFixture } from './workflow-ui-fixture';

async function fixture() {
  const f = await workflowUiFixture();
  const idea: Idea = { ...createSeed().ideas.find(item => item.status === 'planned')!, projectId: f.project.id };
  const proposalRevision = workflowProposalRevision(idea);
  const at = new Date().toISOString();
  const payload = { id: 'spec', runId: 'run', stepId: 'design', attemptId: 'attempt', proposalRevision, output: 'design' as const, markdown: '# Lantern specification\n\nPreserve save compatibility.', createdAt: at };
  const artifact: WorkflowArtifact = { ...payload, contentHash: workflowArtifactHash(payload) };
  idea.workflowRun = { id: 'run', ideaId: idea.id, projectId: f.project.id, definition: defaultWorkflowDefinition(f.project.settings), proposalRevision, revision: 1, cursor: 4, state: 'ready', attempts: [{ id: 'attempt', stepId: 'design', stepName: 'Design', kind: 'ai', status: 'succeeded', inputs: [], startedAt: at, finishedAt: at }], artifacts: [artifact], createdAt: at, updatedAt: at };
  if (!f.store.state) throw new Error('Missing state');
  f.store.state.ideas = [idea];
  f.store.select(idea.id, 'plan');
  const wrapper = mount(IdeaDrawer, { global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
  return { ...f, idea, wrapper, close: async () => { wrapper.unmount(); await f.dispose(); } };
}

it('reads the private saved Design specification beside the plan without running or writing', async () => {
  const f = await fixture();
  const clipboard = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
  try {
    const writes = f.storage.saves;
    expect(f.wrapper.get('nav[aria-label="Idea sections"]').text()).toContain('Plan & Design');
    expect(f.wrapper.get('[aria-label="Design specification"]').text()).toContain('Preserve save compatibility.');
    await f.wrapper.findAll('button').find(button => button.text() === 'Copy Design Markdown')!.trigger('click');
    await flushPromises();
    expect(clipboard).toHaveBeenCalledWith('# Lantern specification\n\nPreserve save compatibility.');
    expect(f.storage.saves).toBe(writes);
    expect(f.runner).not.toHaveBeenCalled();
  } finally { clipboard.mockRestore(); await f.close(); }
});

it.each(['invalidated', 'older request', 'tampered', 'foreign run'] as const)('does not present a %s specification as the current Design', async reason => {
  const f = await fixture();
  try {
    const current = f.store.state!.ideas[0]!;
    const run = current.workflowRun!;
    if (reason === 'invalidated') run.invalidatedArtifactIds = ['spec'];
    if (reason === 'older request') current.description += ' Changed request';
    if (reason === 'tampered') run.artifacts[0]!.markdown = 'Tampered specification';
    if (reason === 'foreign run') run.artifacts[0]!.runId = 'other-run';
    await f.wrapper.vm.$nextTick();
    expect(f.wrapper.get('[aria-label="Design specification"]').text()).toContain('No design specification yet');
    expect(f.wrapper.get('[aria-label="Design specification"]').text()).not.toContain('Preserve save compatibility.');
    expect(f.wrapper.findAll('button').some(button => button.text() === 'Copy Design Markdown')).toBe(false);
    const writes = f.storage.saves;
    await f.wrapper.findAll('button').find(button => button.text() === 'Inspect workflow evidence')!.trigger('click');
    expect(f.store.workflowRequestSelection).toBe(current.id);
    expect(f.store.view).toBe('workflow');
    expect(f.storage.saves).toBe(writes);
    expect(f.runner).not.toHaveBeenCalled();
  } finally { await f.close(); }
});
