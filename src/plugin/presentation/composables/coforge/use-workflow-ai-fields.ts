import { computed, reactive } from "vue";
import { useWorkflowEditorForm } from "./use-workflow-editor";
import { configuredStepProblem } from "./configured-workflow-display";
import { WORKFLOW_OUTPUT_LABELS } from "../../stores/workflow-editor-draft";
import type { WorkflowOutput } from "../../../features/coforge/domain/configured-workflow";
import { PROVIDERS } from "./settings-fields";
export function useWorkflowAiFields() {
  const model = useWorkflowEditorForm();
  const step = computed(() =>
    model.selected?.kind === "ai" ? model.selected : undefined,
  );
  const roles = computed(() => {
    const available = new Set<WorkflowOutput>();
    for (const previous of model.draft.steps.slice(
      0,
      model.draft.steps.findIndex((item) => item.id === step.value?.id),
    )) {
      if (previous.kind === "ai") {
        available.add(previous.output);
        if (previous.access === "editworktree") available.add("codechange");
      }
    }
    return Object.entries(WORKFLOW_OUTPUT_LABELS).map(([id, label]) => ({
      id,
      label,
      available: [...available].some((role) => role === id),
    }));
  });
  return reactive({
    step,
    roles,
    providers: PROVIDERS,
    readiness: computed(() =>
      step.value
        ? configuredStepProblem(
            step.value,
            model.project,
            model.store.state?.runtime,
          )
        : "",
    ),
    toggleRole: (role: WorkflowOutput) => {
      const current = step.value;
      if (!current) return;
      const value = new Set(current.inputs);
      if (value.has(role)) value.delete(role);
      else value.add(role);
      current.inputs = [...value];
    },
  });
}
