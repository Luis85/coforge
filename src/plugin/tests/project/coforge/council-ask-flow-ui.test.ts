// @vitest-environment happy-dom
import { flushPromises } from '@vue/test-utils';
import { expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import { councilAskFixture, askButton } from './council-ask-fixture';

it('saves and reviews a question without execution, then admits explicitly and stays in task history', async () => {
  const env = await councilAskFixture(false);
  try {
    const create = vi.spyOn(env.module.actions, 'createTask');
    const submit = vi.spyOn(env.module.actions, 'submit');
    const ideas = env.studio.state().ideas;
    await env.fill();
    await env.wrapper.get('.cf-council-task-composer form').trigger('submit');
    await flushPromises();
    expect(create).toHaveBeenCalledTimes(1);
    expect(env.wrapper.get('[aria-label="Invocation preview"]').text()).toContain('2 invocations');
    expect(env.module.actions.snapshot().runs).toHaveLength(0);
    expect(env.studio.state().ideas).toEqual(ideas);
    expect(askButton(env.wrapper, 'Submit reviewed task').attributes('disabled')).toBeDefined();
    const tasks = await env.module.actions.listTasks();
    expect(tasks).toHaveLength(1);
    expect(env.kit.read(tasks[0]!.path)).toContain('Which approach preserves our project boundaries?');
    expect(env.wrapper.get('[aria-label="Council task history"]').text()).toContain('Saved note · no retained run');
    await askButton(env.wrapper, 'Use this desktop for execution').trigger('click');
    await flushPromises();
    await askButton(env.wrapper, 'Submit reviewed task').trigger('click');
    await flushPromises();
    await vi.waitFor(() => {
      expect(env.ui.error).toBe('');
      expect(env.module.actions.snapshot().runs).toHaveLength(1);
    });
    await flushPromises();
    expect(submit).toHaveBeenCalledTimes(1);
    expect(env.ui.tab).toBe('ask');
    expect(env.ui.taskTitle).toBe('');
    expect(env.ui.taskQuestion).toBe('');
    const runs = env.module.actions.snapshot().runs;
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ state: 'queued', attempts: [], subject: { kind: 'note', sourceId: tasks[0]!.sourceId } });
    expect(env.module.actions.snapshot().paused).toBe(true);
    const history = env.wrapper.get('[aria-label="Council task history"]');
    expect(history.text()).toContain('Advice for our game');
    expect(history.text()).toContain('execution paused');
    env.ui.projectFilter = 'unrelated'; env.ui.stateFilter = 'completed';
    await history.get('button[aria-label="Inspect task Advice for our game"]').trigger('click');
    await flushPromises();
    expect(env.ui.tab).toBe('monitor');
    expect(env.ui.projectFilter).toBe(''); expect(env.ui.stateFilter).toBe('');
    expect(env.ui.inspectedRun).toBe(runs[0]!.id);
  } finally { await env.dispose(); }
});

it('keeps failed creation content/key for retry and starts a distinct draft after a confirmed save is edited', async () => {
  const env = await councilAskFixture();
  try {
    await env.fill();
    const key = env.ui.taskDraftKey;
    const create = vi.spyOn(env.app.vault, 'create').mockRejectedValueOnce(new Error('Disk full'));
    await env.wrapper.get('.cf-council-task-composer form').trigger('submit');
    await flushPromises();
    expect(env.ui.error).toContain('Disk full');
    expect(env.ui.taskDraftKey).toBe(key);
    expect(env.ui.taskTitle).toBe('Advice for our game');
    expect(env.module.actions.snapshot().runs).toEqual([]);
    create.mockRestore();
    await env.wrapper.get('.cf-council-task-composer form').trigger('submit');
    await flushPromises();
    const first = (await env.module.actions.listTasks())[0]!;
    const original = env.kit.read(first.path);
    await env.wrapper.get('.cf-council-task-composer input').setValue('A second question');
    await flushPromises();
    const nextKey = env.ui.taskDraftKey;
    expect(nextKey).not.toBe(key);
    expect(env.wrapper.find('[aria-label="Review Council task"]').exists()).toBe(false);
    await env.wrapper.get('.cf-council-task-composer textarea').setValue('A revised question with explicit constraints.');
    expect(env.ui.taskDraftKey).toBe(nextKey);
    await env.wrapper.get('.cf-council-task-composer form').trigger('submit');
    await flushPromises();
    expect(await env.module.actions.listTasks()).toHaveLength(2);
    expect(env.kit.read(first.path)).toBe(original);
  } finally { await env.dispose(); }
});

it('preserves an unrelated new draft when a saved history task is reviewed and submitted', async () => {
  const env = await councilAskFixture();
  try {
    const older = await env.module.actions.createTask({ projectId: env.projectId, target: { kind: 'council', id: 'advice', teamId: 'team' }, title: 'Older saved question', question: 'A prior question that is ready for review.', idempotencyKey: 'older-draft' });
    await askButton(env.wrapper, 'Refresh Council').trigger('click'); await flushPromises();
    await env.fill('Unrelated new question', 'Keep this unsaved authored question.');
    const key = env.ui.taskDraftKey;
    await env.wrapper.get('button[aria-label="Review saved task Older saved question"]').trigger('click'); await flushPromises();
    await askButton(env.wrapper, 'Submit reviewed task').trigger('click'); await flushPromises();
    await vi.waitFor(() => {
      expect(env.ui.error).toBe('');
      expect(env.module.actions.snapshot().runs).toHaveLength(1);
    });
    await flushPromises();
    expect(env.ui.taskTitle).toBe('Unrelated new question');
    expect(env.ui.taskQuestion).toBe('Keep this unsaved authored question.');
    expect(env.ui.taskDraftKey).toBe(key);
    expect(env.module.actions.snapshot().runs[0]?.subject.sourceId).toBe(older.sourceId);
    expect(await env.module.actions.listTasks()).toHaveLength(1);
  } finally { await env.dispose(); }
});

it('keeps the authored project identity when another project is selected', async () => {
  const env = await councilAskFixture();
  try {
    await env.fill();
    const create = vi.spyOn(env.module.actions, 'createTask');
    await env.studio.createProject({ projectName: 'Other project', projectBrief: 'A separate scope for new questions.', projectPath: '/synthetic/other' });
    await flushPromises();
    expect(env.ui.taskProjectId).toBe(env.projectId);
    expect(env.ui.taskQuestion).toBe('Which approach preserves our project boundaries?');
    expect(askButton(env.wrapper, 'Save task and review').attributes('disabled')).toBeDefined();
    await env.wrapper.get('.cf-council-task-composer form').trigger('submit'); await flushPromises();
    expect(create).not.toHaveBeenCalled();
    expect(env.wrapper.text()).toContain(`This draft belongs to ${env.projectId}`);
  } finally { await env.dispose(); }
});

it('makes simulation explicit without weakening the separate test-destination policy', async () => {
  const env = await councilAskFixture(true, 'demo');
  try {
    await env.fill('A clearly labelled trial', 'Compare these options without contacting a model.');
    await env.wrapper.get('.cf-council-task-composer form').trigger('submit'); await flushPromises();
    expect(askButton(env.wrapper, 'Submit reviewed task').attributes('disabled')).toBeDefined();
    expect(env.ui.destination).toMatch(/^CoForge\/Tests\/task-.+-simulation\.md$/);
    const original = (await env.module.actions.listTasks())[0]!;
    await askButton(env.wrapper, 'Queue simulation').trigger('click'); await flushPromises();
    await vi.waitFor(() => { expect(env.ui.error).toBe(''); expect(env.module.actions.snapshot().runs).toHaveLength(1); });
    await flushPromises();
    expect(env.module.actions.snapshot().runs[0]).toMatchObject({ limits: { simulation: true }, state: 'queued', attempts: [] });
    expect(env.ui.tab).toBe('ask'); expect(env.ui.taskTitle).toBe('');
    expect(env.wrapper.get('[aria-label="Council task history"]').text()).toContain('Simulation ·');
    expect(env.kit.read(original.path)).toContain('Compare these options without contacting a model.');
  } finally { await env.dispose(); }
});
