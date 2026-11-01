import { computed, reactive, ref, watch } from "vue";
import type { AgentJob } from "../../../features/coforge/domain/types";
import { sameDurableBuildRef } from "../../../features/coforge/domain/durable-build";
import { useStudioStore } from "../../stores/coforge-studio";
import { useStudioActions } from "./use-studio-actions";
import { ideaWorkflowRun } from './idea-workflow-run';

export function useDurableBuildRecovery(
  ideaId: () => string,
  runId: () => string | undefined,
  job: () => AgentJob | undefined,
) {
  const store = useStudioStore();
  const actions = useStudioActions();
  const consent = ref(false);
  const working = ref("");
  const error = ref("");
  const run = computed(
    () => ideaWorkflowRun(store.state?.ideas.find((item) => item.id === ideaId()), runId()),
  );
  const receipt = computed(() => {
    const current = job();
    const value =
      current && store.state?.runtime.durableBuildInspections?.[current.id];
    return current?.durable &&
      value &&
      value.ideaId === ideaId() &&
      value.runId === runId() &&
      value.runRevision === run.value?.revision &&
      sameDurableBuildRef(current.durable.ref, value.ref)
      ? value
      : undefined;
  });
  const context = computed(
    () =>
      `${ideaId()}:${runId()}:${run.value?.revision}:${job()?.durable?.ref.executionId}`,
  );
  watch(
    () =>
      `${context.value}:${receipt.value?.evidenceHash}:${receipt.value?.observedAt}`,
    () => {
      consent.value = false;
      error.value = "";
    },
  );
  async function perform(kind: "inspect" | "recover") {
    const current = job();
    const active = run.value;
    if (
      working.value ||
      !current?.durable ||
      !active ||
      active.id !== runId() ||
      (kind === "recover" && (!receipt.value || !consent.value))
    )
      return;
    const key = context.value;
    working.value = kind;
    error.value = "";
    try {
      const ok =
        kind === "inspect"
          ? await actions.inspectDurableBuildEvidence(ideaId(), active.revision, active.id)
          : await actions.recoverDurableBuild(
              ideaId(),
              active.revision,
              consent.value,
              active.id,
            );
      if (!ok && context.value === key)
        error.value =
          store.toasts.at(-1)?.message ??
          "The original Build could not be recovered. Its evidence and hold are retained.";
    } finally {
      working.value = "";
    }
  }
  return reactive({
    receipt,
    consent,
    working,
    error,
    canRecover: computed(() =>
      Boolean(receipt.value && consent.value && !working.value),
    ),
    inspectionTime: computed(() =>
      receipt.value ? new Date(receipt.value.observedAt).toLocaleString() : "",
    ),
    inspectedPhase: computed(() => receipt.value?.snapshot.phase),
    inspect: () => {
      void perform("inspect");
    },
    recover: () => {
      void perform("recover");
    },
  });
}
