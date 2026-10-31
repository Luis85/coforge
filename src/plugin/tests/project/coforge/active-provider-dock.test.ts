// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import { expect, it } from 'vitest';
import { useStudioApp } from '../../../presentation/composables/coforge/use-studio-app';
import { workflowUiFixture } from './workflow-ui-fixture';

it.each([
  ['codex', 'Codex'], ['claude', 'Claude Code'], ['herdr', 'Herdr · Claude Code'],
  ['demo', 'Simulation'], ['mcp', 'External MCP client'],
] as const)('identifies an active %s attempt in the agent dock', async (provider, label) => {
  const f = await workflowUiFixture();
  await f.studio.createIdea({ title: 'Active provider label', description: 'Show the actual execution provider.', category: 'Gameplay', username: 'Owner' });
  const idea = f.studio.state().ideas[0]!;
  await f.studio.store.transaction(state => {
    state.jobs.push({ id: 'active-provider', ideaId: idea.id, projectId: f.project.id, provider, stage: 'screen', status: 'running', startedAt: new Date().toISOString(), logs: [] });
  });
  const Probe = defineComponent({ setup() { const app = useStudioApp(); return () => h('p', app.shell.dockTitle); } });
  const wrapper = mount(Probe, { global: { plugins: [f.pinia, f.provider] } });
  try {
    expect(wrapper.text()).toMatch(new RegExp(`^${label} · `));
    expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});
