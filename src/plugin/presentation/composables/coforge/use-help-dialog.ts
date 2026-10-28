import { useStudioStore } from "../../stores/coforge-studio";
import { useDialogFocus } from "./use-dialog-focus";

export function useHelpDialog() {
  const store = useStudioStore();
  const close = () => {
    store.help = false;
  };
  return {
    focus: useDialogFocus(close),
    close,
    start: () => {
      close();
      store.openWorkflowTool("runs");
    },
  };
}
