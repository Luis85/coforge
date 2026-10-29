import { nextTick, shallowRef, type ComponentPublicInstance } from 'vue';

/** Only explicit authoring actions request editor focus; ordinary refreshes just update data. */
export function useCouncilDefinitionFocus() {
  const target = shallowRef<HTMLElement | null>(null);
  return {
    bindEditor: (value: Element | ComponentPublicInstance | null) => { target.value = value instanceof HTMLElement ? value : null; },
    reveal: () => { void nextTick(() => {
      const editor = target.value;
      if (!editor?.isConnected) return;
      const name = editor.querySelector('input[aria-label="Definition name"]');
      if (name instanceof HTMLElement) name.focus({ preventScroll: true });
      editor.scrollIntoView({ block: 'start', behavior: 'auto' });
    }); },
  };
}
