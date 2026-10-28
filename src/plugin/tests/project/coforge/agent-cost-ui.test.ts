// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { expect, it, vi } from 'vitest';
import AICostsView from '../../../presentation/components/coforge/AICostsView.vue';
import { coforgeKey, type CoforgeContext } from '../../../presentation/context/coforge-context';
import { useAICostStore } from '../../../presentation/stores/coforge-ai-costs';
import { executionCostTasks } from '../../../features/coforge/application/execution-costs';
import { attributedRun } from './cost-attribution-fixture';
import { workflowUiFixture } from './workflow-ui-fixture';

it('regroups the same attempts by agent, team or Council, separates attribution coverage and retains unattributed costs', async () => {
  const fixture = await workflowUiFixture();
  const council = attributedRun('council');
  council.attempts.push({ ...council.attempts[0]!, id: 'missing-retry', costUsd: undefined });
  const tasks = [...executionCostTasks([attributedRun('direct', 'agent'), council], []), { id: 'legacy', featureId: 'CF-999', featureTitle: 'Legacy process', projectId: 'CFP-001', projectName: 'Legacy project', provider: 'claude' as const, stage: 'plan', status: 'failed', startedAt: '2026-10-28T12:00:00Z', reportedUsd: 0.3 }];
  const refresh = vi.fn(async () => {}); const setManual = vi.fn(async () => {});
  const context: CoforgeContext = { studio: fixture.studio, startupError: () => null, onNotice: () => () => {}, host: { aiCosts: { snapshot: () => ({ tasks, loading: false, error: '' }), subscribe: () => () => {}, refresh, setManual }, setSecret: () => false, hasSecret: () => false, openIdeaNote: async () => false, saveExport: async () => '', publishBoard: async () => ({ folder: '', changed: false }), installPagesWorkflow: async () => ({ folder: '', workflow: '', created: false }) } };
  const wrapper = mount(AICostsView, { global: { plugins: [fixture.pinia], provide: { [coforgeKey as symbol]: context } } });
  const store = useAICostStore(fixture.pinia);
  try {
    await flushPromises();
    expect(wrapper.get('[aria-label="Attribution coverage"]').text()).toContain('agent 3/4');
    expect(wrapper.get('[aria-label="Attribution coverage"]').text()).toContain('Council membership 2/4');
    expect(wrapper.findAll('tbody tr')).toHaveLength(4);
    const fields = wrapper.findAll('.cf-ai-attribution-filters select');
    await fields[0]!.setValue('reusable:reviewer');
    expect(wrapper.findAll('tbody tr')).toHaveLength(3);
    const councilTab = wrapper.get('[aria-label="Cost attribution groups"]').findAll('button').find(button => button.text() === 'By Council');
    if (!councilTab) throw new Error('Missing Council grouping');
    await councilTab.trigger('click');
    expect(wrapper.get('.cf-ai-attribution-groups').text()).toContain('Pinned design council');
    expect(wrapper.get('.cf-ai-attribution-groups').text()).toContain('Partial');
    await wrapper.get('.cf-ai-attribution-groups button').trigger('click');
    expect(wrapper.findAll('tbody tr')).toHaveLength(2);
    expect(store.council).toBe('CFP-001/design');
    const clear = wrapper.findAll('button').find(button => button.text() === 'Clear attribution filters');
    if (!clear) throw new Error('Missing clear action');
    await clear.trigger('click');
    expect(wrapper.findAll('tbody tr')).toHaveLength(4);
    await fields[0]!.setValue('__unattributed__');
    expect(wrapper.findAll('tbody tr')).toHaveLength(1);
    expect(wrapper.get('tbody').text()).toContain('Legacy process');
    expect(setManual).not.toHaveBeenCalled(); expect(refresh).not.toHaveBeenCalled();
    expect(fixture.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await fixture.dispose(); }
});
