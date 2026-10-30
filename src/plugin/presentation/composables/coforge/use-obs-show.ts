import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  toRaw,
} from "vue";
import { useCoforge } from "../../context/coforge-context";
import { useStudioStore } from "../../stores/coforge-studio";
import { useObsShowUi } from "../../stores/obs-show-ui";
import {
  emptyObsShow,
  OBS_SHOW_EVENTS,
  type ObsShowStep,
} from "../../../features/coforge/domain/obs-show";
import { obsMediaInputKind } from "../../../features/coforge/domain/obs-production";
import { useObsProduction } from "./use-obs-production";
import { obsShowSummary } from "./obs-show-summary";
export function useObsShow() {
  const { host } = useCoforge();
  const studio = useStudioStore();
  const ui = useObsShowUi();
  const production = useObsProduction();
  const now = ref(Date.now());
  let timer: number | undefined;
  onMounted(() => {
    timer = window.setInterval(() => {
      now.value = Date.now();
    }, 1000);
  });
  onBeforeUnmount(() => {
    if (timer !== undefined) window.clearInterval(timer);
  });
  const state = computed(() => studio.state?.obsShow ?? emptyObsShow());
  const summary = obsShowSummary(ui, state, production, Boolean(host.obsShow));
  const { cue, saved } = summary;
  function port() {
    if (!host.obsShow)
      throw new Error("Show cues are available inside the Obsidian plugin.");
    return host.obsShow;
  }
  async function run(work: () => Promise<unknown>, success = "") {
    if (ui.pending) return;
    ui.pending = true;
    ui.error = "";
    ui.notice = "";
    try {
      await work();
      if (success) ui.notice = success;
    } catch (error) {
      ui.error =
        error instanceof Error
          ? error.message
          : "The show action could not be completed.";
    } finally {
      ui.pending = false;
    }
  }
  function markDirty() {
    ui.dirty = true;
    ui.notice = "";
  }
  function load() {
    if (ui.pending) return;
    if (ui.dirty) {
      ui.error =
        "Save or discard the current draft before loading another show plan.";
      return;
    }
    const value = state.value.plans.find((plan) => plan.id === ui.selectedPlan);
    ui.draft = value ? structuredClone(toRaw(value)) : null;
    ui.selectedCue = ui.draft?.segments[0]?.id ?? "";
    ui.deleteConfirmation = false;
    ui.error = "";
    ui.notice = "";
  }
  function create() {
    if (ui.pending) return;
    if (ui.dirty) {
      ui.error =
        "Save or discard the current draft before creating another show plan.";
      return;
    }
    const id = crypto.randomUUID();
    ui.selectedPlan = id;
    ui.deleteConfirmation = false;
    ui.draft = {
      id,
      name: "My stream",
      segments: [
        "Starting soon",
        "Development",
        "The Council",
        "Playtest",
        "BRB",
        "Ending",
      ].map((name) => {
        const label = name === "The Council" ? "Council" : name;
        const scene = production.scenes.find(
          (item) => item.name === label || item.name.endsWith(` · ${label}`),
        );
        const steps: ObsShowStep[] = scene
          ? [{ kind: "scene", sceneId: scene.id }]
          : [];
        return {
          id: crypto.randomUUID(),
          name,
          note: "",
          durationSeconds: 0,
          steps,
        };
      }),
      bindings: [],
    };
    ui.selectedCue = ui.draft.segments[0]?.id ?? "";
    markDirty();
  }
  function addStep() {
    if (!cue.value) return;
    let step: ObsShowStep;
    switch (ui.stepKind) {
      case "scene":
        step = { kind: "scene", sceneId: ui.sceneId };
        break;
      case "mute":
        step = { kind: "mute", inputId: ui.inputId, muted: ui.muted };
        break;
      case "volume":
        step = { kind: "volume", inputId: ui.inputId, volumeDb: ui.volumeDb };
        break;
      case "record":
        step = { kind: "record", action: ui.recordAction };
        break;
      case "replay-save":
        step = { kind: "replay-save" };
        break;
      case "media":
        if (
          !production.ui.snapshot?.inputs.some(
            (input) => input.id === ui.inputId && obsMediaInputKind(input.kind),
          )
        ) {
          ui.error =
            "Choose an available OBS Media or VLC source before adding playback. Refresh OBS targets if it is missing.";
          return;
        }
        step = { kind: "media", inputId: ui.inputId, action: ui.mediaAction };
        break;
      case "source-visible":
        step = {
          kind: "source-visible",
          sceneId: ui.sceneId,
          itemId: ui.itemId,
          enabled: ui.visible,
        };
        break;
      case "transition":
        step = {
          kind: "transition",
          sceneId: ui.sceneId,
          name: production.ui.transition,
          duration: production.ui.duration,
        };
        break;
      case "marker":
        step = { kind: "marker", label: ui.marker || cue.value.name };
        break;
      case "overlay":
        step = { kind: "overlay", overlayId: ui.overlayId };
        break;
      default:
        ui.error = "Choose a supported cue action.";
        return;
    }
    cue.value.steps.push(step);
    ui.error = "";
    markDirty();
  }
  function moveStep(index: number, direction: -1 | 1) {
    if (!cue.value) return;
    const next = index + direction;
    if (next < 0 || next >= cue.value.steps.length) return;
    const values = cue.value.steps;
    [values[index], values[next]] = [values[next]!, values[index]!];
    markDirty();
  }
  function describe(step: ObsShowStep) {
    const sceneName = (id: string) =>
      production.scenes.find((scene) => scene.id === id)?.name ?? id;
    const inputName = (id: string) =>
      production.ui.snapshot?.inputs.find((input) => input.id === id)?.name ??
      id;
    switch (step.kind) {
      case "scene":
        return `Switch to ${sceneName(step.sceneId)}`;
      case "mute":
        return `${step.muted ? "Mute" : "Unmute"} ${inputName(step.inputId)}`;
      case "volume":
        return `Set ${inputName(step.inputId)} to ${step.volumeDb} dB`;
      case "record":
        return `${step.action} recording`;
      case "replay-save":
        return "Save replay";
      case "media":
        return `${step.action} ${inputName(step.inputId)}`;
      case "transition":
        return `Take ${sceneName(step.sceneId)} with ${step.name}`;
      case "source-visible":
        return `${step.enabled ? "Show" : "Hide"} item ${step.itemId}`;
      case "marker":
        return `Mark: ${step.label}`;
      case "overlay":
        return `Refresh public overlay: ${state.value.overlays?.find((overlay) => overlay.id === step.overlayId)?.name ?? step.overlayId}`;
    }
  }
  return reactive({
    ui,
    state,
    ...summary,
    production,
    targetInputs: computed(
      () =>
        production.ui.snapshot?.inputs.filter(
          (input) => ui.stepKind !== "media" || obsMediaInputKind(input.kind),
        ) ?? [],
    ),
    events: OBS_SHOW_EVENTS,
    supported: Boolean(host.obsShow),
    recentMarkers: computed(() => state.value.markers.slice(-10).reverse()),
    overlays: computed(() => state.value.overlays ?? []),
    elapsed: computed(() => {
      const value = state.value.run;
      if (!value) return "";
      const seconds = Math.max(
        0,
        Math.floor((now.value - Date.parse(value.startedAt)) / 1000),
      );
      return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    }),
    remaining: computed(() => {
      const value = state.value.run;
      if (!value || !value.durationSeconds) return "";
      const seconds = Math.max(
        0,
        value.durationSeconds -
          Math.floor((now.value - Date.parse(value.startedAt)) / 1000),
      );
      return seconds
        ? `${Math.floor(seconds / 60)}m ${seconds % 60}s remaining`
        : "Planned segment time reached";
    }),
    create,
    load,
    markDirty,
    moveCue: (direction: -1 | 1) => {
      const values = ui.draft?.segments;
      if (!values) return;
      const index = values.findIndex((value) => value.id === ui.selectedCue);
      const next = index + direction;
      if (index < 0 || next < 0 || next >= values.length) return;
      [values[index], values[next]] = [values[next]!, values[index]!];
      markDirty();
    },
    addStep,
    moveStep,
    describe,
    discard: () => {
      if (ui.pending) return;
      ui.dirty = false;
      ui.selectedPlan = ui.draft?.id ?? "";
      load();
    },
    save: () =>
      run(async () => {
        if (ui.draft) {
          const captured = structuredClone(toRaw(ui.draft));
          const next = await port().savePlan(captured);
          ui.dirty = JSON.stringify(ui.draft) !== JSON.stringify(captured);
          if (!ui.dirty) {
            const canonical = next.plans.find(
              (plan) => plan.id === captured.id,
            );
            if (canonical) ui.draft = structuredClone(toRaw(canonical));
          }
          ui.notice = ui.dirty
            ? "Show plan saved. Newer draft changes still need saving."
            : "Show plan saved. Saving never runs a cue.";
        }
      }),
    addCue: () => {
      if (ui.draft) {
        const id = crypto.randomUUID();
        ui.draft.segments.push({
          id,
          name: "New segment",
          note: "",
          durationSeconds: 0,
          steps: [],
        });
        ui.selectedCue = id;
        markDirty();
      }
    },
    removeCue: () => {
      if (ui.draft && ui.draft.segments.length > 1) {
        ui.draft.segments = ui.draft.segments.filter(
          (value) => value.id !== ui.selectedCue,
        );
        ui.draft.bindings = ui.draft.bindings.filter(
          (value) => value.cueId !== ui.selectedCue,
        );
        ui.selectedCue = ui.draft.segments[0]?.id ?? "";
        markDirty();
      }
    },
    removeStep: (index: number) => {
      cue.value?.steps.splice(index, 1);
      markDirty();
    },
    addBinding: () => {
      ui.draft?.bindings.push({
        id: crypto.randomUUID(),
        event: ui.event,
        cueId: ui.selectedCue,
        enabled: false,
      });
      markDirty();
    },
    removeBinding: (id: string) => {
      if (ui.draft) {
        ui.draft.bindings = ui.draft.bindings.filter(
          (binding) => binding.id !== id,
        );
        markDirty();
      }
    },
    runCue: async () => {
      if (ui.pending) return;
      if (summary.runDisabledReason.value) {
        ui.error = summary.runDisabledReason.value;
        return;
      }
      const plan = saved.value;
      if (!plan) return;
      const cueId = ui.selectedCue;
      return run(
        () => port().runCue(plan.id, cueId),
        "Cue completed. Review the observed OBS output.",
      );
    },
    recover: () =>
      run(
        () => port().recover(),
        "Partial cue acknowledged. No actions were replayed.",
      ),
    automation: () =>
      run(() => port().setAutomation(!state.value.automationEnabled)),
    addMarker: () =>
      run(async () => {
        await port().addMarker(ui.marker);
        ui.marker = "";
      }, "Stream moment marked."),
    deletePlan: () =>
      run(async () => {
        if (!saved.value || !ui.deleteConfirmation || ui.dirty)
          throw new Error(
            "Save or discard changes and confirm removal of the loaded plan.",
          );
        await port().deletePlan(saved.value.id);
        ui.draft = null;
        ui.selectedPlan = "";
        ui.dirty = false;
        ui.deleteConfirmation = false;
      }, "Show plan removed."),
  });
}
