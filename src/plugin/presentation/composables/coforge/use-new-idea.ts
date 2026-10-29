import { computed, reactive, ref } from 'vue';
import type { Category } from '../../../features/coforge/domain/types';
import { requestCategoryNames } from '../../../features/coforge/domain/request-categories';
import { useStudioStore } from '../../stores/coforge-studio';
import { useDialogFocus } from './use-dialog-focus';
import { useStudioActions } from './use-studio-actions';
import { captureRequestObject, requestObjectRevision, type RequestFieldValue } from '../../../features/coforge/domain/request-object';
import type { RequestValueChange } from './use-request-object-fields';

/** The "new idea" drawer form. A failed submission keeps the draft open; the failure is also shown as a toast. */
export function useNewIdeaDrawer() {
  const store = useStudioStore();
  const actions = useStudioActions();
  const title = ref('');
  const requestKind = ref<'feature' | 'bug'>('feature');
  const description = ref('');
  const categories = requestCategoryNames(store.activeProject?.settings.requestObject);
  const category = ref<Category>(categories[0]!);
  const username = ref('streamer');
  const busy = ref(false);
  const error = ref('');
  const projectId = store.activeProject?.id ?? '';
  const requestDefinition = captureRequestObject(store.activeProject?.settings.requestObject);
  const definitionRevision = requestObjectRevision(store.activeProject?.settings.requestObject);
  const requestValues = reactive<Record<string, RequestFieldValue>>({ ...requestDefinition?.values });
  const close = () => { store.creating = false; };

  const submit = async () => {
    if (busy.value) return;
    error.value = '';
    if (store.activeProject?.id !== projectId) { error.value = 'The selected project changed. Return to this draft’s project or reopen the form; your draft is kept.'; return; }
    busy.value = true;
    try {
      const created = await actions.createIdea({
        projectId,
        requestObjectRevision: definitionRevision,
        requestValues: { ...requestValues },
        requestKind: requestKind.value,
        title: title.value.trim(),
        description: description.value.trim() || title.value.trim(),
        category: category.value,
        username: username.value.trim(),
      });
      if (created) close();
      else error.value = store.toasts.at(-1)?.message ?? 'Could not create the idea. Your draft is still here.';
    } finally {
      busy.value = false;
    }
  };

  return reactive({
    title, requestKind, description, category, username, busy, error,
    project: computed(() => store.state?.projects?.find(project => project.id === projectId)),
    requestDefinition,
    requestValues,
    setRequestValue: (change: RequestValueChange) => {
      if (!requestDefinition?.fields.some(field => field.key === change.key)) return;
      if (change.value === undefined) delete requestValues[change.key];
      else requestValues[change.key] = change.value;
    },
    categories,
    canSubmit: computed(() => !busy.value && Boolean(title.value.trim()) && Boolean(username.value.trim())),
    focus: useDialogFocus(close, 'input'),
    close,
    submit: () => { void submit(); },
  });
}
