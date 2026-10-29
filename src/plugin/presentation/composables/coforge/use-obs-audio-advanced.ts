import { computed, reactive, ref, watch } from "vue";
import type {
  ObsAudioMonitor,
  ObsAudioInput,
  ObsProductionInput,
} from "../../../features/coforge/domain/obs-production";
import { useObsProduction } from "./use-obs-production";
export function useObsAudioAdvanced(input: () => ObsProductionInput) {
  const production = useObsProduction();
  const monitor = ref<ObsAudioMonitor>("OBS_MONITORING_TYPE_NONE");
  const offsetMs = ref(0);
  let captured: ObsAudioInput | undefined;
  const tracks = reactive(
    Array.from({ length: 6 }, (_, i) => ({
      id: String(i + 1),
      enabled: false,
    })),
  );
  watch(
    () => input().audio,
    (next) => {
      if (
        !captured ||
        monitor.value === (captured.monitor ?? "OBS_MONITORING_TYPE_NONE")
      )
        monitor.value = next.monitor ?? "OBS_MONITORING_TYPE_NONE";
      if (!captured || offsetMs.value === (captured.syncOffset ?? 0))
        offsetMs.value = next.syncOffset ?? 0;
      for (const track of tracks) {
        if (
          !captured ||
          track.enabled === (captured.tracks?.[track.id] ?? false)
        )
          track.enabled = next.tracks?.[track.id] ?? false;
      }
      captured = { ...next, tracks: next.tracks ? { ...next.tracks } : null };
    },
    { immediate: true },
  );
  return reactive({
    monitor,
    offsetMs,
    tracks,
    canMonitor: computed(
      () => production.canChange && production.supports("input-monitor"),
    ),
    canSync: computed(
      () => production.canChange && production.supports("input-sync"),
    ),
    canTracks: computed(
      () => production.canChange && production.supports("input-tracks"),
    ),
    saveMonitor: () =>
      production.execute({
        kind: "input-monitor",
        inputId: input().id,
        monitor: monitor.value,
      }),
    saveSync: () =>
      production.execute({
        kind: "input-sync",
        inputId: input().id,
        syncOffset: Math.round(offsetMs.value),
      }),
    saveTracks: () =>
      production.execute({
        kind: "input-tracks",
        inputId: input().id,
        tracks: Object.fromEntries(
          tracks.map((track) => [track.id, track.enabled]),
        ),
      }),
  });
}
