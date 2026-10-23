import { nextTick, reactive, ref, type ComponentPublicInstance } from 'vue';
import { useStudioStore } from '../../stores/coforge-studio';
import { useStudioActions } from './use-studio-actions';

/**
 * Empty-project state of the board: explains that ideas are vault notes and offers the sample workspace
 * behind an inline confirmation (loading it replaces the project and trashes existing idea notes).
 */
export function useBoardWelcome() {
  const store = useStudioStore();
  const actions = useStudioActions();
  const confirming = ref(false);
  let root: HTMLElement | null = null;
  const focus = (selector: string) => { void nextTick(() => { root?.querySelector<HTMLElement>(selector)?.focus(); }); };
  const replace = async () => {
    if (await actions.loadSample()) confirming.value = false;
  };
  return reactive({
    store,
    confirming,
    folder: actions.integration().ideasFolder.trim(),
    bind: (element: Element | ComponentPublicInstance | null) => { root = element instanceof HTMLElement ? element : null; },
    ask: () => { confirming.value = true; focus('.cf-board-sample-cancel'); },
    cancel: () => { confirming.value = false; focus('.cf-board-sample-ask'); },
    replace: () => { void replace(); },
    startNew: () => { store.creating = true; },
  });
}
