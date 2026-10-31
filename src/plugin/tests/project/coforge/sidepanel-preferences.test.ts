// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import { afterEach, expect, it, vi } from 'vitest';
import StudioTopbar from '../../../presentation/components/coforge/StudioTopbar.vue';
import { useStudioApp } from '../../../presentation/composables/coforge/use-studio-app';
import { workflowUiFixture } from './workflow-ui-fixture';

const key = 'coforge:ui:sidepanels:v1';
afterEach(() => { localStorage.removeItem(key); vi.restoreAllMocks(); document.body.replaceChildren(); });

it('persists independent panel choices through a fresh studio without saving project data or dispatching', async () => {
  let fixture = await workflowUiFixture();
  fixture.store.view = 'board';
  let wrapper = mount(StudioTopbar, { global: { plugins: [fixture.pinia, fixture.provider], stubs: { CfIcon: true } } });
  try {
    const saves = fixture.storage.saves;
    fixture.store.chatDraft.text = 'Keep the draft';
    await wrapper.get('[aria-label="Collapse navigation panel"]').trigger('click');
    await wrapper.get('[aria-label="Collapse chat panel"]').trigger('click');
    expect(JSON.parse(localStorage.getItem(key) ?? 'null')).toEqual({ navigation: true, chat: true });
    await wrapper.get('[aria-label="Expand chat panel"]').trigger('click');
    expect(JSON.parse(localStorage.getItem(key) ?? 'null')).toEqual({ navigation: true, chat: false });
    expect(fixture.store.chatDraft.text).toBe('Keep the draft');
    expect(fixture.storage.saves).toBe(saves);
    expect(fixture.runner).not.toHaveBeenCalled();
    wrapper.unmount(); await fixture.dispose();
    fixture = await workflowUiFixture(); fixture.store.view = 'board';
    wrapper = mount(StudioTopbar, { global: { plugins: [fixture.pinia, fixture.provider], stubs: { CfIcon: true } } });
    expect(wrapper.get('[aria-label="Expand navigation panel"]').attributes('aria-expanded')).toBe('false');
    expect(wrapper.get('[aria-label="Collapse chat panel"]').attributes('aria-expanded')).toBe('true');
    expect(fixture.store.rightPanelManual).toBe(true);
  } finally { wrapper.unmount(); await fixture.dispose(); }
});

it.each([true, false])('restores an explicit chat preference of %s before responsive startup', async collapsed => {
  localStorage.setItem(key, JSON.stringify({ navigation: true, chat: collapsed }));
  const fixture = await workflowUiFixture();
  let bind: ReturnType<typeof useStudioApp>['bindRoot'] | undefined;
  const Probe = defineComponent({ setup() { bind = useStudioApp().bindRoot; return () => h('div'); } });
  const wrapper = mount(Probe, { global: { plugins: [fixture.pinia, fixture.provider] } });
  try {
    for (const width of [360, 1400]) {
      const root = document.createElement('div');
      vi.spyOn(root, 'getBoundingClientRect').mockReturnValue({ ...root.getBoundingClientRect(), width });
      bind?.(root); await flushPromises();
      expect(fixture.store.rightPanelCollapsed).toBe(collapsed);
      expect(fixture.store.leftPanelCollapsed).toBe(true);
    }
    expect(JSON.parse(localStorage.getItem(key) ?? 'null')).toEqual({ navigation: true, chat: collapsed });
  } finally { wrapper.unmount(); await fixture.dispose(); }
});

it('retains responsive defaults without storing them as explicit chat choices', async () => {
  const fixture = await workflowUiFixture();
  let bind: ReturnType<typeof useStudioApp>['bindRoot'] | undefined;
  const Probe = defineComponent({ setup() { bind = useStudioApp().bindRoot; return () => h('div'); } });
  const wrapper = mount(Probe, { global: { plugins: [fixture.pinia, fixture.provider] } });
  try {
    for (const width of [360, 1400]) {
      const root = document.createElement('div');
      vi.spyOn(root, 'getBoundingClientRect').mockReturnValue({ ...root.getBoundingClientRect(), width });
      bind?.(root); await flushPromises();
      expect(fixture.store.rightPanelCollapsed).toBe(width < 1050);
      expect(fixture.store.rightPanelManual).toBe(false);
      expect(localStorage.getItem(key)).toBeNull();
    }
  } finally { wrapper.unmount(); await fixture.dispose(); }
});

it('merges one panel change with the latest preference from another view', async () => {
  const first = await workflowUiFixture(); const second = await workflowUiFixture();
  try {
    first.store.leftPanelCollapsed = true;
    second.store.rightPanelManual = true; second.store.rightPanelCollapsed = true;
    await flushPromises();
    expect(JSON.parse(localStorage.getItem(key) ?? 'null')).toEqual({ navigation: true, chat: true });
  } finally { await first.dispose(); await second.dispose(); }
});

it.each(['invalid JSON', 'null', '[]', '{"navigation":"true","chat":7}'])('ignores malformed stored panel preferences: %s', async stored => {
  localStorage.setItem(key, stored);
  const fixture = await workflowUiFixture();
  try {
    expect(fixture.store.leftPanelCollapsed).toBe(false);
    expect(fixture.store.rightPanelManual).toBe(false);
  } finally { await fixture.dispose(); }
});

it.each([
  { stored: { navigation: true, chat: 'invalid' }, navigation: true, manual: false },
  { stored: { navigation: 'invalid', chat: false }, navigation: false, manual: true },
])('preserves the valid panel preference when its sibling is malformed: $manual', async ({ stored, navigation, manual }) => {
  localStorage.setItem(key, JSON.stringify(stored));
  const fixture = await workflowUiFixture();
  try {
    expect(fixture.store.leftPanelCollapsed).toBe(navigation);
    expect(fixture.store.rightPanelCollapsed).toBe(false);
    expect(fixture.store.rightPanelManual).toBe(manual);
  } finally { await fixture.dispose(); }
});

it('continues toggling when localStorage is blocked', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Unavailable'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Unavailable'); });
  const fixture = await workflowUiFixture();
  try {
    fixture.store.leftPanelCollapsed = true;
    fixture.store.rightPanelManual = true; fixture.store.rightPanelCollapsed = true;
    await flushPromises();
    expect(fixture.store.leftPanelCollapsed).toBe(true);
    expect(fixture.store.rightPanelCollapsed).toBe(true);
  } finally { await fixture.dispose(); }
});
