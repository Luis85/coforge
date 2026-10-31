// @vitest-environment happy-dom
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import WorkflowEditorView from '../../../presentation/components/coforge/WorkflowEditorView.vue';
import WorkflowView from '../../../presentation/components/coforge/WorkflowView.vue';
import { coforgeKey } from '../../../presentation/context/coforge-context';
import { councilAskFixture, askButton } from './council-ask-fixture';
import { defaultWorkflowDefinition } from '../../../features/coforge/domain/configured-workflow';
import { createSeed } from '../../../features/coforge/domain/seed';
import { workflowArtifactHash, workflowRunCheck } from '../../../features/coforge/domain/configured-workflow-run';
import { testCouncilBinding } from './workflow-council-test-binding';

async function openAddStep(wrapper: VueWrapper) {
  const chooser = wrapper.get('details.cf-workflow-add-step');
  const summary = chooser.get('summary').element;
  if (!(summary instanceof HTMLElement)) throw new Error('Missing native add-step summary');
  summary.click(); await flushPromises();
  expect(chooser.element).toHaveProperty('open', true);
}

it('authors and explicitly saves an Ask Council step using only a Council selection', async () => {
  const f = await councilAskFixture();
  const wrapper = mount(WorkflowEditorView, { global: { plugins: [f.pinia], provide: { [coforgeKey as symbol]: f.context }, directives: { 'cf-icon': () => {} } } });
  try {
    await flushPromises();
    await openAddStep(wrapper);
    await askButton(wrapper, 'Add Ask Council').trigger('click'); await flushPromises();
    const editor = wrapper.get('[aria-label="Selected workflow step"]');
    await editor.get('select').setValue('advice');
    await editor.get('textarea').setValue('Compare options and recommend a path.');
    expect(editor.text()).toContain('Reviewer');
    expect(editor.text()).toContain('waits for all published Council answers');
    expect(editor.get('[aria-label="Live Council execution readiness"]').text()).toContain('selected native runtimes are ready');
    const context = editor.findAll('label').find(label => label.text().startsWith('Earlier workflow results'))!.get('select');
    await context.setValue('none');
    expect(f.studio.state().settings.workflow).toBeUndefined();
    expect(askButton(wrapper, 'Save workflow').attributes('disabled')).toBeUndefined();
    await wrapper.get('form.cf-workflow-editor').trigger('submit'); await flushPromises();
    expect(wrapper.find('[role="alert"]').exists() ? wrapper.get('[role="alert"]').text() : '').toBe('');
    expect(f.studio.state().settings.workflow?.steps.at(-1)).toMatchObject({ kind: 'council', councilId: 'advice', instructions: 'Compare options and recommend a path.', contextMode: 'none', inputs: [] });
    expect(f.module.actions.snapshot().runs).toHaveLength(0);
  } finally { wrapper.unmount(); await f.dispose(); }
});

it('shows an actionable simulation readiness boundary without starting or claiming live work', async () => {
  const f = await councilAskFixture(true, 'demo');
  const wrapper = mount(WorkflowEditorView, { global: { plugins: [f.pinia], provide: { [coforgeKey as symbol]: f.context }, directives: { 'cf-icon': () => {} } } });
  try {
    await openAddStep(wrapper);
    await askButton(wrapper, 'Add Ask Council').trigger('click'); await flushPromises();
    const editor = wrapper.get('[aria-label="Selected workflow step"]'); await editor.get('select').setValue('advice');
    expect(editor.get('[aria-label="Live Council execution readiness"]').text()).toContain('uses Simulation');
    expect(editor.text()).toContain('Request workflows require live Claude or Codex CoWorkers');
    expect(askButton(wrapper, 'Open Council setup').exists()).toBe(true);
    expect(askButton(wrapper, 'Check runtime settings').exists()).toBe(true);
    expect(f.module.actions.snapshot().runs).toHaveLength(0);
  } finally { wrapper.unmount(); await f.dispose(); }
});

it('opens the Council context control when the merged validation summary reports an empty selection', async () => {
  const f = await councilAskFixture();
  const wrapper = mount(WorkflowEditorView, { attachTo: document.body, global: { plugins: [f.pinia], provide: { [coforgeKey as symbol]: f.context }, directives: { 'cf-icon': () => {} } } });
  try {
    await openAddStep(wrapper); await askButton(wrapper, 'Add Ask Council').trigger('click'); await flushPromises();
    const editor = wrapper.get('[aria-label="Selected workflow step"]');
    await editor.get('select[data-workflow-field="councilId"]').setValue('advice');
    const context = editor.get('select[data-workflow-field="inputs"]'); await context.setValue('selected');
    const repair = wrapper.get('[aria-label="Workflow validation"]').findAll('button').find(button => button.text().includes('Choose at least one earlier result role'));
    expect(repair).toBeDefined(); await repair!.trigger('click'); await flushPromises();
    expect(document.activeElement).toBe(context.element);
    expect(askButton(wrapper, 'Save workflow').attributes('disabled')).toBeDefined();
    expect(f.module.actions.snapshot().runs).toHaveLength(0);
  } finally { wrapper.unmount(); await f.dispose(); }
});

function retainedRun(projectId: string, runId: string, childId: string, name: string) {
  const at = new Date().toISOString(); const definition = { ...defaultWorkflowDefinition(createSeed().settings), revision: 'retained-council', steps: [{ id: 'ask', kind: 'council', name: 'Ask Council', instructions: 'Advise.', councilId: 'advice', automatic: false }] };
  const artifact = { id: `artifact-${runId}`, runId, stepId: 'ask', attemptId: `attempt-${runId}`, proposalRevision: 'proposal-one', output: 'markdown', markdown: 'An attributed answer.', createdAt: at };
  return workflowRunCheck({ id: runId, ideaId: 'request', projectId, definition, proposalRevision: 'proposal-one', revision: 1, cursor: 1, state: 'finished', createdAt: at, updatedAt: at,
    councilBindings: [{ stepId: 'ask', binding: { ...testCouncilBinding(projectId), councilName: name } }],
    attempts: [{ id: artifact.attemptId, stepId: 'ask', stepName: 'Ask Council', kind: 'council', status: 'succeeded', inputs: [], startedAt: at, finishedAt: at, nudgeState: 'submitted', nudgeRunId: childId, councilSourceId: `source-${runId}`, nudgeSourcePath: `Private/${runId}.md` }],
    artifacts: [{ ...artifact, contentHash: workflowArtifactHash({ ...artifact, output: 'markdown' }) }],
  });
}

it('keeps named completed and historical Council links and clears filters on inspection', async () => {
  const f = await councilAskFixture();
  const idea = f.studio.state().ideas.find(item => item.projectId === f.projectId)!;
  const latest = retainedRun(f.projectId, 'parent-latest', 'child-latest', 'Current advice Council'); latest.ideaId = idea.id;
  const history = retainedRun(f.projectId, 'parent-history', 'child-history', 'Earlier advice Council'); history.ideaId = idea.id;
  await f.studio.store.transaction(state => { const target = state.ideas.find(item => item.id === idea.id)!; target.workflowRun = latest; target.workflowHistory = [history]; });
  f.studioUi.workflowRequestSelection = idea.id;
  const wrapper = mount(WorkflowView, { global: { plugins: [f.pinia], provide: { [coforgeKey as symbol]: f.context }, directives: { 'cf-icon': () => {} } } });
  try {
    await flushPromises();
    expect(wrapper.get('[aria-label="Workflow Council activity"]').text()).toContain('Current advice Council');
    expect(wrapper.findAll('button').some(button => button.text() === 'Check Council answer')).toBe(false);
    f.ui.projectFilter = 'wrong-project'; f.ui.stateFilter = 'cancelled'; f.ui.teamFilter = 'wrong-team'; f.ui.targetFilter = 'wrong-member'; f.ui.sourceFilter = 'wrong-source';
    const older = wrapper.get('button[aria-label="Read Council discussion Earlier advice Council for Ask Council"]');
    await older.trigger('click'); await flushPromises();
    expect(f.ui.inspectedRun).toBe('child-history'); expect(f.ui.tab).toBe('monitor');
    expect(f.ui.projectFilter).toBe(f.projectId); expect(f.ui.stateFilter).toBe(''); expect(f.ui.sourceFilter).toBe(''); expect(f.ui.teamFilter).toBe(''); expect(f.ui.targetFilter).toBe('');
    expect(f.module.actions.snapshot().runs).toHaveLength(0);
  } finally { wrapper.unmount(); await f.dispose(); }
});
