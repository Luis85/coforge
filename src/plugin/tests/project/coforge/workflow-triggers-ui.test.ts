// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, disposePinia } from 'pinia';
import { expect, it } from 'vitest';
import WorkflowTriggersView from '../../../presentation/components/coforge/WorkflowTriggersView.vue';
import { coforgeKey, type CoforgeContext } from '../../../presentation/context/coforge-context';
import { useStudioStore } from '../../../presentation/stores/coforge-studio';
import { useCouncilStore } from '../../../presentation/stores/coforge-council';
import { WorkflowTriggers } from '../../../features/coforge/application/workflow-triggers';
import { emptyWorkflowTriggers } from '../../../features/coforge/domain/workflow-triggers';
import { StudioService } from '../../../features/coforge/application/studio';
import { createSeed } from '../../../features/coforge/domain/seed';
import { createCouncilPreview } from '../../../../../harness/prototype/council-preview';
import { MemoryStorage, nodeTimers } from './memory-storage';

it('reviews the saved workflow, preserves an invalid draft and attaches both workflow types to future events', async () => {
  const studio = new StudioService(new MemoryStorage(createSeed()), { timers: nodeTimers(), runners: { demo: async () => ({}), claude: async () => ({}) }, probeRuntime: async () => ({ cliAvailable: false, projectPath: null, allowImplementation: false }) });
  await studio.start(); const council = createCouncilPreview(studio.store); await expect.poll(() => council.snapshot().ready).toBe(true); await council.designateExecutor();
  let state = emptyWorkflowTriggers();
  const service = new WorkflowTriggers({ load: async () => state, save: async value => { state = structuredClone(value); } }, {
    owned: () => true, configure: async () => {}, readiness: () => ({ ready: true, reason: '' }), active: () => false, subscribe: () => () => {},
    describe: async input => ({ revision: `${input.workflow}-saved`, definitionJson: JSON.stringify({ name: input.workflow === 'v1' ? 'Community development' : 'Review council' }), subject: input.workflow === 'v1' ? 'idea' : 'note' }),
    dispatch: async () => { throw new Error('No provider in UI test'); },
  });
  await service.start();
  const context: CoforgeContext = { studio, onNotice: () => () => {}, startupError: () => null, host: { council, workflowTriggers: service, setSecret: () => false, hasSecret: () => false, openIdeaNote: async () => false, saveExport: async () => '', publishBoard: async () => ({ folder: '', changed: false }), installPagesWorkflow: async () => ({ workflow: '', folder: '', created: false }) } };
  const pinia = createPinia(); useStudioStore(pinia).state = studio.state(); useCouncilStore(pinia).state = council.snapshot();
  const wrapper = mount(WorkflowTriggersView, { global: { plugins: [pinia], provide: { [coforgeKey as symbol]: context } } });
  const field = (name: string) => wrapper.get('form').findAll('label').find(label => label.find('span').exists() && label.get('span').text() === name)!.get('input, select, textarea');
  const review = async () => { await wrapper.findAll('button').find(button => button.text() === 'Review saved workflow')!.trigger('click'); await flushPromises(); };
  try {
    await flushPromises(); await field('Trigger name').setValue('New request workflow'); await review();
    await wrapper.get('form').trigger('submit'); await flushPromises();
    expect(service.snapshot().bindings[0]).toMatchObject({ workflow: 'v1', workflowRevision: 'v1-saved', enabled: false, request: 'event' });
    await field('Workflow').setValue('v2'); await flushPromises();
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined(); await review();
    await field('Trigger name').setValue(''); await wrapper.get('form').trigger('submit'); await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('at least'); expect(field('Trigger name').element).toHaveProperty('value', '');
    await field('Trigger name').setValue('Council on application event'); await field('Listen to').setValue('application');
    await wrapper.get('form').findAll('label').find(label => label.text().includes('Enable future matching events'))!.get('input').setValue(true);
    await wrapper.get('form').trigger('submit'); await flushPromises();
    expect(service.snapshot().bindings[1]).toMatchObject({ workflow: 'v2', scope: 'application', workflowRevision: 'v2-saved', enabled: true });
  } finally { wrapper.unmount(); disposePinia(pinia); await service.dispose(); await studio.stop(); }
});
