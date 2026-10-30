import { useStudioStore } from "../../stores/coforge-studio";
import { useDialogFocus } from "./use-dialog-focus";
import { computed } from 'vue';

export function useHelpDialog() {
  const store = useStudioStore();
  const close = () => {
    store.help = false;
  };
  return {
    focus: useDialogFocus(close),
    close,
    startLabel: computed(() => store.featureEnabled('workflow') ? 'Explore the agent workflow' : 'Choose project features'),
    start: () => {
      close();
      if (store.featureEnabled('workflow')) store.openWorkflowTool("runs");
      else store.openSettingsTool('general');
    },
  };
}
