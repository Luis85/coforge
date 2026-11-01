import { defineStore } from 'pinia';
import { computed, nextTick, ref } from 'vue';

export const useRequestDeletionUiStore = defineStore('coforge-request-deletion', () => {
  const ideaId = ref<string | null>(null); let trigger: HTMLElement | null = null; let scope: Element | null = null;
  function open(id: string, element?: HTMLElement | null) {
    trigger = element ?? null; scope = element?.closest('.cf-studio') ?? null; ideaId.value = id;
  }
  function close() {
    const previous = trigger; const owner = scope; trigger = null; scope = null; ideaId.value = null;
    void nextTick(() => {
      if (previous?.isConnected) previous.focus();
      else owner?.querySelector<HTMLElement>('.cf-board-page .cf-page-heading button, .cf-board-toolbar button')?.focus();
    });
  }
  return { ideaId, isOpen: computed(() => ideaId.value !== null), open, close };
});
