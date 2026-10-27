import { computed, onBeforeUnmount, reactive, ref, watch } from "vue";
import { streamSetupProgress } from "../../../features/coforge/domain/stream-setup";
import { useCoforge } from "../../context/coforge-context";
import { useStudioStore } from "../../stores/coforge-studio";
import { useBroadcast } from "./use-broadcast";
import { useTwitch } from "./use-twitch";

export function useStreamSetup() {
  const { studio, host } = useCoforge();
  const store = useStudioStore();
  const obs = useBroadcast(false);
  const twitch = useTwitch();
  const reviewed = ref(false);
  const now = ref(Date.now());
  const error = ref("");
  const working = ref(false);
  const visible = computed(
    () => store.setupRequested || (Boolean(host.obs) && Boolean(store.state) && !store.state?.setupGuide?.dismissed),
  );
  const progress = computed(() =>
    streamSetupProgress({
      obs: obs.state,
      settings: obs.settings,
      twitch: twitch.state,
      integration: studio.integration(),
      outputReviewed: reviewed.value,
      now: Math.max(now.value, Date.now()),
    }),
  );
  const timer = window.setInterval(() => {
    now.value = Date.now();
  }, 1000);
  onBeforeUnmount(() => window.clearInterval(timer));
  async function run(action: () => Promise<unknown>) {
    working.value = true;
    error.value = "";
    try {
      await store.mutate(action);
      return true;
    } catch (problem) {
      error.value = problem instanceof Error ? problem.message : "Setup could not be saved. Try again.";
      return false;
    } finally {
      working.value = false;
    }
  }
  watch(
    visible,
    (open) => {
      if (!open) {
        obs.password = "";
        reviewed.value = false;
        return;
      }
      reviewed.value = false;
      store.setupStep = Math.max(
        0,
        progress.value.steps.findIndex((step) => !step.ready),
      );
      const control = host.obs;
      if (control && !obs.state.installation) void run(() => control.detect());
    },
    { immediate: true },
  );
  watch(
    () => obs.state.snapshot?.epoch,
    () => {
      reviewed.value = false;
    },
  );
  return reactive({
    store,
    obs,
    twitch,
    reviewed,
    error,
    working,
    visible,
    progress,
    step: computed(() => progress.value.steps[store.setupStep] ?? progress.value.steps[0]!),
    open: () => {
      void run(async () => {
        await studio.updateStreamSetup("open");
        store.setupRequested = true;
      });
    },
    dismiss: () => {
      void run(async () => {
        await studio.updateStreamSetup("dismiss");
        store.setupRequested = false;
      });
    },
    next: () => {
      store.setupStep = Math.min(4, store.setupStep + 1);
    },
    back: () => {
      store.setupStep = Math.max(0, store.setupStep - 1);
    },
    finish: () => {
      void run(async () => {
        await studio.updateStreamSetup("complete", reviewed.value);
        store.setupRequested = false;
        store.notify("Setup checked. Prepare stream, then explicitly choose Go live.");
      });
    },
  });
}
