// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, disposePinia } from 'pinia';
import { expect, it } from 'vitest';
import TaskSchedulerView from '../../../presentation/components/coforge/TaskSchedulerView.vue';
import { coforgeKey, type CoforgeContext } from '../../../presentation/context/coforge-context';
import { useStudioStore } from '../../../presentation/stores/coforge-studio';
import { TaskScheduler } from '../../../features/coforge/application/task-scheduler';
import { StudioService } from '../../../features/coforge/application/studio';
import { emptyTaskScheduler } from '../../../features/coforge/domain/scheduled-task';
import { createSeed } from '../../../features/coforge/domain/seed';
import { createCouncilPreview } from '../../../../../harness/prototype/council-preview';
import { resolveCouncilPlan } from '../../../features/coforge/application/council-execution';
import { MemoryStorage, nodeTimers } from './memory-storage';

it('saves an assigned-member weekly task, keeps an invalid edit and pauses future scheduling explicitly', async () => {
  const timers = nodeTimers();
  const studio = new StudioService(new MemoryStorage(createSeed()), { timers, runners: { demo: async () => ({}), claude: async () => ({}) }, probeRuntime: async () => ({ cliAvailable: false, projectPath: null, allowImplementation: false }) });
  await studio.start(); const council = createCouncilPreview(studio.store); await expect.poll(() => council.snapshot().ready).toBe(true); await council.designateExecutor();
  let state = emptyTaskScheduler();
  const scheduler = new TaskScheduler({ load: async () => structuredClone(state), save: async value => { state = structuredClone(value); } }, {
    owned: () => true, configure: async () => {}, validate: async task => { resolveCouncilPlan(await council.catalogue.list(), { kind: task.destination.kind === 'council' ? 'council' : 'agent', id: task.destination.kind === 'team' ? task.destination.assigneeId ?? '' : task.destination.id, teamId: task.destination.teamId }); },
    readiness: () => ({ ready: false, reason: 'Paused' }), active: () => false, openSource: async () => {}, dispatch: async () => { throw new Error('No provider in UI test'); },
  }, timers);
  await scheduler.start();
  const context: CoforgeContext = { studio, onNotice: () => () => {}, startupError: () => null, host: { council, taskScheduler: scheduler, setSecret: () => false, hasSecret: () => false, openIdeaNote: async () => false, saveExport: async () => '', publishBoard: async () => ({ folder: '', changed: false }), installPagesWorkflow: async () => ({ workflow: '', folder: '', created: false }) } };
  const pinia = createPinia(); useStudioStore(pinia).state = studio.state();
  const wrapper = mount(TaskSchedulerView, { global: { plugins: [pinia], provide: { [coforgeKey as symbol]: context } } });
  try {
    await flushPromises(); await wrapper.findAll('button').find(button => button.text() === 'New scheduled task')!.trigger('click');
    const field = (name: string) => wrapper.get('form').findAll('label').find(label => label.find('span').exists() && label.get('span').text() === name)!.get('input, select, textarea');
    await field('Task name').setValue('Weekly architecture review');
    await field('Project team').setValue('team-example'); await field('Route to').setValue('team'); await field('Assigned team member').setValue('agent-architect');
    await field('Task prompt').setValue('Review the current architecture.'); await field('Timing').setValue('weekly'); await field('Saved timezone').setValue('Europe/Berlin');
    await wrapper.get('form').findAll('label').find(label => label.text().includes('Enable future scheduling'))!.get('input').setValue(true);
    await wrapper.get('form').trigger('submit'); await flushPromises();
    expect(scheduler.snapshot().tasks[0]).toMatchObject({ title: 'Weekly architecture review', enabled: true, destination: { kind: 'team', teamId: 'team-example', assigneeId: 'agent-architect' }, timing: { kind: 'calendar', timeZone: 'Europe/Berlin', weekdays: [1] } });
    await wrapper.get('[aria-label="Edit Weekly architecture review"]').trigger('click'); await field('Task prompt').setValue('');
    await wrapper.get('form').trigger('submit'); await flushPromises(); expect(wrapper.get('[role="alert"]').text()).toContain('at least'); expect(field('Task prompt').element).toHaveProperty('value', '');
    expect(scheduler.snapshot().tasks[0]?.prompt).toBe('Review the current architecture.');
    await wrapper.findAll('button').find(button => button.text() === 'Discard draft')!.trigger('click');
    await wrapper.get('[aria-label="Pause Weekly architecture review"]').trigger('click'); await flushPromises(); expect(scheduler.snapshot().tasks[0]?.enabled).toBe(false);
  } finally { wrapper.unmount(); disposePinia(pinia); await scheduler.dispose(); await studio.stop(); }
});
