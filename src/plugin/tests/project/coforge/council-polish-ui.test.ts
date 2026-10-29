// @vitest-environment happy-dom
import { mount, flushPromises } from '@vue/test-utils';
import { expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import CouncilView from '../../../presentation/components/coforge/CouncilView.vue';
import type { ExecutionRun } from '../../../features/coforge/domain/execution-run';
import { coforgeKey } from '../../../presentation/context/coforge-context';
import { councilAskFixture, askButton, visitCouncilPage } from './council-ask-fixture';

it('keeps configured setup compact and reveals the editor only after explicit selection or creation', async () => {
  const f = await councilAskFixture(); const root = f.wrapper.element; document.body.append(root);
  try {
    await visitCouncilPage(f.wrapper, 'Definitions');
    const setup = f.wrapper.get('[aria-label="Council setup readiness"]');
    expect(setup.find('.cf-council-readiness-list').exists()).toBe(false);
    expect(setup.text()).toContain('1 configured Council');
    await askButton(f.wrapper, 'Review Council').trigger('click'); await flushPromises();
    expect(document.activeElement).toBe(f.wrapper.get('input[aria-label="Definition name"]').element);
    const search = f.wrapper.get('nav[aria-label="Saved definitions"] input').element;
    if (!(search instanceof HTMLElement)) throw new Error('Expected a search input');
    search.focus();
    await askButton(f.wrapper, 'Refresh definitions').trigger('click'); await flushPromises();
    expect(document.activeElement).toBe(search);
    await askButton(f.wrapper, 'Create council').trigger('click'); await flushPromises();
    expect(document.activeElement).toBe(f.wrapper.get('input[aria-label="Definition name"]').element);
  } finally { await f.dispose(); root.remove(); }
});

it('returns from long answers to the run list without losing scope or mutating work', async () => {
  vi.useFakeTimers(); const f = await councilAskFixture(true, 'demo'); const root = f.wrapper.element; document.body.append(root);
  try {
    await f.fill('Readable advice'); await f.wrapper.get('.cf-council-task-composer form').trigger('submit'); await flushPromises();
    await askButton(f.wrapper, 'Queue simulation').trigger('click'); await flushPromises();
    await askButton(f.wrapper, 'Resume Council execution').trigger('click'); await flushPromises();
    await vi.advanceTimersByTimeAsync(4000); await flushPromises();
    await f.wrapper.get('button[aria-label="Read answers for Readable advice"]').trigger('click'); await flushPromises();
    expect(f.wrapper.get('.cf-council-runs > li strong').text()).toBe('Readable advice');
    f.ui.stateFilter = 'completed'; await flushPromises();
    const before = f.module.actions.snapshot().runs;
    await askButton(f.wrapper, 'Back to runs').trigger('click'); await flushPromises();
    expect(f.ui.inspectedRun).toBe(''); expect(f.ui.projectFilter).toBe(f.projectId); expect(f.ui.stateFilter).toBe('completed');
    expect(f.wrapper.find('[aria-label="Council answers"]').exists()).toBe(false);
    expect(document.activeElement).toBe(f.wrapper.get('[aria-label="Council runs"]').element);
    expect(f.module.actions.snapshot().runs).toEqual(before);
  } finally { await f.dispose(); root.remove(); vi.useRealTimers(); }
});

it('keeps selected active-run controls before long answers without duplicating actions or stealing progress focus', async () => {
  const f = await councilAskFixture(); const root = f.wrapper.element; document.body.append(root);
  try {
    const run = await f.module.actions.simulate({ kind: 'council', id: 'advice', teamId: 'team' }, 'Private/Proposal.md', 'CoForge/Tests/Active.md');
    const invocation = run.invocations[0]!;
    const active: ExecutionRun = { ...run, state: 'running', cursor: 1,
      artifacts: [{ id: 'published-first', runId: run.id, invocationId: invocation.id, attemptId: 'first-attempt', roundId: invocation.roundId, agentId: invocation.agentId, agentRevision: invocation.agentRevision, provider: 'demo', model: invocation.model, inputArtifactIds: [], createdAt: run.createdAt, markdown: 'Published advice. '.repeat(200), simulated: true }],
      attempts: [{ id: 'first-attempt', invocationId: invocation.id, status: 'published', startedAt: run.createdAt, artifactId: 'published-first', dispatch: { prompt: 'Captured input', inputArtifactIds: [] } }],
    };
    f.ui.state = { ...f.module.actions.snapshot(), runs: [active] }; f.ui.inspectedRun = run.id; f.ui.tab = 'monitor'; await flushPromises();
    const answers = f.wrapper.get('[aria-label="Council answers"]');
    expect(answers.findAll('button').some(button => button.text() === 'Pause this run')).toBe(true);
    expect(f.wrapper.findAll('button').filter(button => button.text() === 'Pause this run')).toHaveLength(1);
    const pause = askButton(f.wrapper, 'Pause this run').element;
    expect(pause.compareDocumentPosition(answers.get('article').element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const summary = answers.get('details summary').element;
    if (!(summary instanceof HTMLElement)) throw new Error('Expected a summary');
    summary.focus(); f.ui.state = { ...f.module.actions.snapshot(), runs: [{ ...active, updatedAt: new Date().toISOString() }] }; await flushPromises();
    expect(document.activeElement).toBe(summary);
  } finally { await f.dispose(); root.remove(); }
});

it('uses current setup labels and never claims an empty Council catalogue after a failed read', async () => {
  const f = await councilAskFixture(); f.wrapper.unmount(); f.ui.catalogue = { valid: [], invalid: [] };
  vi.spyOn(f.module.actions.catalogue, 'list').mockRejectedValueOnce(new Error('Definitions unavailable'));
  const wrapper = mount(CouncilView, { global: { plugins: [f.pinia], provide: { [coforgeKey as symbol]: f.context }, directives: { 'cf-icon': () => {} } } });
  try {
    await flushPromises();
    const composer = wrapper.get('[aria-label="Ask the Council for advice"]');
    expect(composer.text()).toContain('Council configuration is unavailable');
    expect(composer.text()).not.toContain('No enabled Council');
    expect(composer.text()).not.toContain('Open Definitions');
    vi.mocked(f.module.actions.catalogue.list).mockResolvedValueOnce({ valid: [], invalid: [] });
    await askButton(wrapper, 'Refresh Council').trigger('click'); await flushPromises();
    expect(composer.text()).toContain('Setup → Councils & roster');
  } finally { wrapper.unmount(); await f.dispose(false); }
});
