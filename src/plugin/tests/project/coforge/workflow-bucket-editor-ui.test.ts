// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { expect, it } from 'vitest';
import WorkflowEditorView from '../../../presentation/components/coforge/WorkflowEditorView.vue';
import { workflowUiFixture } from './workflow-ui-fixture';
import { useWorkflowEditorStore } from '../../../presentation/stores/coforge-workflow-editor';
import { workflowDefinition } from '../../../features/coforge/domain/configured-workflow';

it('edits buckets and their nested work in a clean draft, saves explicitly and restores after discard', async () => {
  const fixture = await workflowUiFixture();
  const wrapper = mount(WorkflowEditorView, { global: { plugins: [fixture.pinia, fixture.provider], directives: { 'cf-icon': () => {} } } });
  try {
    await flushPromises();
    expect(wrapper.findAll('[data-bucket-id]')).toHaveLength(5);
    expect(wrapper.get('.cf-workflow-editor-toolbar').text()).toContain('Standard defaults');
    expect(fixture.store.dirtyWorkflow).toBe(false);
    await wrapper.get('[aria-label="Edit Design bucket"]').trigger('click');
    await wrapper.get('[aria-label="Bucket name"]').setValue('Specification');
    expect(wrapper.get('.cf-workflow-step-list').text()).toContain('Specification');
    expect(fixture.studio.state().settings.workflow).toBeUndefined();
    await wrapper.get('[data-step-id="design"] .cf-workflow-step-select').trigger('click');
    expect(wrapper.get('[aria-label="Bucket"]').element).toHaveProperty('value', 'design');
    await wrapper.get('[aria-label="Bucket"]').setValue('next');
    expect(wrapper.get('[data-step-id="design"]').element.closest('[data-bucket-id]')?.getAttribute('data-bucket-id')).toBe('next');
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(fixture.studio.state().settings.workflow?.buckets?.some(bucket => bucket.name === 'Specification')).toBe(true);
    expect(fixture.runner).not.toHaveBeenCalled();
    await wrapper.get('[aria-label="Edit Specification bucket"]').trigger('click');
    await wrapper.get('[aria-label="Bucket name"]').setValue('Discard me');
    await wrapper.findAll('button').find(button => button.text() === 'Discard workflow changes')!.trigger('click');
    expect(wrapper.get('[aria-label="Bucket name"]').element).toHaveProperty('value', 'Specification');
  } finally { wrapper.unmount(); await fixture.dispose(); }
});

it('targets invalid bucket fields and membership without saving the retained draft', async () => {
  const fixture = await workflowUiFixture();
  const wrapper = mount(WorkflowEditorView, { attachTo: document.body, global: { plugins: [fixture.pinia, fixture.provider], directives: { 'cf-icon': () => {} } } });
  try {
    await flushPromises();
    await wrapper.get('[aria-label="Edit Design bucket"]').trigger('click');
    await wrapper.get('[aria-label="Bucket name"]').setValue('');
    const fix = wrapper.get('[aria-label="Workflow validation"]').findAll('button').find(button => button.text().includes('Bucket name'))!;
    await wrapper.get('[data-step-id="screen"] .cf-workflow-step-select').trigger('click');
    await fix.trigger('click');
    await flushPromises();
    expect(document.activeElement).toBe(wrapper.get('[aria-label="Bucket name"]').element);
    expect(wrapper.findAll('button').find(button => button.text() === 'Save workflow')?.attributes('disabled')).toBeDefined();
    await wrapper.get('[aria-label="Bucket name"]').setValue('Design');
    const editor = useWorkflowEditorStore(fixture.pinia);
    editor.draft.steps[0]!.bucketId = 'missing';
    await flushPromises();
    const membership = wrapper.get('[aria-label="Workflow validation"]').findAll('button').find(button => button.text().includes('Bucket'))!;
    await membership.trigger('click');
    await flushPromises();
    expect(document.activeElement).toBe(wrapper.get('[aria-label="Bucket"]').element);
    expect(fixture.studio.state().settings.workflow).toBeUndefined();
    expect(fixture.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await fixture.dispose(); }
});

it('retains keyboard focus on a surviving control after removing an empty bucket or selected step', async () => {
  const fixture = await workflowUiFixture();
  const wrapper = mount(WorkflowEditorView, { attachTo: document.body, global: { plugins: [fixture.pinia, fixture.provider], directives: { 'cf-icon': () => {} } } });
  try {
    await flushPromises();
    await wrapper.findAll('button').find(button => button.text() === 'Add bucket')!.trigger('click');
    const remove = wrapper.findAll('button').find(button => button.text() === 'Remove New bucket bucket')!;
    if (remove.element instanceof HTMLElement) remove.element.focus();
    await remove.trigger('click');
    await flushPromises();
    expect(document.activeElement).toBe(wrapper.get('[aria-label="Edit In progress bucket"]').element);
    await wrapper.get('[data-step-id="screen"] .cf-workflow-step-select').trigger('click');
    const removeStep = wrapper.get('[aria-label="Remove Screen from workflow"]');
    if (removeStep.element instanceof HTMLElement) removeStep.element.focus();
    await removeStep.trigger('click');
    await flushPromises();
    expect(document.activeElement).toBe(wrapper.get('[data-step-id="score"] .cf-workflow-step-select').element);
    expect(fixture.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await fixture.dispose(); }
});

it('offers explicit bucket adoption for a saved legacy workflow without treating the initial grouping as an edit', async () => {
  const fixture = await workflowUiFixture();
  const original = workflowDefinition(fixture.studio.state().settings);
  await fixture.studio.saveWorkflow(fixture.project.id, { ...original, name: 'Existing workflow' }, JSON.stringify(original));
  const before = fixture.storage.saves;
  const wrapper = mount(WorkflowEditorView, { global: { plugins: [fixture.pinia, fixture.provider], directives: { 'cf-icon': () => {} } } });
  try {
    await flushPromises();
    expect(fixture.store.dirtyWorkflow).toBe(false);
    expect(fixture.storage.saves).toBe(before);
    expect(fixture.studio.state().settings.workflow?.buckets).toBeUndefined();
    const save = wrapper.findAll('button').find(button => button.text() === 'Save workflow')!;
    expect(save.attributes('disabled')).toBeUndefined();
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(fixture.studio.state().settings.workflow?.buckets).toHaveLength(5);
    expect(fixture.studio.state().settings.workflow?.steps.map(step => step.id)).toEqual(original.steps.map(step => step.id));
    expect(fixture.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await fixture.dispose(); }
});

it('adds steps contextually and explains protected endpoints and populated-bucket removal', async () => {
  const fixture = await workflowUiFixture();
  const wrapper = mount(WorkflowEditorView, { global: { plugins: [fixture.pinia, fixture.provider], directives: { 'cf-icon': () => {} } } });
  try {
    await flushPromises();
    await wrapper.get('[aria-label="Edit Design bucket"]').trigger('click');
    expect(wrapper.text()).toContain('Move or remove its steps before removing this bucket.');
    await wrapper.get('[aria-label="Edit Accepted bucket"]').trigger('click');
    expect(wrapper.text()).toContain('Accepted is an outcome');
    expect(wrapper.findAll('button').find(button => button.text() === 'Add AI step')?.attributes('disabled')).toBeDefined();
    await wrapper.findAll('button').find(button => button.text() === 'Add bucket')!.trigger('click');
    expect(wrapper.findAll('[data-bucket-id]')).toHaveLength(6);
    const bucketId = wrapper.get('[aria-label="Bucket name"]').element.getAttribute('data-editing-bucket-id');
    await wrapper.findAll('button').find(button => button.text() === 'Add approval')!.trigger('click');
    const row = wrapper.findAll('[data-step-id]').at(-1)!;
    expect(row.element.closest('[data-bucket-id]')?.getAttribute('data-bucket-id')).toBe(bucketId);
    expect(fixture.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await fixture.dispose(); }
});
