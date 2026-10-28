import { computed, onBeforeUnmount, reactive, ref } from "vue";
import { useCoforge } from "../../context/coforge-context";
import { STAGE_LABELS } from "../../../features/coforge/domain/types";
import type { HerdrWorkflowState } from "../../../features/coforge/application/herdr-workflow-ports";
/** Recovery never retries dispatch or claims that an external agent has stopped. */
export function useHerdrWorkflowRecovery() {
  const service = useCoforge().host.herdrWorkflows;
  const state = ref<HerdrWorkflowState>(
    service?.snapshot() ?? {
      records: [],
      ready: false,
      busy: false,
      error: "",
    },
  );
  const inspected = ref<Record<string, boolean>>({});
  const checked = ref<Record<string, boolean>>({});
  const working = ref("");
  const error = ref("");
  let closed = false;
  const stop = service?.subscribe((value) => {
    if (!closed) state.value = value;
  });
  onBeforeUnmount(() => {
    closed = true;
    stop?.();
  });
  async function inspect(id: string) {
    if (!service || working.value) return;
    working.value = id;
    error.value = "";
    checked.value[id] = false;
    inspected.value[id] = false;
    try {
      await service.inspect(id);
      if (!closed) inspected.value[id] = true;
    } catch (cause) {
      if (!closed)
        error.value =
          cause instanceof Error
            ? cause.message
            : "The original Herdr agent could not be inspected. Keep this attempt on hold.";
    } finally {
      working.value = "";
    }
  }
  async function acknowledge(id: string) {
    if (!service || working.value || !inspected.value[id] || !checked.value[id])
      return;
    working.value = id;
    error.value = "";
    try {
      await service.acknowledge(id);
      if (!closed) {
        delete checked.value[id];
        delete inspected.value[id];
      }
    } catch (cause) {
      if (!closed) {
        checked.value[id] = false;
        inspected.value[id] = false;
        error.value =
          cause instanceof Error
            ? cause.message
            : "This attempt could not be acknowledged. Inspect the original agent again.";
      }
    } finally {
      working.value = "";
    }
  }
  return reactive({
    state,
    error,
    working,
    checked,
    inspected,
    records: computed(() =>
      state.value.records
        .filter((record) => record.phase === "attention")
        .map((record) => ({
          id: record.id,
          projectId: record.projectId,
          ideaId: record.ideaId,
          stage: STAGE_LABELS[record.stage],
          model: record.model,
          agent: record.target?.name ?? "Launch outcome unknown",
          workspace: record.workspace?.name ?? "Workspace not confirmed",
          inspectionSummary:
            record.inspection === "original-target"
              ? "Original agent identity confirmed in the inspected session. Review its current state and changes before acknowledging."
              : record.inspection === "target-changed"
                ? "The original agent has changed or is no longer present. Review the original session and files manually; its work is not confirmed complete."
                : record.inspection === "session"
                  ? "Only the original session could be inspected; a launched agent was never confirmed. Review that session and project files manually."
                  : "",
        })),
    ),
    inspect: (id: string) => {
      void inspect(id);
    },
    acknowledge: (id: string) => {
      void acknowledge(id);
    },
  });
}
