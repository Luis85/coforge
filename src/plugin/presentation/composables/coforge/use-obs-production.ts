import { obsSourceActions, type ObsUiAction } from "./obs-source-actions";
import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from "vue";
import { useCoforge } from "../../context/coforge-context";
import { useStudioStore } from "../../stores/coforge-studio";
import { useObsProductionUi } from "../../stores/obs-production-ui";
import { obsInputLabel, obsInputInitialProperty } from "./obs-input-label";
import type { ObsProductionKind } from "../../../features/coforge/domain/obs-production";
import { obsTextInputKind } from "../../../features/coforge/domain/obs-production";

export function useObsProduction() {
  const { host } = useCoforge();
  const studio = useStudioStore();
  const ui = useObsProductionUi();
  const connected = computed(
    () => studio.state?.runtime.obs?.connection === "connected",
  );
  const sessionCurrent = computed(
    () =>
      connected.value &&
      Boolean(ui.snapshot) &&
      ui.snapshot?.context.epoch ===
        studio.state?.runtime.obs?.snapshot?.epoch &&
      ui.snapshot?.context.collection ===
        (studio.state?.runtime.obs?.snapshot?.sceneCollectionVersion ?? 0),
  );
  const currentFrames = computed(() => {
    const obs = studio.state?.runtime.obs?.snapshot;
    return (
      connected.value &&
      Boolean(
        obs &&
        ui.snapshot &&
        obs.epoch === ui.snapshot.context.epoch &&
        (obs.sceneCollectionVersion ?? 0) === ui.snapshot.context.collection &&
        (!ui.programFrame || ui.programFrame.sceneId === obs.programSceneId) &&
        (!ui.previewFrame || ui.previewFrame.sceneId === obs.previewSceneId) &&
        (!ui.programFrame ||
          ui.clockNow - Date.parse(ui.programFrame.observedAt) < 15000) &&
        (!ui.previewFrame ||
          ui.clockNow - Date.parse(ui.previewFrame.observedAt) < 15000),
      )
    );
  });
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
  const selected = computed(() =>
    ui.snapshot?.inputs.find((input) => input.id === ui.selectedInput),
  );
  const hiddenUrl = computed(
    () =>
      typeof selected.value?.settings.url === "string" &&
      /\[redacted\]|%5bredacted%5d/i.test(selected.value.settings.url),
  );
  watch(
    () => ui.selectedInput,
    () => {
      ui.filters = [];
      ui.sourceOptions = [];
      ui.sourceOption = "";
      ui.propertyValue = "";
      ui.filterName = "";
      ui.filterSetting = "";
      ui.filterValue = "";
      ui.removeFilterName = "";
      ui.sourceProperty = obsInputInitialProperty(selected.value?.kind ?? "");
      ui.sourceText =
        typeof selected.value?.settings.text === "string"
          ? selected.value.settings.text
          : "";
      ui.sourceUrl =
        typeof selected.value?.settings.url === "string" && !hiddenUrl.value
          ? selected.value.settings.url
          : "";
    },
  );
  watch(
    () => [ui.selectedScene, ui.itemId],
    () => {
      ui.transform = null;
      ui.transformRead = null;
    },
  );
  watch(
    () => ui.filterName,
    () => {
      ui.removeFilterName = "";
    },
  );
  const supports = (kind: ObsProductionKind) =>
    Boolean(ui.snapshot?.available.includes(kind));
  async function run(work: () => Promise<void>, success = "") {
    if (ui.pending) return false;
    ui.pending = true;
    ui.error = "";
    ui.notice = "";
    try {
      await work();
      ui.notice = success;
      return true;
    } catch (error) {
      ui.error =
        error instanceof Error
          ? error.message
          : "OBS did not complete the action. Refresh its state.";
      return false;
    } finally {
      ui.pending = false;
    }
  }
  function port() {
    if (!host.obsProduction)
      throw new Error(
        "Connect OBS in the Obsidian plugin to use production controls.",
      );
    return host.obsProduction;
  }
  async function inspect() {
    const next = await port().inspect();
    const initial = !ui.snapshot;
    const sessionChanged = Boolean(
      ui.snapshot &&
      (ui.snapshot.context.epoch !== next.context.epoch ||
        ui.snapshot.context.collection !== next.context.collection),
    );
    const sceneChanged =
      ui.snapshot?.context.revision !== next.context.revision;
    if (
      ui.snapshot &&
      (ui.snapshot.context.epoch !== next.context.epoch ||
        ui.snapshot.context.collection !== next.context.collection)
    ) {
      ui.programFrame = null;
      ui.previewFrame = null;
      ui.editorFrame = null;
      ui.selectedInput = "";
      ui.selectedScene = "";
      ui.previewScene = "";
      ui.filters = [];
      ui.sourceOptions = [];
      ui.sourceOption = "";
      ui.propertyValue = "";
      ui.sourceText = "";
      ui.sourceUrl = "";
      ui.removeFilterName = "";
      studio.obsEditorDetail = null;
    }
    if (sceneChanged) {
      ui.transform = null;
      ui.transformRead = null;
    }
    if (ui.programFrame?.sceneId !== next.broadcast.programSceneId)
      ui.programFrame = null;
    if (ui.previewFrame?.sceneId !== next.broadcast.previewSceneId)
      ui.previewFrame = null;
    ui.snapshot = next;
    if (!ui.snapshot.inputs.some((input) => input.id === ui.selectedInput))
      ui.selectedInput = initial ? (ui.snapshot.inputs[0]?.id ?? "") : "";
    if (!next.broadcast.scenes.some((scene) => scene.id === ui.selectedScene))
      ui.selectedScene = "";
    if (initial && !ui.selectedScene)
      ui.selectedScene = ui.snapshot.broadcast.programSceneId ?? "";
    if (!next.broadcast.scenes.some((scene) => scene.id === ui.previewScene))
      ui.previewScene = "";
    if (initial && !ui.previewScene)
      ui.previewScene = ui.snapshot.broadcast.previewSceneId ?? "";
    if (sessionChanged)
      ui.notice =
        "OBS session or scene collection changed. Select the intended sources and reload their properties before editing.";
    if (!ui.transition)
      ui.transition =
        ui.snapshot.transition?.name ?? ui.snapshot.transitions[0]?.name ?? "";
  }
  async function frames() {
    const value = ui.snapshot;
    if (!value) return;
    try {
      if (value.broadcast.programSceneId)
        ui.programFrame = await port().frame(value.broadcast.programSceneId);
      if (value.studioMode && value.broadcast.previewSceneId)
        ui.previewFrame = await port().frame(value.broadcast.previewSceneId);
      else ui.previewFrame = null;
      ui.clockNow = Date.now();
    } catch (error) {
      ui.programFrame = null;
      ui.previewFrame = null;
      throw error;
    }
  }
  async function execute(
    action: ObsUiAction,
    success = "OBS confirmed the change.",
  ) {
    return run(async () => {
      if (!ui.snapshot)
        throw new Error("Refresh production state before changing OBS.");
      ui.snapshot = await port().execute({
        ...action,
        expected: ui.snapshot.context,
      });
    }, success);
  }
  const model = reactive({
    ui,
    studio,
    connected,
    editorFrameCurrent: computed(
      () =>
        sessionCurrent.value &&
        Boolean(ui.editorFrame) &&
        ui.clockNow - Date.parse(ui.editorFrame?.observedAt ?? "") < 30000,
    ),
    currentFrames,
    canChange,
    selected,
    supports,
    supported: Boolean(host.obsProduction),
    inputLabel: obsInputLabel,
    isTextInput: obsTextInputKind,
    hiddenUrl,
    outputFiles: computed(
      () => studio.state?.obsShow?.outputFiles?.slice().reverse() ?? [],
    ),
    outputRestartRequired: computed(
      () => studio.state?.obsShow?.outputRestartRequired ?? false,
    ),
    acknowledgeRestart: () =>
      run(async () => {
        if (!ui.restartReviewed)
          throw new Error(
            "Confirm that you restarted OBS and reviewed its output setup.",
          );
        ui.snapshot = await port().acknowledgeOutputRestart();
        ui.restartReviewed = false;
      }, "Output restart review recorded. Rehearse and review readiness before broadcasting."),
    scenes: computed(
      () =>
        ui.snapshot?.broadcast.scenes ??
        studio.state?.runtime.obs?.snapshot?.scenes ??
        [],
    ),
    audioInputs: computed(
      () =>
        ui.snapshot?.inputs.filter(
          (input) =>
            input.audio.volumeDb !== null || input.audio.muted !== null,
        ) ?? [],
    ),
    refresh: () => run(inspect, "Production state refreshed."),
    refreshFrames: () =>
      run(async () => {
        await inspect();
        await frames();
      }, "Sampled images refreshed."),
    execute,
    preview: () => execute({ kind: "preview-scene", sceneId: ui.previewScene }),
    take: () =>
      execute({
        kind: "transition",
        name: ui.transition,
        duration: ui.duration,
      }),
    studioMode: (enabled: boolean) => execute({ kind: "studio-mode", enabled }),
    mute: (id: string, muted: boolean) =>
      execute({ kind: "input-mute", inputId: id, muted }),
    volume: (id: string, event: Event) => {
      const input = event.target;
      if (input instanceof HTMLInputElement)
        void execute({
          kind: "input-volume",
          inputId: id,
          volumeDb: Number(input.value),
        });
    },
    ...obsSourceActions({ ui, studio, host, port, run, execute }),
    saveOutputPreset: () =>
      execute(
        {
          kind: "output-preset",
          preset: ui.outputPreset,
          replayEnabled: ui.replayEnabled,
          replaySeconds: ui.replaySeconds,
        },
        "Output preset saved. Restart OBS once, reconnect and rehearse before broadcasting.",
      ),
    saveVideo: () =>
      execute({ kind: "video-settings", video: { ...ui.video } }),
    saveDirectory: () =>
      execute({ kind: "record-directory", directory: ui.recordDirectory }),
    saveDestination: () =>
      run(async () => {
        if (!ui.snapshot) throw new Error("Refresh production state first.");
        const keySecret = "coforge-obs-output-stream-key";
        await port().saveOutputSecret(keySecret, ui.outputSecret);
        ui.outputSecret = "";
        ui.snapshot = await port().execute({
          kind: "stream-service",
          expected: ui.snapshot.context,
          service: ui.outputService,
          server: ui.outputServer,
          keySecret,
        });
      }, "OBS accepted the destination. Confirm the intended channel/server before going live; delivery is unverified."),
    age: (at?: string | null) =>
      at
        ? `Captured ${new Date(at).toLocaleTimeString()}`
        : "No image captured",
    peak: (db: number | null) =>
      db === null ? "No meter data" : `${db.toFixed(1)} dBFS`,
  });
  return model;
}

/** Reads only while this private live desk is visible; unmount cancels its timer. */
export function useObsProductionSession() {
  const model = useObsProduction();
  const refreshing = ref(false);
  let timer: number | undefined;
  async function refresh() {
    model.ui.clockNow = Date.now();
    if (
      !model.supported ||
      !model.connected ||
      model.ui.pending ||
      refreshing.value ||
      model.studio.broadcastTool !== "live" ||
      model.studio.view !== "broadcast"
    )
      return;
    refreshing.value = true;
    try {
      await model.refreshFrames();
    } finally {
      refreshing.value = false;
    }
  }
  onMounted(() => {
    void refresh();
    timer = window.setInterval(() => {
      void refresh();
    }, 5000);
  });
  onBeforeUnmount(() => {
    if (timer !== undefined) window.clearInterval(timer);
  });
  return model;
}
