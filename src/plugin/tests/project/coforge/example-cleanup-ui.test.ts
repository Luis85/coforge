// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { expect, it } from 'vitest';
import ExampleContentCleanup from '../../../presentation/components/coforge/ExampleContentCleanup.vue';
import { workflowUiFixture } from './workflow-ui-fixture';

it('previews and cancels without writes, requires confirmation, and keeps a failed preview for retry', async () => {
  const fixture = await workflowUiFixture();
  await fixture.studio.loadSample();
  const wrapper = mount(ExampleContentCleanup, { global: { plugins: [fixture.pinia, fixture.provider] } });
  try {
    const writes = fixture.storage.saves;
    await wrapper.get('button').trigger('click'); await flushPromises();
    expect(wrapper.text()).toContain('15 requests selected');
    expect(fixture.storage.saves).toBe(writes);
    const remove = () => wrapper.findAll('button').find(button => button.text().includes('Remove selected examples'))!;
    expect(remove().attributes('disabled')).toBeDefined();
    await wrapper.findAll('button').find(button => button.text() === 'Keep content')?.trigger('click');
    expect(wrapper.find('.cf-example-cleanup-preview').exists()).toBe(false);
    expect(fixture.storage.saves).toBe(writes);
    await wrapper.get('button').trigger('click'); await flushPromises();
    await wrapper.get('.cf-example-cleanup-consent input').setValue(true);
    fixture.storage.failNextSave = true;
    await remove().trigger('click'); await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('Disk full');
    expect(wrapper.text()).toContain('15 requests selected');
    expect(fixture.studio.state().ideas).toHaveLength(15);
    await remove().trigger('click'); await flushPromises();
    expect(wrapper.get('[role="status"]').text()).toContain('Removed 15');
    expect(fixture.studio.state().ideas).toHaveLength(0);
  } finally { wrapper.unmount(); await fixture.dispose(); }
});
