// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { afterEach, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { Window } from 'happy-dom';
import ToastStack from '../../../presentation/components/coforge/ToastStack.vue';
import { useToastPlacement } from '../../../presentation/composables/coforge/use-toast-placement';
import { workflowUiFixture } from './workflow-ui-fixture';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); document.body.replaceChildren(); });

it.each(['cf-idea-footer', 'cf-settings-save', 'cf-idea-form-footer', 'cf-active-job-dock'])('keeps notifications above the measured %s and responds to footer wrapping', async footerClass => {
  const f = await workflowUiFixture();
  const root = document.createElement('div'); root.className = 'cf-studio'; document.body.append(root);
  const footer = document.createElement('footer'); footer.className = footerClass; root.append(footer);
  const heading = document.createElement('div'); heading.className = 'cf-idea-tabs'; root.append(heading);
  let footerTop = 640; let frame: FrameRequestCallback | undefined;
  const callbacks: (() => void)[] = []; const disconnect = vi.fn(); const cancel = vi.fn();
  vi.stubGlobal('ResizeObserver', class { constructor(callback: ResizeObserverCallback) { callbacks.push(() => callback([], this)); } observe() {} unobserve() {} disconnect = disconnect; });
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => { frame = callback; return 1; });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(cancel);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function(this: HTMLElement) {
    if (this === root) return new DOMRect(0, 0, 600, 800);
    if (this === footer) return new DOMRect(0, footerTop, 600, 800 - footerTop);
    if (this === heading) return new DOMRect(0, 80, 600, 40);
    return new DOMRect(300, 700, 280, 60);
  });
  const wrapper = mount(ToastStack, { attachTo: root, global: { plugins: [f.pinia], directives: { 'cf-icon': () => {} } } });
  const stack = wrapper.element;
  if (!(stack instanceof HTMLElement)) throw new Error('Missing toast stack');
  const flushFrame = () => { const pending = frame; frame = undefined; pending?.(0); };
  try {
    flushFrame(); await wrapper.vm.$nextTick();
    expect(stack.style.bottom).toBe('168px');
    footerTop = 520;
    callbacks.forEach(callback => callback());
    flushFrame(); await wrapper.vm.$nextTick();
    expect(stack.style.bottom).toBe('288px');
    expect(Number.parseFloat(stack.style.maxHeight)).toBeLessThanOrEqual(384);
    window.dispatchEvent(new Event('resize'));
    const beforeUnmount = disconnect.mock.calls.length;
    wrapper.unmount();
    expect(disconnect.mock.calls.length).toBeGreaterThan(beforeUnmount); expect(cancel).toHaveBeenCalled();
  } finally { if (wrapper.exists()) wrapper.unmount(); root.remove(); await f.dispose(); }
});

it('accepts a foreign-document DOM ref and schedules and cleans up in its owning pop-out window', async () => {
  const foreign = new Window(); foreign.innerHeight = 500;
  const root = foreign.document.createElement('div'); root.className = 'cf-studio';
  const stack = foreign.document.createElement('div'); stack.className = 'cf-toast-stack'; root.append(stack); foreign.document.body.append(root);
  vi.spyOn(root, 'getBoundingClientRect').mockReturnValue(new foreign.DOMRect(0, 0, 600, 800));
  vi.spyOn(stack, 'getBoundingClientRect').mockReturnValue(new foreign.DOMRect(300, 400, 280, 60));
  const handle = foreign.requestAnimationFrame(() => {}); foreign.cancelAnimationFrame(handle);
  const frame = vi.spyOn(foreign, 'requestAnimationFrame').mockReturnValue(handle);
  const cancel = vi.spyOn(foreign, 'cancelAnimationFrame');
  const remove = vi.spyOn(foreign, 'removeEventListener');
  const Probe = defineComponent({ setup() { const placement = useToastPlacement(); placement.bind(stack); return () => h('div', { style: placement.style.value }); } });
  const wrapper = mount(Probe);
  try {
    await wrapper.vm.$nextTick();
    expect(wrapper.attributes('style')).toContain('bottom: 308px');
    foreign.dispatchEvent(new foreign.Event('resize'));
    expect(frame).toHaveBeenCalled();
    wrapper.unmount();
    expect(cancel).toHaveBeenCalledWith(handle);
    expect(remove).toHaveBeenCalledWith('resize', expect.any(Function));
  } finally { if (wrapper.exists()) wrapper.unmount(); await foreign.happyDOM.close(); }
});
