import { computed, reactive, ref, watch } from "vue";
import type {
  ObsAudioMonitor,
  ObsProductionInput,
} from "../../../features/coforge/domain/obs-production";
import { useObsProduction } from "./use-obs-production";
export function useObsAudioAdvanced(input: () => ObsProductionInput) {
  const production = useObsProduction();
  const monitor = ref<ObsAudioMonitor>("OBS_MONITORING_TYPE_NONE");
  const offsetMs = ref(0);
  const tracks = reactive(
    Array.from({ length: 6 }, (_, i) => ({
      id: String(i + 1),
      enabled: false,
    })),
  );
  watch(
    () => input().id,
    () => {
      monitor.value = input().audio.monitor ?? "OBS_MONITORING_TYPE_NONE";
      offsetMs.value = (input().audio.syncOffset ?? 0) / 1000000;
      for (const track of tracks)
        track.enabled = input().audio.tracks?.[track.id] ?? false;
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
        syncOffset: Math.round(offsetMs.value * 1000000),
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
