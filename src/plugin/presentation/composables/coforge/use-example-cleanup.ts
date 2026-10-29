import { computed, reactive, ref, watch } from 'vue';
import { useCoforge } from '../../context/coforge-context';
import { useStudioStore } from '../../stores/coforge-studio';
import type { ExampleCleanupPreview } from '../../../features/coforge/application/example-cleanup-plan';

/** Explicit preview, protected confirmation and recoverable errors for private example cleanup. */
export function useExampleCleanup() {
  const { studio } = useCoforge();
  const store = useStudioStore();
  const preview = ref<ExampleCleanupPreview | null>(null);
  const selected = ref<string[]>([]);
  const confirmed = ref(false);
  const working = ref(false);
  const error = ref('');
  const notice = ref('');
  const limit = ref(50);
  watch(selected, () => { confirmed.value = false; }, { deep: true, flush: 'sync' });
  async function inspect() {
    if (working.value || store.busy) return;
    working.value = true; error.value = ''; notice.value = '';
    try {
      preview.value = await studio.previewExampleCleanup();
      selected.value = []; confirmed.value = false; limit.value = 50;
    } catch (problem) { error.value = problem instanceof Error ? problem.message : 'The cleanup preview could not be loaded. Your content is preserved.'; }
    finally { working.value = false; }
  }
  async function remove() {
    if (!preview.value || !confirmed.value || working.value || store.busy) return;
    const reviewed = preview.value;
    working.value = true; error.value = ''; notice.value = '';
    try {
      const result = await store.mutate(() => studio.removeExampleContent(reviewed, selected.value));
      if (store.selected && !store.state?.ideas.some(idea => idea.id === store.selected)) store.select(null);
      store.closeTemporaryExamples();
      preview.value = null; selected.value = []; confirmed.value = false;
      notice.value = `Removed ${result.requests} example or local-test requests and ${result.profiles} unreferenced local profiles. Temporary examples are closed.`;
      const warning = studio.exampleCleanupWarning();
      if (warning) notice.value += ` ${warning}`;
    } catch (problem) { error.value = problem instanceof Error ? problem.message : 'Cleanup failed. Your preview and selection are kept for retry.'; }
    finally { working.value = false; }
  }
  const historical = computed(() => [...(preview.value?.legacy ?? []).map(item => ({ ...item, label: 'Recognized original sample' })), ...(preview.value?.ambiguous ?? []).map(item => ({ ...item, label: 'Historical origin unknown' }))]);
  return reactive({
    preview, selected, confirmed, working, error, notice, limit,
    disabled: computed(() => working.value || store.busy),
    automatic: computed(() => (preview.value?.automatic ?? []).slice(0, limit.value)),
    moreAutomatic: computed(() => (preview.value?.automatic.length ?? 0) > limit.value),
    historical: computed(() => historical.value.slice(0, limit.value)),
    more: computed(() => historical.value.length > limit.value),
    selectedCount: computed(() => (preview.value?.automatic.length ?? 0) + selected.value.length),
    persistentlyChanging: computed(() => Boolean(preview.value?.hasPersistentChanges || selected.value.length)),
    canRemove: computed(() => Boolean(preview.value && (!preview.value.blocked || (!preview.value.hasPersistentChanges && !selected.value.length)) && confirmed.value && !working.value && !store.busy)),
    inspect: () => { void inspect(); }, remove: () => { void remove(); },
    showMore: () => { limit.value += 50; },
    cancel: () => { if (!working.value) { preview.value = null; selected.value = []; confirmed.value = false; error.value = ''; } },
  });
}
