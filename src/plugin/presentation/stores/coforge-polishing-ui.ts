import { defineStore } from 'pinia';
import { computed, nextTick, ref } from 'vue';

/** Each mounted studio owns its feedback intent and drafts; no canonical data or shared modal singleton. */
export const usePolishingUiStore = defineStore('coforge-polishing-ui', () => {
  const ideaId = ref<string | null>(null); const feedback = ref(''); const invocation = ref(0);
  const drafts = new Map<string, string>(); let trigger: HTMLElement | null = null; let origin: Element | null = null;
  function open(id: string, element?: HTMLElement | null) {
    if (ideaId.value) drafts.set(ideaId.value, feedback.value);
    trigger = element ?? null; origin = element?.closest('.cf-studio') ?? null;
    ideaId.value = id; feedback.value = drafts.get(id) ?? ''; invocation.value++;
  }
  function close(clearDraft = false) {
    const id = ideaId.value;
    if (id) { if (clearDraft) drafts.delete(id); else drafts.set(id, feedback.value); }
    const previous = trigger; const scope = origin; trigger = null; origin = null; ideaId.value = null; feedback.value = ''; invocation.value++;
    void nextTick(() => {
      if (previous?.isConnected) previous.focus();
      else if (scope?.isConnected && id) (scope.querySelector<HTMLElement>(`[data-polishing-trigger="${CSS.escape(id)}"]`)
        ?? scope.querySelector<HTMLElement>(`.cf-idea-card[data-idea-id="${CSS.escape(id)}"]`))?.focus();
    });
  }
  return { ideaId, feedback, invocation, isOpen: computed(() => ideaId.value !== null), open, close };
});
