import { computed, nextTick, reactive, watch } from 'vue';
import type { Idea } from '../../../features/coforge/domain/types';
import { ideaFingerprint } from '../../../features/coforge/domain/integrity';
import { requestObjectValuesCheck, type RequestFieldValue } from '../../../features/coforge/domain/request-object';
import { useCoforge } from '../../context/coforge-context';
import { useStudioStore } from '../../stores/coforge-studio';
import { useRequestFieldDrafts } from '../../stores/coforge-request-field-drafts';
import type { RequestValueChange } from './use-request-object-fields';

const encoded = (values: Readonly<Record<string, RequestFieldValue>> | undefined) => JSON.stringify(Object.entries(values ?? {}).sort(([left], [right]) => left.localeCompare(right)));
export function useRequestValuesEditor(props: { idea: Idea }) {
  const { studio } = useCoforge();
  const store = useStudioStore();
  const state = useRequestFieldDrafts();
  const load = (idea: Idea = props.idea) => {
    state.drafts[idea.id] = { values: { ...idea.requestObject?.values }, savedValues: encoded(idea.requestObject?.values), expected: ideaFingerprint(idea), error: '', notice: '', working: false };
  };
  const cached = state.drafts[props.idea.id];
  if (!cached || (!cached.working && encoded(cached.values) === cached.savedValues && cached.expected !== ideaFingerprint(props.idea))) load();
  const draft = computed(() => state.drafts[props.idea.id]!);
  const dirty = computed(() => encoded(draft.value.values) !== draft.value.savedValues);
  const stale = computed(() => draft.value.expected !== ideaFingerprint(props.idea));
  watch(() => `${props.idea.id}:${ideaFingerprint(props.idea)}`, () => {
    if (!state.drafts[props.idea.id] || (!draft.value.working && !dirty.value)) load();
  });
  const closed = computed(() => ['shipped', 'rejected'].includes(props.idea.status));
  async function save() {
    if (draft.value.working || store.busy || closed.value) return;
    draft.value.error = ''; draft.value.notice = '';
    if (stale.value) { draft.value.error = 'This request changed outside the form. Your draft is kept; discard it to review the latest values.'; return; }
    const current = draft.value;
    const ideaId = props.idea.id;
    try {
      const values = requestObjectValuesCheck(props.idea.requestObject?.fields ?? [], current.values);
      current.working = true;
      await store.mutate(() => studio.updateRequestValues(ideaId, values, current.expected));
      await nextTick();
      const canonical = studio.state().ideas.find(idea => idea.id === ideaId);
      if (canonical) {
        load(canonical);
        state.drafts[ideaId]!.notice = 'Request fields saved. Fresh screening is required before further processing.';
      }
    } catch (problem) { current.error = problem instanceof Error ? problem.message : 'The fields could not be saved. Your draft is kept.'; }
    finally { current.working = false; }
  }
  return reactive({
    draft, dirty, stale, closed,
    update: (change: RequestValueChange) => {
      if (!props.idea.requestObject?.fields.some(field => field.key === change.key)) return;
      if (change.value === undefined) delete draft.value.values[change.key];
      else draft.value.values[change.key] = change.value;
    },
    save: () => { void save(); },
    discard: () => { if (!draft.value.working) load(); },
  });
}
