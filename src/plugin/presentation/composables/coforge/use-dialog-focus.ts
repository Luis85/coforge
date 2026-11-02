import { onBeforeUnmount, onMounted, type ComponentPublicInstance } from 'vue';

const FOCUSABLE = 'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex]:not([tabindex="-1"])';

/** Closed evidence disclosures and hidden panes must not become focus-trap boundaries. */
function available(element: HTMLElement): boolean {
  if ((element.hasAttribute('tabindex') && element.tabIndex < 0) || element.matches(':disabled, input[type="hidden"]')) return false;
  const view = element.ownerDocument.defaultView;
  for (let current: HTMLElement | null = element; current; current = current.parentElement) {
    if (current.hidden || current.hasAttribute('inert') || current.getAttribute('aria-hidden') === 'true') return false;
    const style = view?.getComputedStyle(current);
    if (style?.display === 'none' || style?.visibility === 'hidden' || style?.visibility === 'collapse') return false;
    if (current.tagName === 'DETAILS' && !current.hasAttribute('open')) {
      const summary = [...current.children].find(child => child.tagName === 'SUMMARY');
      if (!summary?.contains(element)) return false;
    }
  }
  return true;
}

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
    [...(root?.querySelectorAll<HTMLElement>(initial) ?? [])].find(available)?.focus();
  });
  onBeforeUnmount(() => { previous?.focus(); });
  return {
    bind: (element: Element | ComponentPublicInstance | null) => { root = element instanceof HTMLElement ? element : null; },
    keydown: (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopPropagation(); onClose(); return; }
      if (event.key !== 'Tab' || !root) return;
      const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(available);
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
