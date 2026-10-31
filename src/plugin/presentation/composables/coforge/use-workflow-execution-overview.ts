import { computed, reactive } from "vue";
import { useWorkflowEditorForm } from "./use-workflow-editor";
import { buildDuration } from "./durable-build-display";

export function useWorkflowExecutionOverview() {
  const editor = useWorkflowEditorForm();
  return reactive({
    builds: computed(() =>
      editor.draft.steps.flatMap((step) =>
        step.kind === "ai" &&
        step.output === "codechange" &&
        step.access === "editworktree"
          ? [
              {
                id: step.id,
                name: step.name,
                execution: step.execution
                  ? `Background Build · ${step.execution.maxRuntimeSeconds === undefined ? "No elapsed deadline" : buildDuration(step.execution.maxRuntimeSeconds)}`
                  : `Foreground · ${editor.draft.limits.timeoutSeconds} seconds timeout`,
              },
            ]
          : [],
      ),
    ),
    configure: (id: string) => {
      editor.store.openWorkflowTool("settings");
      editor.select(id);
    },
  });
}
