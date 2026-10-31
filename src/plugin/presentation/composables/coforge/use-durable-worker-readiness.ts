import { computed, reactive, ref, watch } from "vue";
import { useStudioStore } from "../../stores/coforge-studio";
import { useStudioActions } from "./use-studio-actions";

export function useDurableWorkerReadiness(
  unsaved: () => boolean = () => false,
) {
  const store = useStudioStore();
  const actions = useStudioActions();
  const checking = ref(false);
  const error = ref("");
  const repairing = ref(false);
  const repairConsent = ref(false);
  const repairable = computed(
    () =>
      store.state?.runtime.durableBuild?.ready === false &&
      store.state.runtime.durableBuild.repairable === true,
  );
  watch(
    () =>
      `${store.state?.runtime.durableBuild?.message}:${repairable.value}:${unsaved()}`,
    () => {
      repairConsent.value = false;
    },
  );
  async function check() {
    if (checking.value || unsaved()) return;
    checking.value = true;
    error.value = "";
    try {
      if (!(await actions.checkDurableBuildWorker()))
        error.value =
          store.toasts.at(-1)?.message ??
          "The background worker could not be checked.";
    } finally {
      checking.value = false;
    }
  }
  async function repair() {
    if (
      !repairable.value ||
      !repairConsent.value ||
      repairing.value ||
      unsaved()
    )
      return;
    repairing.value = true;
    error.value = "";
    try {
      if (!(await actions.repairDurableBuildWorker(repairConsent.value)))
        error.value =
          store.toasts.at(-1)?.message ??
          "The unused startup could not be repaired safely.";
    } finally {
      repairing.value = false;
      repairConsent.value = false;
    }
  }
  return reactive({
    checking,
    error,
    repairable,
    repairing,
    repairConsent,
    repairDisabled: computed(
      () =>
        !repairable.value ||
        !repairConsent.value ||
        checking.value ||
        repairing.value ||
        store.busy ||
        unsaved(),
    ),
    ready: computed(() => store.state?.runtime.durableBuild?.ready === true),
    message: computed(
      () =>
        store.state?.runtime.durableBuild?.message ??
        "Background worker readiness has not been checked.",
    ),
    limits: computed(() =>
      store.state
        ? (actions.integration().executionConcurrency ?? {
            builds: 1,
            shortTasks: 1,
          })
        : { builds: 1, shortTasks: 1 },
    ),
    disabled: computed(
      () => checking.value || repairing.value || store.busy || unsaved(),
    ),
    check: () => {
      void check();
    },
    repair: () => {
      void repair();
    },
  });
}
