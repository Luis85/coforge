import { computed, onBeforeUnmount, reactive, watch } from "vue";
import type {
  ApprovalWorkflowStep,
  ChecklistWorkflowStep,
} from "../../../features/coforge/domain/configured-workflow";
import type { WorkflowRun } from "../../../features/coforge/domain/configured-workflow-run";
import { useCoforge } from "../../context/coforge-context";
import { useStudioStore } from "../../stores/coforge-studio";
import { useConfiguredWorkflowUiStore } from "../../stores/coforge-configured-workflow";
export function useConfiguredManualStep(props: {
  ideaId: string;
  run: WorkflowRun;
  step: ApprovalWorkflowStep | ChecklistWorkflowStep;
}) {
  const { studio } = useCoforge();
  const studioView = useStudioStore();
  const state = useConfiguredWorkflowUiStore();
  const key = computed(
    () => `${props.run.id}:${props.step.id}:${props.run.revision}`,
  );
  watch(
    key,
    (value, previous) => {
      if (previous) delete state.manualDrafts[previous];
      state.manualDrafts[value] ??= {
        checked: [],
        note: "",
        error: "",
        saving: false,
        reviewedRevision: props.run.revision,
      };
    },
    { immediate: true, flush: "sync" },
  );
  const form = computed(() => state.manualDrafts[key.value]!);
  let closed = false;
  onBeforeUnmount(() => {
    closed = true;
  });
  const ready = computed(
    () =>
      !form.value.saving &&
      !studioView.busy &&
      props.run.state === "waiting-human" &&
      (props.step.kind !== "checklist" ||
        props.step.items.every(
          (item) => !item.required || form.value.checked.includes(item.id),
        )),
  );
  async function complete() {
    if (!ready.value) return;
    const reviewed = form.value;
    reviewed.saving = true;
    reviewed.error = "";
    try {
      await studio.completeWorkflowManual(
        props.ideaId,
        reviewed.reviewedRevision,
        [...reviewed.checked],
        reviewed.note.trim(),
      );
    } catch (cause) {
      if (!closed)
        reviewed.error =
          cause instanceof Error
            ? cause.message
            : "This manual step could not be completed. Review its current instructions before trying again.";
    } finally {
      reviewed.saving = false;
    }
  }
  return reactive({
    form,
    ready,
    complete: () => {
      void complete();
    },
  });
}
