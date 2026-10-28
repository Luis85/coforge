import { defineStore } from 'pinia';
import { reactive, watch } from 'vue';
import type { RequestFieldValue } from '../../features/coforge/domain/request-object';
import { useStudioStore } from './coforge-studio';
export interface RequestFieldDraft { values: Record<string, RequestFieldValue>; savedValues: string; expected: string; error: string; notice: string; working: boolean }
export const useRequestFieldDrafts = defineStore('coforge-request-field-drafts', () => {
  const drafts = reactive<Record<string, RequestFieldDraft>>({});
  const studio = useStudioStore();
  watch(() => studio.state, state => {
    if (!state?.exampleRemovalCutoffs) return;
    const retained = new Set(state.ideas.map(idea => idea.id));
    for (const id of Object.keys(drafts))
      if (state.exampleRemovalCutoffs[id] && !retained.has(id)) delete drafts[id];
  }, { flush: 'sync' });
  return { drafts };
});
