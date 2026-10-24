import { onBeforeUnmount, onMounted, type ComponentPublicInstance } from 'vue';

const FOCUSABLE = 'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible dialog/drawer behaviour: focus moves inside on open, Tab cycles within, Escape closes,
 * and focus returns to the previously focused control on close. Bind `bind` as a function ref and
 * `keydown` on the dialog element; nothing listens on the host document.
 */
export function useDialogFocus(onClose: () => void, initial = FOCUSABLE) {
  let root: HTMLElement | null = null;
  let previous: HTMLElement | null = null;
  onMounted(() => {
    const active = root?.ownerDocument.activeElement;
    previous = active instanceof HTMLElement ? active : null;
    root?.querySelector<HTMLElement>(initial)?.focus();
  });
  onBeforeUnmount(() => { previous?.focus(); });
  return {
    bind: (element: Element | ComponentPublicInstance | null) => { root = element instanceof HTMLElement ? element : null; },
    keydown: (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopPropagation(); onClose(); return; }
      if (event.key !== 'Tab' || !root) return;
      const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = items[0]; const last = items[items.length - 1];
      if (!first || !last) return;
      const active = root.ownerDocument.activeElement;
      if (event.shiftKey && active === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
    },
    /** Closes when the backdrop itself (not the dialog) is pressed. */
    backdrop: (event: MouseEvent) => { if (event.target === event.currentTarget) onClose(); },
  };
}
