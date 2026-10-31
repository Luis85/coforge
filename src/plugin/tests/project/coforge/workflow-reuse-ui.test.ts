// @vitest-environment happy-dom
import { mount, flushPromises } from '@vue/test-utils';
import { expect, it } from 'vitest';
import WorkflowEditorView from '../../../presentation/components/coforge/WorkflowEditorView.vue';
import { workflowDefinition, defaultWorkflowDefinition, workflowDefinitionCheck } from '../../../features/coforge/domain/configured-workflow';
import { prepareWorkflowCopy } from '../../../features/coforge/application/workflow-copy';
import { defaultSettings } from '../../../features/coforge/domain/seed';
import { workflowUiFixture } from './workflow-ui-fixture';

it('copies a saved workflow into a private destination draft and saves independently without dispatch', async () => {
  const f = await workflowUiFixture();
  const original = workflowDefinition(f.project.settings);
  await f.studio.saveWorkflow(f.project.id, { ...original, name: 'Reusable blueprint', startupMode: 'play' }, JSON.stringify(original));
  const source = f.studio.state().projects!.find(project => project.id === f.project.id)!;
  const sourceWorkflow = structuredClone(source.settings.workflow!);
  const destination = await f.studio.createProject({ projectName: 'Destination', projectBrief: 'A separate workflow configuration.', projectPath: '/synthetic/destination' });
  const wrapper = mount(WorkflowEditorView, { global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
  try {
    const writes = f.storage.saves;
    await wrapper.get('[aria-label="Saved workflow to copy"]').setValue(source.id);
    expect(wrapper.get('[aria-label="Workflow copy preview"]').text()).toContain('Reusable blueprint');
    expect(wrapper.get('[aria-label="Workflow copy preview"]').text()).toContain('Start playing');
    await wrapper.findAll('button').find(button => button.text().trim() === 'Copy into draft')!.trigger('click');
    expect(f.storage.saves).toBe(writes);
    expect(wrapper.get('[data-workflow-field="name"]').element).toHaveProperty('value', 'Reusable blueprint');
    expect(wrapper.get('[aria-label="Idea board automation on startup"]').element).toHaveProperty('value', 'play');
    expect(f.studio.state().settings.paused).toBe(true);
    await wrapper.get('[data-workflow-field="name"]').setValue('Destination adaptation');
    await wrapper.get('form.cf-workflow-editor').trigger('submit'); await flushPromises();
    const saved = f.studio.state().projects!.find(project => project.id === destination.id)!;
    expect(saved.settings.workflow).toMatchObject({ name: 'Destination adaptation', startupMode: 'play' });
    expect(saved.settings.workflow?.revision).not.toBe(sourceWorkflow.revision);
    expect(saved.settings.paused).toBe(true);
    expect(f.studio.state().projects!.find(project => project.id === source.id)?.settings.workflow).toEqual(sourceWorkflow);
    await f.studio.saveWorkflow(source.id, { ...sourceWorkflow, name: 'Later source edit' }, JSON.stringify(sourceWorkflow));
    expect(f.studio.state().projects!.find(project => project.id === destination.id)?.settings.workflow?.name).toBe('Destination adaptation');
    expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});

it('requires explicit replacement of an unsaved destination draft', async () => {
  const f = await workflowUiFixture();
  const source = defaultWorkflowDefinition(f.project.settings);
  await f.studio.saveWorkflow(f.project.id, { ...source, name: 'Saved source' }, JSON.stringify(source));
  await f.studio.createProject({ projectName: 'Destination', projectBrief: 'Keep unsaved workflow edits.', projectPath: '/synthetic/destination' });
  const wrapper = mount(WorkflowEditorView, { global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
  try {
    await wrapper.get('[data-workflow-field="name"]').setValue('My unsaved draft');
    await wrapper.get('[aria-label="Saved workflow to copy"]').setValue(f.project.id);
    const copy = wrapper.findAll('button').find(button => button.text().trim() === 'Copy into draft')!;
    expect(copy.attributes('disabled')).toBeDefined();
    expect(wrapper.get('[data-workflow-field="name"]').element).toHaveProperty('value', 'My unsaved draft');
    await wrapper.get('[aria-label="Replace my unsaved workflow draft"]').setValue(true);
    await copy.trigger('click');
    expect(wrapper.get('[data-workflow-field="name"]').element).toHaveProperty('value', 'Saved source');
    expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});

it('clears project-owned resource links while preserving prompts, order and the original definition', () => {
  const base = defaultWorkflowDefinition(defaultSettings());
  const ai = base.steps[0]!;
  if (ai.kind !== 'ai') throw new Error('Expected an AI step');
  const source = workflowDefinitionCheck({ ...base, steps: [{ ...ai, coworkerId: 'vault-worker', outputTemplateId: 'source-template' },
    { id: 'council', kind: 'council', name: 'Discuss', instructions: 'Retain this Council prompt.', councilId: 'source-council', contextMode: 'none', automatic: false },
    { id: 'nudge', kind: 'nudge', name: 'Follow up', instructions: 'Retain this nudge prompt.', teamId: 'source-team', agentId: 'source-agent' }] });
  const before = structuredClone(source);
  const preview = prepareWorkflowCopy(source, 'destination-copy');
  expect(preview.definition.steps.map(step => [step.id, step.instructions])).toEqual(source.steps.map(step => [step.id, step.instructions]));
  expect(preview.definition.steps[0]).not.toHaveProperty('outputTemplateId');
  expect(preview.definition.steps[0]).toMatchObject({ coworkerId: 'vault-worker' });
  expect(preview.definition.steps[1]).toMatchObject({ councilId: '' });
  expect(preview.definition.steps[2]).toMatchObject({ teamId: '', agentId: '' });
  expect(preview.warnings).toHaveLength(3);
  expect(() => workflowDefinitionCheck(preview.definition)).toThrow();
  expect(source).toEqual(before);
});

it('holds copied project bindings for explicit repair without saving or authorizing work', async () => {
  const f = await workflowUiFixture();
  const source = defaultWorkflowDefinition(f.project.settings);
  await f.studio.saveWorkflow(f.project.id, { ...source, steps: [{ id: 'ask', kind: 'council', name: 'Ask', instructions: 'Review the captured request.', councilId: 'source-council', contextMode: 'none', automatic: true }] }, JSON.stringify(source));
  const sourceBefore = structuredClone(f.studio.state().projects!.find(project => project.id === f.project.id));
  await f.studio.createProject({ projectName: 'Destination', projectBrief: 'Repair copied project bindings.', projectPath: '/synthetic/destination' });
  const wrapper = mount(WorkflowEditorView, { global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
  try {
    const writes = f.storage.saves;
    await wrapper.get('[aria-label="Saved workflow to copy"]').setValue(f.project.id);
    expect(wrapper.get('[aria-label="Project bindings to review"]').text()).toContain('select a Council belonging to this project');
    await wrapper.findAll('button').find(button => button.text().trim() === 'Copy into draft')!.trigger('click');
    const save = wrapper.findAll('button').find(button => button.text().trim() === 'Save workflow')!;
    expect(save.attributes('disabled')).toBeDefined();
    expect(f.studio.state().settings.workflow).toBeUndefined();
    expect(f.studio.state().projects!.find(project => project.id === f.project.id)).toEqual(sourceBefore);
    expect(f.storage.saves).toBe(writes);
    expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});
