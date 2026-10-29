import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { createPinia, disposePinia } from 'pinia';
import CouncilView from '../../../presentation/components/coforge/CouncilView.vue';
import { defaultCouncilDefinition } from '../../../features/coforge/domain/council-definitions';
import { useStudioStore } from '../../../presentation/stores/coforge-studio';
import { useCouncilStore } from '../../../presentation/stores/coforge-council';
import { coforgeKey, type CoforgeContext } from '../../../presentation/context/coforge-context';
import { councilControlsFixture } from './council-controls-fixture';

export const askButton = (wrapper: VueWrapper, label: string) => {
  const button = wrapper.findAll('button').find(item => item.text().trim() === label);
  if (!button) throw new Error(`Missing Council action: ${label}`);
  return button;
};
export async function visitCouncilPage(wrapper: VueWrapper, name: string) {
  const pages: Record<string, [string, string]> = {
    'Ask the Council': ['Ask', 'New question'], Definitions: ['Setup', 'Councils & roster'],
    'Submit existing note': ['Ask', 'Existing note'], 'Watched inboxes': ['Automation', 'Watched inboxes'],
    'Task scheduler': ['Automation', 'Schedules'], 'Event triggers': ['Automation', 'Event triggers'],
    'Run monitor': ['Activity', 'Runs & answers'], 'Council workflows': ['Automation', 'Proposal workflows'],
    'Team messages': ['Activity', 'Team messages'], 'Definition folders': ['Setup', 'Storage folders'],
  };
  const page = pages[name]; if (!page) throw new Error(`Unknown Council page ${name}`);
  await askButton(wrapper, page[0]).trigger('click'); await flushPromises();
  const button = wrapper.get('nav[aria-label="Council workspace"]').findAll('button').find(button => button.text() === page[1]);
  if (!button) throw new Error(`Missing Council page ${name}`);
  await button.trigger('click'); await flushPromises();
}
export async function councilAskFixture(executor = true, provider: 'claude' | 'demo' = 'claude') {
  const fixture = await councilControlsFixture(executor);
  const catalogue = await fixture.module.actions.catalogue.list();
  const agent = catalogue.valid.find(item => item.definition.id === 'agent');
  if (!agent || agent.definition.schema !== 'agent/v1') throw new Error('Missing test adviser.');
  await fixture.module.actions.catalogue.save({ ...agent.definition, provider }, agent.revision);
  await fixture.studio.store.updateRuntime({ cliAvailable: provider === 'claude' });
  const team = catalogue.valid.find(item => item.definition.id === 'team')?.definition;
  if (!team || team.schema !== 'team/v1') throw new Error('Missing test team.');
  await fixture.module.actions.catalogue.save(defaultCouncilDefinition('advice', 'Advice Council', team, ['agent']));
  const pinia = createPinia();
  const studio = useStudioStore(pinia);
  const stop = fixture.studio.subscribe(state => { studio.state = state; });
  const context: CoforgeContext = {
    studio: fixture.studio, startupError: () => null, onNotice: () => () => {},
    host: { council: fixture.module.actions, setSecret: () => false, hasSecret: () => false, openIdeaNote: async () => false, saveExport: async () => 'private.json', publishBoard: async () => ({ folder: '', changed: false }), installPagesWorkflow: async () => ({ folder: '', workflow: '', created: false }) },
  };
  const wrapper = mount(CouncilView, { global: { plugins: [pinia], provide: { [coforgeKey as symbol]: context }, directives: { 'cf-icon': () => {} } } });
  await flushPromises();
  return {
    ...fixture, wrapper, pinia, context, studioUi: studio, ui: useCouncilStore(pinia),
    async fill(title = 'Advice for our game', question = 'Which approach preserves our project boundaries?') {
      const form = wrapper.get('[aria-label="Ask the Council for advice"]');
      await form.get('input').setValue(title);
      await form.get('textarea').setValue(question);
      await form.get('select').setValue('advice');
      await flushPromises();
    },
    async dispose(unmount = true) { if (unmount) wrapper.unmount(); stop(); studio.dispose(); disposePinia(pinia); await fixture.dispose(); },
  };
}
