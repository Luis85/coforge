// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { expect, it, vi } from 'vitest';
import TaskSchedulerView from '../../../presentation/components/coforge/TaskSchedulerView.vue';
import { coforgeKey, type CoforgeContext } from '../../../presentation/context/coforge-context';
import { useTaskSchedulerStore } from '../../../presentation/stores/coforge-task-scheduler';
import { createCouncilPreview } from '../../../../../harness/prototype/council-preview';
import { createTaskSchedulerPreview } from '../../../../../harness/prototype/task-scheduler-preview';
import { workflowUiFixture } from './workflow-ui-fixture';

async function setup(native = false) {
  const fixture = await workflowUiFixture();
  const council = createCouncilPreview(fixture.studio.store);
  await expect.poll(() => council.snapshot().ready).toBe(true);
  await council.designateExecutor();
  const scheduler = createTaskSchedulerPreview(council);
  await expect.poll(() => scheduler.snapshot().ready).toBe(true);
  const discardPreview = vi.fn();
  const context: CoforgeContext = { studio: fixture.studio, startupError: () => null, onNotice: () => () => {}, host: {
    ...(native ? { council, taskScheduler: scheduler } : { previewCouncil: () => council, previewTaskScheduler: () => scheduler }), discardPreview,
    setSecret: () => false, hasSecret: () => false, openIdeaNote: async () => false, saveExport: async () => '', publishBoard: async () => ({ folder: '', changed: false }), installPagesWorkflow: async () => ({ workflow: '', folder: '', created: false }),
  } };
  const open = () => mount(TaskSchedulerView, { global: { plugins: [fixture.pinia], provide: { [coforgeKey as symbol]: context } } });
  return { ...fixture, scheduler, discardPreview, open, dispose: async () => { await scheduler.dispose(); await fixture.dispose(); } };
}
it('exits scheduler examples and clears inactive example drafts on explicit global cleanup while retaining ordinary navigation', async () => {
  const f = await setup(); let wrapper = f.open();
  try {
    await flushPromises(); await wrapper.findAll('button').find(item => item.text() === 'Explore scheduler example')!.trigger('click'); await flushPromises();
    expect(wrapper.findAll('button').some(item => item.text() === 'Exit scheduler example')).toBe(true);
    await wrapper.findAll('button').find(item => item.text() === 'New scheduled task')!.trigger('click');
    const store = useTaskSchedulerStore(f.pinia); store.form!.title = 'Keep this temporary draft while navigating';
    wrapper.unmount(); wrapper = f.open(); await flushPromises();
    expect(store.form?.title).toBe('Keep this temporary draft while navigating');
    wrapper.unmount(); f.store.closeTemporaryExamples(); wrapper = f.open(); await flushPromises();
    expect(store.example).toBe(false); expect(store.form).toBeNull(); expect(store.state).toBeNull();
    expect(f.discardPreview).toHaveBeenCalledWith('task-scheduler');
    expect(wrapper.text()).toContain('Explore scheduler example');
    expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});
it('preserves authored native-port schedules and their unsaved draft when temporary examples close', async () => {
  const f = await setup(true);
  const task = await f.scheduler.save({ title: 'Authored retained schedule', projectId: f.project.id, prompt: 'Keep the actual saved prompt.', contextPaths: [], destination: { kind: 'agent', teamId: 'team-example', id: 'agent-architect' }, timing: { kind: 'once', at: new Date(Date.now() + 600000).toISOString() }, enabled: false });
  const wrapper = f.open();
  try {
    await flushPromises(); await wrapper.get(`[aria-label="Edit ${task.title}"]`).trigger('click');
    const store = useTaskSchedulerStore(f.pinia); store.form!.prompt = 'Keep this actual unsaved edit.';
    f.store.closeTemporaryExamples(); await flushPromises();
    expect(store.form?.prompt).toBe('Keep this actual unsaved edit.');
    expect(f.scheduler.snapshot().tasks[0]?.prompt).toBe('Keep the actual saved prompt.');
    expect(f.discardPreview).not.toHaveBeenCalled(); expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});
