// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { afterEach, expect, it, vi } from 'vitest';
import StudioSidebar from '../../../presentation/components/coforge/StudioSidebar.vue';
import { workflowUiFixture } from './workflow-ui-fixture';

const key = 'coforge:ui:navigation-groups:v1';
afterEach(() => { localStorage.removeItem(key); vi.restoreAllMocks(); document.body.replaceChildren(); });

it('collapses groups independently, restores them after remount and leaves project state untouched', async () => {
  const fixture = await workflowUiFixture();
  const options = { attachTo: document.body, global: { plugins: [fixture.pinia, fixture.provider], stubs: { CfIcon: true } } };
  let wrapper = mount(StudioSidebar, options);
  try {
    const saves = fixture.storage.saves;
    const toggle = wrapper.get('button[aria-label="Collapse Build & Improve"]');
    expect(toggle.attributes('aria-expanded')).toBe('true');
    await toggle.trigger('click');
    expect(wrapper.get('button[aria-label="Expand Build & Improve"]').attributes('aria-expanded')).toBe('false');
    expect(wrapper.get('button[title="Agent workflow"]').isVisible()).toBe(false);
    expect(wrapper.get('button[title="Stream studio"]').isVisible()).toBe(true);
    expect(JSON.parse(localStorage.getItem(key) ?? 'null')).toEqual(['build']);
    wrapper.unmount(); wrapper = mount(StudioSidebar, options);
    expect(wrapper.get('button[title="Agent workflow"]').isVisible()).toBe(false);
    await wrapper.get('button[aria-label="Expand Build & Improve"]').trigger('click');
    expect(wrapper.get('button[title="Agent workflow"]').isVisible()).toBe(true);
    expect(fixture.storage.saves).toBe(saves);
    expect(fixture.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await fixture.dispose(); }
});

it.each(['invalid JSON', '{"build":true}', '["obsolete", 7]'])('ignores malformed or unknown stored groups: %s', async value => {
  localStorage.setItem(key, value);
  const fixture = await workflowUiFixture();
  const wrapper = mount(StudioSidebar, { attachTo: document.body, global: { plugins: [fixture.pinia, fixture.provider], stubs: { CfIcon: true } } });
  try { expect(wrapper.get('button[aria-label="Collapse Build & Improve"]').attributes('aria-expanded')).toBe('true'); }
  finally { wrapper.unmount(); await fixture.dispose(); }
});

it('allows toggling when local storage is unavailable', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Unavailable'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Unavailable'); });
  const fixture = await workflowUiFixture();
  const wrapper = mount(StudioSidebar, { attachTo: document.body, global: { plugins: [fixture.pinia, fixture.provider], stubs: { CfIcon: true } } });
  try {
    await wrapper.get('button[aria-label="Collapse Stream"]').trigger('click');
    expect(wrapper.get('button[title="Stream studio"]').isVisible()).toBe(false);
    expect(wrapper.get('button[aria-label="Expand Stream"]').attributes('aria-expanded')).toBe('false');
  } finally { wrapper.unmount(); await fixture.dispose(); }
});
