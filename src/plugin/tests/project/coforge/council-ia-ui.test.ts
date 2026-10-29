// @vitest-environment happy-dom
import { flushPromises } from '@vue/test-utils';
import { expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import { councilAskFixture, askButton } from './council-ask-fixture';

it('groups Council tasks by user goal while preserving questions and storage drafts', async () => {
  const f = await councilAskFixture();
  try {
    f.ui.taskQuestion = 'Keep this question';
    const primary = f.wrapper.get('nav[aria-label="Council tasks"]');
    expect(primary.findAll('button').map(button => button.text())).toEqual(['Ask', 'Activity', 'Setup', 'Automation']);
    await askButton(f.wrapper, 'Setup').trigger('click'); await flushPromises();
    expect(f.wrapper.get('nav[aria-label="Council workspace"]').text()).toContain('Councils & roster');
    await askButton(f.wrapper, 'Storage folders').trigger('click'); await flushPromises();
    await f.wrapper.get('input[aria-label="CoWorker definitions folder"]').setValue('Private/Specialists');
    await askButton(f.wrapper, 'Ask').trigger('click'); await flushPromises();
    expect(f.ui.taskQuestion).toBe('Keep this question');
    await askButton(f.wrapper, 'Setup').trigger('click'); await flushPromises();
    expect(f.wrapper.get('input[aria-label="CoWorker definitions folder"]').element).toHaveProperty('value', 'Private/Specialists');
    await askButton(f.wrapper, 'Automation').trigger('click'); await flushPromises();
    expect(f.wrapper.get('nav[aria-label="Council workspace"]').findAll('button')).toHaveLength(4);
    expect(f.module.actions.snapshot().runs).toHaveLength(0);
  } finally { await f.dispose(); }
});

it('shows observed setup readiness and useful actions for unavailable CoWorkers', async () => {
  const f = await councilAskFixture();
  try {
    await askButton(f.wrapper, 'Setup').trigger('click'); await flushPromises();
    const readiness = f.wrapper.get('[aria-label="Council setup readiness"]');
    expect(readiness.text()).toContain('1 configured Council');
    expect(readiness.text()).toContain('Provider readiness is checked separately');
    const catalogue = await f.module.actions.catalogue.list();
    const agent = catalogue.valid.find(entry => entry.definition.id === 'agent')!;
    await f.module.actions.catalogue.save({ ...agent.definition, enabled: false }, agent.revision);
    await askButton(f.wrapper, 'Refresh definitions').trigger('click'); await flushPromises();
    expect(readiness.text()).toContain('No enabled CoWorkers');
    expect(readiness.text()).toContain('Enable saved CoWorkers');
    expect(askButton(f.wrapper, 'Create council').attributes('disabled')).toBeDefined();
  } finally { await f.dispose(); }
});

it('keeps activity time truthful and opens the counted project despite stale filters', async () => {
  const f = await councilAskFixture();
  try {
    const run = await f.module.actions.simulate(f.target, 'Private/Proposal.md', 'CoForge/Tests/Activity.md');
    const old = { ...run, state: 'running' as const, updatedAt: '2026-10-29T10:00:00.000Z' };
    const recent = { ...run, id: 'recent-completed', state: 'completed' as const, updatedAt: '2026-10-29T10:05:00.000Z' };
    f.ui.state = { ...f.module.actions.snapshot(), runs: [old, recent] };
    f.ui.projectFilter = 'different-project'; f.ui.stateFilter = 'cancelled'; f.ui.teamFilter = 'stale'; f.ui.sourceFilter = 'stale'; f.ui.targetFilter = 'stale';
    await flushPromises();
    const activity = f.wrapper.get('[aria-label="Council activity"]');
    expect(activity.get('time').attributes('datetime')).toBe(recent.updatedAt);
    expect(activity.get('[role="status"]').text()).not.toContain('Last activity');
    await askButton(f.wrapper, 'View activity').trigger('click'); await flushPromises();
    expect(f.ui.projectFilter).toBe(f.projectId);
    expect([f.ui.stateFilter, f.ui.teamFilter, f.ui.sourceFilter, f.ui.targetFilter]).toEqual(['', '', '', '']);
    expect(f.ui.inspectedRun).toBe(old.id);
    expect(f.wrapper.get('nav[aria-label="Council tasks"]').findAll('[aria-current="page"]').map(button => button.text())).toEqual(['Activity']);
  } finally { await f.dispose(); }
});

it('makes history scope explicit without changing the question project or losing all-project discovery', async () => {
  const f = await councilAskFixture();
  try {
    await f.fill(); await f.wrapper.get('.cf-council-task-composer form').trigger('submit'); await flushPromises();
    const first = f.ui.tasks[0]!;
    f.ui.tasks.push({ ...first, sourceId: 'other-source', projectId: 'other-project', title: 'Other project question', path: 'Private/Other.md' });
    await flushPromises();
    const history = f.wrapper.get('[aria-label="Council task history"]');
    expect(history.text()).not.toContain('Other project question');
    await history.get('select[aria-label="Task history scope"]').setValue('all');
    expect(history.text()).toContain('Other project question');
    expect(f.ui.taskProjectId).toBe(f.projectId);
    expect(f.ui.taskQuestion).toBe('Which approach preserves our project boundaries?');
  } finally { await f.dispose(); }
});

it('leads completed tasks to attributed published answers before technical recovery', async () => {
  vi.useFakeTimers();
  const f = await councilAskFixture(true, 'demo');
  try {
    await f.fill('Milestone advice'); await f.wrapper.get('.cf-council-task-composer form').trigger('submit'); await flushPromises();
    await askButton(f.wrapper, 'Queue simulation').trigger('click'); await flushPromises();
    await askButton(f.wrapper, 'Resume Council execution').trigger('click'); await flushPromises();
    await vi.advanceTimersByTimeAsync(4000);
    expect(f.module.actions.snapshot().runs[0]?.state).toBe('completed');
    await flushPromises();
    const read = f.wrapper.get('button[aria-label="Read answers for Milestone advice"]');
    await read.trigger('click'); await flushPromises();
    const answers = f.wrapper.get('[aria-label="Council answers"]');
    expect(answers.text()).toContain('Milestone advice');
    expect(answers.text()).toContain('Advice Council');
    expect(answers.text()).toContain('Reviewer');
    expect(answers.text()).toContain('Simulation');
    expect(f.wrapper.get('[aria-label="Captured run evidence"] details').attributes('open')).toBeUndefined();
  } finally { await f.dispose(); vi.useRealTimers(); }
});
