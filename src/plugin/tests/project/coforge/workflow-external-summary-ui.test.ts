// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { expect, it } from 'vitest';
import WorkflowView from '../../../presentation/components/coforge/WorkflowView.vue';
import { workflowDefinition } from '../../../features/coforge/domain/configured-workflow';
import { workflowProposalRevision } from '../../../features/coforge/domain/configured-workflow-run';
import { workflowUiFixture } from './workflow-ui-fixture';

it('describes a selected MCP run as explicit external steps while preserving captured native providers and ordinary native automation', async () => {
  const f = await workflowUiFixture();
  await f.studio.createIdea({ title: 'An externally assisted request', description: 'Retain its captured workflow definition.', category: 'Gameplay', username: 'Owner' });
  await f.studio.store.transaction(state => {
    const idea = state.ideas[0]!;
    const definition = workflowDefinition(state.settings);
    definition.steps = definition.steps.map(step => step.kind === 'ai' ? { ...step, automatic: true, provider: 'claude', model: 'captured-sonnet' } : step);
    idea.workflowRun = { id: 'mcp-summary-run', ideaId: idea.id, projectId: f.project.id, definition, proposalRevision: workflowProposalRevision(idea), revision: 0, cursor: 0, state: 'ready', attempts: [], artifacts: [], external: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  });
  const original = f.studio.state().ideas[0]!.workflowRun!.definition;
  const wrapper = mount(WorkflowView, { global: { plugins: [f.pinia, f.provider] } });
  try {
    await flushPromises(); const writes = f.storage.saves;
    const summary = () => wrapper.get('.cf-workflow-summary').text();
    expect(summary()).toContain('External MCP run');
    expect(summary()).toContain('AI steps require explicit client calls');
    expect(summary()).toContain('Project automation does not advance this run');
    expect(summary()).toContain('External MCP client');
    expect(summary()).not.toContain('AI steps automatic'); expect(summary()).not.toContain('New automatic runs');
    expect(wrapper.get('.cf-workflow-mode-tag').attributes('title')).toContain('captured-sonnet');
    expect(f.studio.state().ideas[0]!.workflowRun!.definition).toEqual(original);
    expect(f.storage.saves).toBe(writes); expect(f.runner).not.toHaveBeenCalled();
    await f.studio.store.transaction(state => { delete state.ideas[0]!.workflowRun!.external; }); await flushPromises();
    expect(summary()).toContain('4 AI steps automatic'); expect(summary()).toContain('New automatic runs');
    expect(summary()).toContain('Claude Code CLI'); expect(summary()).not.toContain('External MCP run');
  } finally { wrapper.unmount(); await f.dispose(); }
});
