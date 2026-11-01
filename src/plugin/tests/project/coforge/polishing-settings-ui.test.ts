// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import WorkflowView from '../../../presentation/components/coforge/WorkflowView.vue';
import WorkflowEditorView from '../../../presentation/components/coforge/WorkflowEditorView.vue';
import { useWorkflowEditorStore } from '../../../presentation/stores/coforge-workflow-editor';
import { workflowUiFixture } from './workflow-ui-fixture';
import { councilAskFixture } from './council-ask-fixture';
import { coforgeKey } from '../../../presentation/context/coforge-context';

it('keeps the optional improvement pass in the shared explicit-save workflow draft with real agent choices and inherited bounds', async () => {
  const f = await workflowUiFixture(); f.store.openWorkflowTool('settings');
  const wrapper = mount(WorkflowView, { global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
  try {
    const saves = f.storage.saves;
    await wrapper.get('[aria-label="Enable Improve & polish"]').setValue(true);
    const panel = wrapper.get('[aria-label="Improve & polish configuration"]');
    await panel.get('[aria-label="Improvement provider"]').setValue('claude');
    await panel.get('[aria-label="Improvement model"]').setValue('sonnet');
    await panel.get('[aria-label="Improvement reasoning effort"]').setValue('high');
    await panel.get('[aria-label="Improvement instructions"]').setValue('Preserve the source result and follow the separately captured feedback.');
    await panel.get('[aria-label="Improvement timeout seconds"]').setValue(1200);
    await panel.get('[aria-label="Improvement turns/tool calls"]').setValue(30);
    await panel.get('[aria-label="Improvement budget USD"]').setValue(4);
    expect(f.storage.saves).toBe(saves); expect(f.studio.state().settings.workflow).toBeUndefined();
    const editor = useWorkflowEditorStore(f.pinia); const session = editor.session;
    const nav = wrapper.get('nav[aria-label="Agent workflow pages"]');
    await nav.findAll('button').find(item => item.text() === 'Timing & limits')!.trigger('click');
    await nav.findAll('button').find(item => item.text() === 'Idea Board Workflow')!.trigger('click');
    expect(editor.session).toBe(session); expect(panel.get('[aria-label="Improvement instructions"]').element).toHaveProperty('value', 'Preserve the source result and follow the separately captured feedback.');
    await wrapper.get('form.cf-workflow-editor').trigger('submit'); await flushPromises();
    expect(f.studio.state().settings.workflow?.improvementPass).toMatchObject({ provider: 'claude', model: 'sonnet', effort: 'high',
      limits: { timeoutSeconds: 1200, maxTurns: 30, maxBudgetUsd: 4 }, execution: { mode: 'background', idleWarningSeconds: 1800 } });
    expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});

it('assigns a saved CoWorker to the pass and allows explicit manual customization without workflow-only fields', async () => {
  const f = await councilAskFixture(); f.wrapper.unmount();
  const entry = (await f.module.actions.catalogue.list()).valid.find(item => item.definition.id === 'agent');
  if (!entry || entry.definition.schema !== 'agent/v1') throw new Error('Missing reusable CoWorker');
  await f.module.actions.catalogue.save({ ...entry.definition, provider: 'claude', model: 'sonnet', effort: 'high' }, entry.revision);
  const wrapper = mount(WorkflowEditorView, { global: { plugins: [f.pinia], provide: { [coforgeKey as symbol]: f.context }, directives: { 'cf-icon': () => {} } } });
  try {
    await flushPromises(); await wrapper.get('[aria-label="Enable Improve & polish"]').setValue(true);
    const panel = wrapper.get('[aria-label="Improve & polish configuration"]');
    const editor = useWorkflowEditorStore(f.pinia); const instructions = editor.draft.improvementPass!.instructions;
    await panel.get('[aria-label="Improvement agent configuration"]').setValue('coworker');
    await panel.get('[aria-label="Improvement CoWorker"]').setValue('agent');
    expect(panel.find('[aria-label="Improvement provider"]').exists()).toBe(false);
    expect(editor.draft.improvementPass).toMatchObject({ coworkerId: 'agent', provider: 'claude', model: 'sonnet', effort: 'high', instructions });
    await wrapper.get('form.cf-workflow-editor').trigger('submit'); await flushPromises();
    expect(f.studio.state().settings.workflow?.improvementPass).toMatchObject({ coworkerId: 'agent', provider: 'claude', model: 'sonnet', effort: 'high' });
    expect(f.studio.state().settings.workflow?.improvementPass).not.toHaveProperty('herdrAgent');
    await panel.get('[aria-label="Improvement agent configuration"]').setValue('manual');
    await panel.get('[aria-label="Improvement model"]').setValue('opus');
    expect(editor.draft.improvementPass?.coworkerId).toBeUndefined(); expect(editor.draft.improvementPass?.model).toBe('opus');
    expect(f.studio.state().settings.workflow?.improvementPass?.model).toBe('sonnet');
  } finally { wrapper.unmount(); await f.dispose(false); }
});

it('requires explicit code-policy overrides and disables the pass by removing only its draft configuration', async () => {
  const f = await workflowUiFixture(); f.store.openWorkflowTool('settings');
  const wrapper = mount(WorkflowView, { global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
  try {
    await wrapper.get('[aria-label="Enable Improve & polish"]').setValue(true);
    const editor = useWorkflowEditorStore(f.pinia);
    expect(editor.draft.improvementPass?.limits.maxTurns).toBe(editor.draft.limits.maxTurns);
    expect(editor.draft.improvementPass?.limits.maxBudgetUsd).toBe(editor.draft.limits.maxBudgetUsd);
    expect(editor.draft.improvementPass?.execution).not.toHaveProperty('maxRuntimeSeconds');
    await wrapper.get('[aria-label="Set improvement code deadline"]').setValue(true);
    await wrapper.get('[aria-label="Improvement code deadline hours"]').setValue(120);
    expect(editor.draft.improvementPass?.execution?.maxRuntimeSeconds).toBe(432000);
    expect(wrapper.text()).toContain('Text results use the foreground timeout');
    await wrapper.get('[aria-label="Enable Improve & polish"]').setValue(false);
    expect(editor.draft.improvementPass).toBeUndefined(); expect(editor.draft.steps.length).toBeGreaterThan(0);
    expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});
