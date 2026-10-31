// @vitest-environment happy-dom
import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import { expect, it } from 'vitest';
import { workflowDefinition } from '../../../features/coforge/domain/configured-workflow';
import { useWorkflowEditor, type WorkflowEditorModel } from '../../../presentation/composables/coforge/use-workflow-editor';
import WorkflowAiStepFields from '../../../presentation/components/coforge/WorkflowAiStepFields.vue';
import { workflowUiFixture } from './workflow-ui-fixture';

it('adds Design in its selected bucket without rewriting custom Build dependencies until explicit save', async () => {
  const f = await workflowUiFixture();
  const source = workflowDefinition(f.studio.state().settings);
  const plan = source.steps.find(step => step.id === 'plan')!;
  const build = source.steps.find(step => step.id === 'implement')!;
  if (build.kind !== 'ai') throw new Error('Missing Build');
  const custom = { ...source, steps: [plan, { ...build, inputs: ['plan' as const] }, { ...plan, id: 'report', name: 'Later report', output: 'markdown' as const }] };
  await f.studio.saveWorkflow(f.project.id, custom, JSON.stringify(source));
  const captured = f.studio.state().settings.workflow!;
  const binding: { model?: WorkflowEditorModel } = {};
  const Probe = defineComponent({ setup() { binding.model = useWorkflowEditor(); return () => h('div'); } });
  const wrapper = mount(Probe, { global: { plugins: [f.pinia, f.provider] } });
  try {
    const model = binding.model!;
    const writes = f.storage.saves;
    model.buckets.selectBucket('design');
    model.addPreset('design');
    expect(model.draft.steps.map(step => step.name)).toEqual(['Plan', 'Design', 'Build', 'Later report']);
    expect(model.draft.steps.filter(step => step.name !== 'Design').map(step => step.id)).toEqual(captured.steps.map(step => step.id));
    expect(model.draft.steps[2]).toMatchObject({ inputs: ['plan'] });
    expect(model.validation).toBe('');
    expect(model.selected?.name).toBe('Design');
    expect(f.storage.saves).toBe(writes);
    expect(f.studio.state().settings.workflow).toEqual(captured);
    model.save();
    await flushPromises();
    expect(f.studio.state().settings.workflow?.steps.map(step => step.name)).toEqual(['Plan', 'Design', 'Build', 'Later report']);
    expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});

it('shows and preserves the choice to include optional earlier results while keeping Design required', async () => {
  const f = await workflowUiFixture();
  const source = workflowDefinition(f.studio.state().settings);
  const plan = source.steps.find(step => step.id === 'plan')!;
  const build = source.steps.find(step => step.id === 'implement')!;
  if (build.kind !== 'ai') throw new Error('Missing Build');
  await f.studio.saveWorkflow(f.project.id, { ...source, steps: [plan, { ...build, inputs: undefined }] }, JSON.stringify(source));
  const binding: { model?: WorkflowEditorModel } = {};
  const Probe = defineComponent({ setup() { binding.model = useWorkflowEditor(); return () => h(WorkflowAiStepFields); } });
  const wrapper = mount(Probe, { global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
  try {
    const model = binding.model!;
    const writes = f.storage.saves;
    model.buckets.selectBucket('design');
    model.addPreset('design');
    model.select(build.id);
    await flushPromises();
    const required = wrapper.findAll('label').find(label => label.text() === 'Design specification')!.get('input');
    expect(required.element).toHaveProperty('checked', false);
    await required.setValue(true);
    const optional = wrapper.findAll('label').find(label => label.text() === 'Include other earlier results')!.get('input');
    await optional.setValue(true);
    expect(optional.element).toHaveProperty('checked', true);
    expect(required.element).toHaveProperty('checked', true);
    await optional.setValue(false);
    expect(model.selected).toMatchObject({ inputs: ['design'], includePreviousResults: false });
    await optional.setValue(true);
    expect(f.storage.saves).toBe(writes);
    model.save();
    await flushPromises();
    expect(f.studio.state().settings.workflow?.steps.find(step => step.id === build.id)).toMatchObject({ inputs: ['design'], includePreviousResults: true });
    expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});
