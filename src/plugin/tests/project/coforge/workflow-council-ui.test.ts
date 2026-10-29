// @vitest-environment happy-dom
import { mount, flushPromises } from '@vue/test-utils';
import { expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import WorkflowEditorView from '../../../presentation/components/coforge/WorkflowEditorView.vue';
import { coforgeKey } from '../../../presentation/context/coforge-context';
import { councilAskFixture, askButton } from './council-ask-fixture';

it('authors and explicitly saves an Ask Council step using only a Council selection', async () => {
  const f = await councilAskFixture();
  const wrapper = mount(WorkflowEditorView, { global: { plugins: [f.pinia], provide: { [coforgeKey as symbol]: f.context }, directives: { 'cf-icon': () => {} } } });
  try {
    await flushPromises();
    await askButton(wrapper, 'Add Ask Council').trigger('click'); await flushPromises();
    const editor = wrapper.get('[aria-label="Selected workflow step"]');
    await editor.get('select').setValue('advice');
    await editor.get('textarea').setValue('Compare options and recommend a path.');
    expect(editor.text()).toContain('Reviewer');
    expect(editor.text()).toContain('waits for all published Council answers');
    expect(f.studio.state().settings.workflow).toBeUndefined();
    expect(askButton(wrapper, 'Save workflow').attributes('disabled')).toBeUndefined();
    await wrapper.get('form.cf-workflow-editor').trigger('submit'); await flushPromises();
    expect(wrapper.find('[role="alert"]').exists() ? wrapper.get('[role="alert"]').text() : '').toBe('');
    expect(f.studio.state().settings.workflow?.steps.at(-1)).toMatchObject({ kind: 'council', councilId: 'advice', instructions: 'Compare options and recommend a path.' });
    expect(f.module.actions.snapshot().runs).toHaveLength(0);
  } finally { wrapper.unmount(); await f.dispose(); }
});
