// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { expect, it } from 'vitest';
import StudioSidebar from '../../../presentation/components/coforge/StudioSidebar.vue';
import { workflowUiFixture } from './workflow-ui-fixture';

it('opens Economy as one community-owned studio destination without performing a command or charge', async () => {
  const fixture = await workflowUiFixture();
  const wrapper = mount(StudioSidebar, { global: { plugins: [fixture.pinia, fixture.provider], directives: { 'cf-icon': () => {} } } });
  try {
    await flushPromises(); const writes = fixture.storage.saves;
    const community = wrapper.get('[aria-label="Community navigation"]');
    const buttons = community.findAll('button').filter(button => button.text().trim() === 'Economy');
    expect(buttons).toHaveLength(1);
    await buttons[0]!.trigger('click');
    expect(fixture.store.view).toBe('economy');
    expect(fixture.storage.saves).toBe(writes);
    expect(fixture.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await fixture.dispose(); }
});
