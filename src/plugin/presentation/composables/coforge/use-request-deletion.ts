import { computed, onBeforeUnmount, reactive, ref, useId, watch } from 'vue';
import type { RequestDeletionPreview } from '../../../features/coforge/domain/request-deletion';
import { requestDeletionProblem } from '../../../features/coforge/application/request-deletion';
import { useCoforge } from '../../context/coforge-context';
import { useStudioStore } from '../../stores/coforge-studio';
import { useRequestDeletionUiStore } from '../../stores/coforge-request-deletion';
import { useDialogFocus } from './use-dialog-focus';

export function useRequestDeleteControl(props: { ideaId: string }) {
  const store = useStudioStore(); const ui = useRequestDeletionUiStore();
  const problem = computed(() => {
    const state = store.state; const idea = state?.ideas.find(item => item.id === props.ideaId);
    return state && idea ? requestDeletionProblem(state, idea) : 'This request is unavailable.';
  });
  return reactive({ blocked: computed(() => store.busy || !!problem.value), reason: problem,
    open: (event: Event) => { if (!store.busy && !problem.value) ui.open(props.ideaId, event.currentTarget instanceof HTMLElement ? event.currentTarget : null); } });
}

export function useRequestDeletion() {
  const { studio } = useCoforge(); const store = useStudioStore(); const ui = useRequestDeletionUiStore();
  const preview = ref<RequestDeletionPreview | null>(null); const working = ref(''); const error = ref(''); let generation = 0;
  const idea = computed(() => store.state?.ideas.find(item => item.id === ui.ideaId));
  const problem = computed(() => idea.value && store.state ? requestDeletionProblem(store.state, idea.value) : 'This request is unavailable.');
  const key = computed(() => JSON.stringify([idea.value, store.state?.jobs.filter(job => job.ideaId === ui.ideaId)]));
  function close() { if (working.value !== 'delete') ui.close(); }
  async function prepare() {
    if (!ui.ideaId || working.value || store.busy) return;
    const token = ++generation; const id = ui.ideaId; working.value = 'preview'; error.value = ''; preview.value = null;
    try {
      const result = await studio.previewRequestDeletion(id);
      if (token === generation && ui.ideaId === id) preview.value = result;
    } catch (cause) { if (token === generation) error.value = cause instanceof Error ? cause.message : 'Deletion could not be prepared. The request is preserved.'; }
    finally { if (token === generation) working.value = ''; }
  }
  watch(key, () => {
    if (working.value === 'delete') return;
    if (preview.value) { preview.value = null; error.value = 'This request changed. Refresh the deletion preview before confirming.'; }
  });
  watch(() => ui.ideaId, () => { generation++; working.value = ''; preview.value = null; error.value = ''; void prepare(); }, { immediate: true });
  onBeforeUnmount(() => { generation++; });
  const canDelete = computed(() => !!preview.value && !working.value && !store.busy && !problem.value);
  async function confirm() {
    const reviewed = preview.value; if (!reviewed || !canDelete.value) return;
    const token = ++generation; working.value = 'delete'; error.value = '';
    try {
      await store.mutate(() => studio.deleteRequest(reviewed), () => studio.requestDeletionWarning()
        ? `Removed ${reviewed.ideaId} from the board. Its note is preserved for recovery.` : `Deleted ${reviewed.ideaId} from the board. A private recovery copy was kept.`);
      const warning = studio.requestDeletionWarning(); if (warning) store.notify(warning, true);
      if (store.selected === reviewed.ideaId) store.select(null);
      if (token === generation && ui.ideaId === reviewed.ideaId) ui.close();
    } catch (cause) { if (token === generation) { error.value = cause instanceof Error ? cause.message : 'The request could not be deleted. It is preserved.'; preview.value = null; } }
    finally { if (token === generation) working.value = ''; }
  }
  return reactive({ ui, idea, preview, working, error, problem, canDelete, effectsId: useId(), prepare: () => { void prepare(); },
    confirm: () => { void confirm(); }, close, focus: useDialogFocus(close, '[data-request-delete-cancel]') });
}
