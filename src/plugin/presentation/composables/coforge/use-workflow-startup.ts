import { computed } from 'vue';
import { useWorkflowEditorForm } from './use-workflow-editor';

/** Saving a startup preference never changes the current automation session. */
export function useWorkflowStartup() {
  const editor = useWorkflowEditorForm();
  return computed({
    get: () => editor.draft.startupMode ?? 'paused',
    set: (value: 'paused' | 'play') => { editor.draft.startupMode = value; },
  });
}
