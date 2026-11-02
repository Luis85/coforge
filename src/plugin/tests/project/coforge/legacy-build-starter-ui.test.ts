// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { expect, it } from 'vitest';
import WorkflowEditorView from '../../../presentation/components/coforge/WorkflowEditorView.vue';
import { useWorkflowEditorStore } from '../../../presentation/stores/coforge-workflow-editor';
import { defaultStagePrompt, legacyBuildInstructions } from '../../../features/coforge/domain/stage-prompts';
import { workflowUiFixture } from './workflow-ui-fixture';

it('offers an explicit draft-only update of the known earlier Build starter while retaining custom suffix text and saved state', async () => {
  const f = await workflowUiFixture();
  const wrapper = mount(WorkflowEditorView, { global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
  try {
    const editor = useWorkflowEditorStore(f.pinia); editor.selectedId = 'implement';
    await flushPromises(); await wrapper.get('[aria-label="AI provider"]').setValue('claude');
    const step = editor.draft.steps.find(step => step.id === 'implement');
    if (!step || step.kind !== 'ai') throw new Error('Expected Build');
    const suffix = '\n\nUse dedicated specialists, keep the work small, and preserve this owner instruction exactly.\n';
    step.instructions = legacyBuildInstructions + suffix; await flushPromises();
    const saved = JSON.stringify(f.studio.state().settings.workflow); const writes = f.storage.saves;
    expect(wrapper.get('[aria-label="Build instructions need review"]').text()).toContain('forbids commands and test execution');
    await wrapper.findAll('button').find(button => button.text() === 'Update known starter in draft')!.trigger('click');
    expect(step.instructions).toBe(defaultStagePrompt('implement') + suffix);
    expect(f.storage.saves).toBe(writes); expect(JSON.stringify(f.studio.state().settings.workflow)).toBe(saved);
    expect(f.studio.state().jobs).toEqual([]); expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});

it('warns about custom command restrictions without offering automatic starter replacement', async () => {
  const f = await workflowUiFixture();
  const wrapper = mount(WorkflowEditorView, { global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
  try {
    const editor = useWorkflowEditorStore(f.pinia); editor.selectedId = 'implement';
    await flushPromises(); await wrapper.get('[aria-label="AI provider"]').setValue('claude');
    const step = editor.draft.steps.find(step => step.id === 'implement');
    if (!step || step.kind !== 'ai') throw new Error('Expected Build');
    const instructions = 'Implement the plan as a small plugin increment.\nStay within the requested task.\nDo not execute commands or install dependencies.\nCoForge marks tests as not run.';
    step.instructions = instructions; await flushPromises();
    expect(wrapper.get('[aria-label="Build instructions need review"]').text()).toContain('custom instructions are preserved');
    expect(wrapper.findAll('button').some(button => button.text() === 'Review step instructions')).toBe(true);
    expect(wrapper.findAll('button').some(button => button.text() === 'Update known starter in draft')).toBe(false);
    expect(step.instructions).toBe(instructions); expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});
