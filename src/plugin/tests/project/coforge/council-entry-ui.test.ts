// @vitest-environment happy-dom
import { defineComponent, h } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import CouncilView from '../../../presentation/components/coforge/CouncilView.vue';
import WorkflowEditorView from '../../../presentation/components/coforge/WorkflowEditorView.vue';
import { useCouncilEntry } from '../../../presentation/composables/coforge/use-council-entry';
import { coforgeKey } from '../../../presentation/context/coforge-context';
import { councilAskFixture, askButton } from './council-ask-fixture';

async function fixture() {
  const f = await councilAskFixture(); f.wrapper.unmount();
  f.studioUi.navigate('workflow-settings');
  const Shell = defineComponent({ setup() {
    const openCouncil = useCouncilEntry();
    return () => h('main', [
      h('button', { onClick: () => f.studioUi.navigate('council') }, 'Open Council'),
      h('button', { onClick: () => openCouncil({ page: 'monitor', runId: 'retained-child', projectId: 'other-project' }) }, 'Inspect child'),
      f.studioUi.view === 'council' ? h(CouncilView) : f.studioUi.view === 'workflow-settings' ? h(WorkflowEditorView) : h('p', 'Idea board'),
    ]);
  } });
  const shell = mount(Shell, { global: { plugins: [f.pinia], provide: { [coforgeKey as symbol]: f.context }, directives: { 'cf-icon': () => {} } } });
  return { ...f, shell, cleanup: async () => { shell.unmount(); await f.dispose(false); } };
}

it('consumes an explicit event-trigger entry on actual mount and returns ordinary entry to Ask', async () => {
  const f = await fixture();
  try {
    await askButton(f.shell, 'Attach an event trigger').trigger('click'); await flushPromises();
    expect(f.ui.tab).toBe('events');
    expect(f.shell.find('[aria-label="Workflow event triggers"]').exists()).toBe(true);
    expect(f.shell.get('nav[aria-label="Council tasks"] [aria-current="page"]').text()).toBe('Automation');
    expect(f.ui.entryIntent).toBeNull();
    f.studioUi.navigate('board'); await flushPromises();
    await askButton(f.shell, 'Open Council').trigger('click'); await flushPromises();
    expect(f.ui.tab).toBe('ask');
    expect(f.shell.find('[aria-label="Ask the Council for advice"]').exists()).toBe(true);
    expect(f.module.actions.snapshot().runs).toHaveLength(0);
  } finally { await f.cleanup(); }
});

it('does not leave an entry intent or change Council state when dirty workflow navigation is blocked', async () => {
  const f = await fixture();
  try {
    const workflowName = () => {
      const label = f.shell.findAll('label').find(item => item.text().trim() === 'Workflow name');
      if (!label) throw new Error('Missing accessible Workflow name field');
      return label.get('input');
    };
    await workflowName().setValue('Unsaved workflow'); await flushPromises();
    expect(f.studioUi.dirtyWorkflow).toBe(true);
    await askButton(f.shell, 'Attach an event trigger').trigger('click'); await flushPromises();
    expect(f.studioUi.view).toBe('workflow-settings'); expect(f.ui.entryIntent).toBeNull(); expect(f.ui.tab).toBe('ask');
    expect(f.shell.find('[aria-label="Workflow event triggers"]').exists()).toBe(false);
    expect(workflowName().element).toHaveProperty('value', 'Unsaved workflow');
    await askButton(f.shell, 'Discard workflow changes').trigger('click'); await flushPromises();
    await askButton(f.shell, 'Open Council').trigger('click'); await flushPromises();
    expect(f.ui.tab).toBe('ask');
  } finally { await f.cleanup(); }
});

it('discards an abandoned entry and honors an explicit historical child project on cold mount', async () => {
  const f = await fixture();
  try {
    const trigger = askButton(f.shell, 'Attach an event trigger').element;
    if (!(trigger instanceof HTMLButtonElement)) throw new Error('Expected a button');
    trigger.click(); f.studioUi.navigate('board'); await flushPromises();
    await askButton(f.shell, 'Open Council').trigger('click'); await flushPromises();
    expect(f.ui.tab).toBe('ask'); expect(f.ui.entryIntent).toBeNull();
    f.studioUi.navigate('board'); await flushPromises();
    f.ui.runScopeInitialized = false;
    f.ui.stateFilter = 'cancelled'; f.ui.sourceFilter = 'stale';
    await askButton(f.shell, 'Inspect child').trigger('click'); await flushPromises();
    expect(f.ui.tab).toBe('monitor'); expect(f.ui.projectFilter).toBe('other-project'); expect(f.ui.inspectedRun).toBe('retained-child');
    expect(f.ui.stateFilter).toBe(''); expect(f.ui.sourceFilter).toBe('');
    expect(f.shell.get('nav[aria-label="Council tasks"] [aria-current="page"]').text()).toBe('Activity');
  } finally { await f.cleanup(); }
});
