import { computed, reactive, ref } from 'vue';
import type { Category } from '../../../features/coforge/domain/types';
import { CATEGORIES } from '../../../features/coforge/domain/types';
import { useStudioStore } from '../../stores/coforge-studio';
import { useDialogFocus } from './use-dialog-focus';
import { useStudioActions } from './use-studio-actions';

/** The "new idea" drawer form. A failed submission keeps the draft open; the failure is also shown as a toast. */
export function useNewIdeaDrawer() {
  const store = useStudioStore();
  const actions = useStudioActions();
  const title = ref('');
  const description = ref('');
  const category = ref<Category>('Gameplay');
  const username = ref('streamer');
  const busy = ref(false);
  const error = ref('');
  const close = () => { store.creating = false; };

  const submit = async () => {
    if (busy.value) return;
    error.value = '';
    busy.value = true;
    try {
      const created = await actions.createIdea({
        title: title.value.trim(),
        description: description.value.trim() || title.value.trim(),
        category: category.value,
        username: username.value.trim(),
      });
      if (created) close();
      else error.value = 'Could not create the idea. Your draft is still here.';
    } finally {
      busy.value = false;
    }
  };

  return reactive({
    title, description, category, username, busy, error,
    categories: CATEGORIES,
    canSubmit: computed(() => !busy.value && Boolean(title.value.trim()) && Boolean(username.value.trim())),
    focus: useDialogFocus(close, 'input'),
    close,
    submit: () => { void submit(); },
  });
}
