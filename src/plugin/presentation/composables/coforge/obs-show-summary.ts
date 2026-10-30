import { computed, type ComputedRef } from "vue";
import type { ObsShowState } from "../../../features/coforge/domain/obs-show";
import type { useObsShowUi } from "../../stores/obs-show-ui";
import type { useObsProduction } from "./use-obs-production";

function duration(seconds: number): string {
  return seconds < 60
    ? `${seconds}s`
    : `${Math.floor(seconds / 60)}m${seconds % 60 ? ` ${seconds % 60}s` : ""}`;
}

function validDuration(seconds: unknown): seconds is number {
  return (
    typeof seconds === "number" &&
    Number.isSafeInteger(seconds) &&
    seconds >= 0 &&
    seconds <= 14400
  );
}

/** The load picker is independent of the plan currently being edited or run. */
export function obsShowSummary(
  ui: ReturnType<typeof useObsShowUi>,
  state: ComputedRef<ObsShowState>,
  production: ReturnType<typeof useObsProduction>,
  supported: boolean,
) {
  const cue = computed(() =>
    ui.draft?.segments.find((item) => item.id === ui.selectedCue),
  );
  const saved = computed(() =>
    state.value.plans.find((plan) => plan.id === ui.draft?.id),
  );
  const cuePosition = computed(
    () =>
      (ui.draft?.segments.findIndex((item) => item.id === ui.selectedCue) ??
        -1) + 1,
  );
  const runDisabledReason = computed(() => {
    if (!supported) return "Show cues run inside the Obsidian plugin.";
    if (ui.pending) return "Wait for the current show action to finish.";
    if (ui.dirty) return "Save or discard your changes before running a cue.";
    if (!saved.value || !cue.value)
      return "Load a saved show plan and select a segment.";
    if (JSON.stringify(ui.draft) !== JSON.stringify(saved.value))
      return "The saved plan changed. Reload the show plan and review its actions before running a cue.";
    if (!cue.value.steps.length)
      return "Add an action and save the plan before running this cue.";
    if (state.value.run?.status === "running")
      return "Wait for the current cue to finish.";
    if (["failed", "uncertain"].includes(state.value.run?.status ?? ""))
      return "Inspect OBS and acknowledge the partial cue before running another.";
    if (!production.canChange)
      return "Connect OBS and refresh its state before running a cue.";
    return "";
  });
  return {
    cue,
    saved,
    cuePosition,
    canMoveCueEarlier: computed(() => cuePosition.value > 1),
    canMoveCueLater: computed(
      () =>
        cuePosition.value > 0 &&
        cuePosition.value < (ui.draft?.segments.length ?? 0),
    ),
    runDisabledReason,
    canRunCue: computed(() => !runDisabledReason.value),
    segmentDuration: (seconds: unknown) =>
      !validDuration(seconds)
        ? "Invalid duration"
        : seconds > 0
          ? duration(seconds)
          : "No countdown",
    totalDurationLabel: computed(() => {
      const segments = ui.draft?.segments ?? [];
      if (segments.some((segment) => !validDuration(segment.durationSeconds)))
        return "Review segment durations";
      const seconds = segments.reduce(
        (sum, segment) => sum + segment.durationSeconds,
        0,
      );
      const untimed = segments.filter(
        (segment) => !segment.durationSeconds,
      ).length;
      return `${duration(seconds)} planned${untimed ? ` · ${untimed} untimed ${untimed === 1 ? "segment" : "segments"}` : ""}`;
    }),
  };
}
