import { setIcon } from 'obsidian';
import type { Directive } from 'vue';

/** `v-cf-icon="'name'"` renders an Obsidian (Lucide) icon into the element. */
export const iconDirective: Directive<HTMLElement, string> = {
  mounted(element, binding) { setIcon(element, binding.value); },
  updated(element, binding) {
    if (binding.value === binding.oldValue) return;
    element.replaceChildren();
    setIcon(element, binding.value);
  },
};
