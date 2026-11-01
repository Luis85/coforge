// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { expect, it, vi } from 'vitest';
import type { AICostState } from '../../../features/coforge/application/ai-cost-ports';
import type { AICostTask } from '../../../features/coforge/domain/ai-costs';
import { formatUsd } from '../../../features/coforge/domain/ai-costs';
import { createSeed } from '../../../features/coforge/domain/seed';
import IdeaDrawer from '../../../presentation/components/coforge/IdeaDrawer.vue';
import { useAICostStore } from '../../../presentation/stores/coforge-ai-costs';
import { workflowUiFixture } from './workflow-ui-fixture';

async function fixture(initial?: AICostState) {
  const f = await workflowUiFixture();
  const idea = { ...createSeed().ideas[0]!, projectId: f.project.id };
  f.store.state!.ideas = [idea];
  let listener: ((state: AICostState) => void) | undefined;
  const release = vi.fn(); const setManual = vi.fn(async () => {});
  f.context.host.aiCosts = { snapshot: () => initial ?? { tasks: [], error: '', loading: false },
    subscribe: callback => { listener = callback; return release; }, refresh: vi.fn(async () => {}), setManual };
  const task = (id: string, patch: Partial<AICostTask> = {}): AICostTask => ({ id, projectId: f.project.id, projectName: f.project.settings.projectName,
    featureId: idea.id, featureTitle: idea.title, provider: 'codex', model: 'captured-model', stage: 'implement', status: 'failed', startedAt: '2026-11-01T13:00:00Z',
    workflow: { runId: 'captured-run', definitionRevision: 'v1', stepId: 'build', stepName: 'Captured Build', attemptId: `attempt-${id}` }, ...patch });
  f.store.select(idea.id);
  const wrapper = mount(IdeaDrawer, { global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
  async function open() {
    const button = wrapper.findAll('[aria-label="Idea sections"] button').find(button => button.text() === 'AI costs');
    expect(button, 'AI costs must be a dedicated request-detail tab').toBeDefined();
    await button!.trigger('click'); await flushPromises();
  }
  return { ...f, idea, wrapper, task, open, release, setManual, publish: (state: AICostState) => listener?.(state),
    close: async () => { wrapper.unmount(); await f.dispose(); } };
}

it('reads retained costs for this project and request, preserving failed/manual/unknown provenance without changing global filters or invoking providers', async () => {
  const f = await fixture(); const filters = useAICostStore(f.pinia); filters.project = 'keep-project'; filters.feature = 'keep-feature'; filters.search = 'keep-search';
  try {
    const saves = f.storage.saves; await f.open();
    f.publish({ loading: false, error: '', tasks: [
      f.task('reported', { reportedUsd: 1.25, usageSource: 'provider', usage: { inputTokens: 10, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 } }),
      f.task('manual', { status: 'cancelled', manualUsd: '2.50', manualNote: 'Recorded after review', manualAt: '2026-11-01T14:00:00Z' }),
      f.task('unknown'), f.task('simulation', { provider: 'demo', reportedUsd: 999 }), f.task('not-started', { status: 'not-started' }),
      f.task('foreign-project', { projectId: 'CFP-999', model: 'Foreign project model', reportedUsd: 900 }),
      f.task('foreign-feature', { featureId: 'CF-999', model: 'Foreign feature model', reportedUsd: 800 }),
    ] }); await flushPromises();
    const panel = f.wrapper.get('[aria-label="Request AI costs"]');
    expect(panel.text()).toContain('Known subtotal'); expect(panel.text()).toContain(formatUsd(3750000000n));
    expect(panel.text()).toContain('2 of 3'); expect(panel.text()).toContain('Manual fallback'); expect(panel.text()).toContain('Provider reported');
    expect(panel.text()).toContain('Unavailable'); expect(panel.text()).toContain('Simulation'); expect(panel.text()).toContain('No provider contacted');
    expect(panel.text()).toContain('cancelled'); expect(panel.text()).toContain('failed'); expect(panel.text()).toContain('attempt-manual');
    expect(panel.text()).toContain('captured-run'); expect(panel.text()).toContain('captured-model'); expect(panel.text()).toContain('Recorded after review');
    expect(panel.text()).not.toContain('Foreign project model'); expect(panel.text()).not.toContain('Foreign feature model');
    expect(panel.find('input,textarea,select').exists()).toBe(false);
    expect([filters.project, filters.feature, filters.search]).toEqual(['keep-project', 'keep-feature', 'keep-search']);
    expect(f.storage.saves).toBe(saves); expect(f.runner).not.toHaveBeenCalled(); expect(f.setManual).not.toHaveBeenCalled();
  } finally { await f.close(); }
  expect(f.release).toHaveBeenCalledOnce();
});

it('distinguishes loading, safe service failure and empty history, then disposes and ignores late records after project change', async () => {
  const f = await fixture({ tasks: [], loading: true, error: '' });
  try {
    await f.open(); expect(f.wrapper.get('[aria-label="Request AI costs"]').text()).toContain('Loading');
    f.publish({ tasks: [], loading: false, error: 'secret-runtime-path-and-token' }); await flushPromises();
    expect(f.wrapper.get('[aria-label="Request AI costs"]').text()).toContain('Cost history is unavailable');
    expect(f.wrapper.text()).not.toContain('secret-runtime-path-and-token');
    f.publish({ tasks: [], loading: false, error: '' }); await flushPromises();
    expect(f.wrapper.get('[aria-label="Request AI costs"]').text()).toContain('No retained cost records');
    f.store.state!.activeProjectId = 'CFP-999'; await flushPromises();
    expect(f.release).toHaveBeenCalledOnce();
    f.publish({ tasks: [f.task('late', { reportedUsd: 999 })], loading: false, error: '' }); await flushPromises();
    expect(f.wrapper.find('[aria-label="Request AI costs"]').exists()).toBe(false);
  } finally { await f.close(); }
});

it('does not turn missing costs and simulations into zero USD', async () => {
  const f = await fixture();
  try {
    await f.open(); f.publish({ tasks: [f.task('unknown'), f.task('demo', { provider: 'demo', reportedUsd: 999 })], loading: false, error: '' }); await flushPromises();
    const panel = f.wrapper.get('[aria-label="Request AI costs"]');
    expect(panel.get('[aria-label="Request cost coverage"] dd').text()).toBe('Unavailable');
    expect(panel.text()).not.toContain(formatUsd(0n)); expect(panel.text()).not.toContain(formatUsd(999000000000n));
  } finally { await f.close(); }
});

it('retains a genuine provider-reported zero and its zero output-token counter as known values', async () => {
  const f = await fixture();
  try {
    await f.open(); f.publish({ tasks: [f.task('zero', { reportedUsd: 0, usageSource: 'provider', usage: { outputTokens: 0 } })], loading: false, error: '' }); await flushPromises();
    const panel = f.wrapper.get('[aria-label="Request AI costs"]');
    expect(panel.get('[aria-label="Request cost coverage"] dd').text()).toBe(formatUsd(0n));
    expect(panel.text()).toContain('1 of 1'); expect(panel.text()).toContain('Output tokens0');
  } finally { await f.close(); }
});
