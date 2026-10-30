import { computed, onMounted, reactive, watch } from "vue";
import { useCoforge } from "../../context/coforge-context";
import { useStudioStore } from "../../stores/coforge-studio";
import { useObsProductionUi } from "../../stores/obs-production-ui";

/** Read-only production context for saved show actions and output history. */
export function useObsProduction() {
  const { host } = useCoforge();
  const studio = useStudioStore();
  const ui = useObsProductionUi();
  const connected = computed(
    () => studio.state?.runtime.obs?.connection === "connected",
  );
  const canChange = computed(
    () =>
      Boolean(host.obsProduction) &&
      connected.value &&
      ui.snapshot?.context.epoch ===
        studio.state?.runtime.obs?.snapshot?.epoch &&
      ui.snapshot?.context.collection ===
        (studio.state?.runtime.obs?.snapshot?.sceneCollectionVersion ?? 0) &&
      !ui.pending &&
      !studio.state?.runtime.obs?.busy &&
      !studio.state?.runtime.obs?.uncertain,
  );
  function port() {
    if (!host.obsProduction)
      throw new Error(
        "Connect OBS in the Obsidian plugin to inspect show actions.",
      );
    return host.obsProduction;
  }
  async function run(work: () => Promise<void>, success = "") {
    if (ui.pending) return false;
    ui.pending = true;
    ui.error = "";
    ui.notice = "";
    try {
      await work();
      if (success) ui.notice = success;
      return true;
    } catch (error) {
      ui.error =
        error instanceof Error
          ? error.message
          : "OBS state could not be read. Reconnect and refresh its state.";
      return false;
    } finally {
      ui.pending = false;
    }
  }
  async function inspect() {
    const next = await port().inspect();
    const sessionChanged = Boolean(
      ui.snapshot &&
      (ui.snapshot.context.epoch !== next.context.epoch ||
        ui.snapshot.context.collection !== next.context.collection),
    );
    ui.snapshot = next;
    if (sessionChanged) {
      ui.transition = "";
      ui.restartReviewed = false;
      ui.notice =
        "OBS session or scene collection changed. Review the saved show actions before running a cue.";
    }
    if (!ui.transition)
      ui.transition = next.transition?.name ?? next.transitions[0]?.name ?? "";
  }
  return reactive({
    ui,
    studio,
    connected,
    canChange,
    supported: Boolean(host.obsProduction),
    scenes: computed(
      () =>
        ui.snapshot?.broadcast.scenes ??
        studio.state?.runtime.obs?.snapshot?.scenes ??
        [],
    ),
    outputFiles: computed(
      () => studio.state?.obsShow?.outputFiles?.slice().reverse() ?? [],
    ),
    outputRestartRequired: computed(
      () => studio.state?.obsShow?.outputRestartRequired ?? false,
    ),
    refresh: () => run(inspect),
    acknowledgeRestart: () =>
      run(async () => {
        if (!ui.restartReviewed)
          throw new Error(
            "Confirm that you restarted OBS and reviewed its output setup.",
          );
        ui.snapshot = await port().acknowledgeOutputRestart();
        ui.restartReviewed = false;
      }, "Output restart review recorded. Review readiness before broadcasting."),
  });
}

/** Read retained authoring context on entry; live health has its own observation service. */
export function useObsProductionSession() {
  const model = useObsProduction();
  async function refresh() {
    if (
      !model.supported ||
      !model.connected ||
      model.ui.pending ||
      !["show", "setup", "displays", "history"].includes(
        model.studio.broadcastTool,
      ) ||
      model.studio.view !== "broadcast"
    )
      return;
    await model.refresh();
  }
  watch(
    [
      () => model.connected,
      () => model.studio.view,
      () => model.studio.broadcastTool,
      () => model.studio.state?.runtime.obs?.snapshot?.epoch,
      () => model.studio.state?.runtime.obs?.snapshot?.sceneCollectionVersion,
    ],
    () => {
      void refresh();
    },
  );
  onMounted(() => {
    void refresh();
  });
  return model;
}
