// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { expect, it } from 'vitest';
import { useDialogFocus } from '../../../presentation/composables/coforge/use-dialog-focus';

const fixture = () => mount(defineComponent({
  setup() { return { focus: useDialogFocus(() => {}) }; },
  template: `<section :ref="focus.bind" @keydown="focus.keydown">
    <button hidden>Hidden</button>
    <button data-first>First</button>
    <details><summary>Evidence</summary><button data-inner>Expanded evidence action</button></details>
    <div style="display: none"><button>CSS hidden</button></div>
    <div inert><button>Inert</button></div>
  </section>`,
}), { attachTo: document.body });

it('traps focus at a closed disclosure summary without selecting hidden or inert controls', async () => {
  const wrapper = fixture();
  try {
    const first = wrapper.get('[data-first]').element;
    const summary = wrapper.get('summary').element;
    if (!(first instanceof HTMLElement) || !(summary instanceof HTMLElement)) throw new Error('Missing controls');
    expect(document.activeElement).toBe(first);
    await wrapper.get('[data-first]').trigger('keydown', { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(summary);
    await wrapper.get('summary').trigger('keydown', { key: 'Tab' });
    expect(document.activeElement).toBe(first);
  } finally { wrapper.unmount(); }
});

it('includes newly expanded evidence actions and respects negative tab stops', async () => {
  const wrapper = fixture();
  try {
    const first = wrapper.get('[data-first]').element;
    const inner = wrapper.get('[data-inner]').element;
    if (!(first instanceof HTMLElement) || !(inner instanceof HTMLElement)) throw new Error('Missing controls');
    wrapper.get('details').element.setAttribute('open', '');
    inner.focus(); await wrapper.get('[data-inner]').trigger('keydown', { key: 'Tab' });
    expect(document.activeElement).toBe(first);
    inner.tabIndex = -2;
    first.focus(); await wrapper.get('[data-first]').trigger('keydown', { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(wrapper.get('summary').element);
  } finally { wrapper.unmount(); }
});
