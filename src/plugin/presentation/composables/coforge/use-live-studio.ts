import { computed, onBeforeUnmount, reactive, ref } from "vue";
import { emptyLiveStudio } from "../../../features/coforge/domain/live-studio";
import { useCoforge } from "../../context/coforge-context";
import { useStudioStore } from "../../stores/coforge-studio";
import { statisticNumber } from "./statistics-format";
export function useLiveStudio() {
  const { studio, host } = useCoforge();
  const store = useStudioStore();
  const now = ref(Date.now());
  const timer = window.setInterval(() => {
    now.value = Date.now();
  }, 1000);
  onBeforeUnmount(() => window.clearInterval(timer));
  const example = computed(() =>
    store.studioExampleEnabled ? host.previewLiveStudio?.() : undefined,
  );
  const state = computed(() => {
    if (example.value) {
      void now.value;
      return example.value.telemetry();
    }
    return store.state?.runtime.liveStudio ?? emptyLiveStudio();
  });
  const age = (at: string | null) =>
    at ? Math.max(0, Math.floor((now.value - Date.parse(at)) / 1000)) : null;
  const fresh = (at: string | null, limit: number) => {
    const value = age(at);
    return value !== null && Number.isFinite(value) && value <= limit;
  };
  const channelMatches = computed(
    () =>
      Boolean(example.value) ||
      state.value.channelId ===
        (store.state && studio.integration().twitchBroadcasterId),
  );
  const viewerFresh = computed(
    () => channelMatches.value && fresh(state.value.viewers.checkedAt, 35),
  );
  const obsFresh = computed(
    () =>
      fresh(state.value.obs.checkedAt, 15) &&
      (Boolean(example.value) ||
        (store.state?.runtime.obs?.connection === "connected" &&
          state.value.obs.value?.epoch ===
            store.state.runtime.obs.snapshot?.epoch)),
  );
  const chatFresh = computed(
    () =>
      channelMatches.value &&
      fresh(state.value.chat.checkedAt, 10) &&
      (Boolean(example.value) ||
        store.state?.runtime.twitch?.phase === "connected"),
  );
  const health = (key: string, decimals: number, unit: string) => {
    const value = obsFresh.value ? state.value.obs.value?.health[key] : null;
    return typeof value === "number"
      ? `${statisticNumber(value, decimals)}${unit}`
      : "Unavailable";
  };
  return reactive({
    store,
    state,
    example: computed(() => Boolean(example.value)),
    canPreview: Boolean(host.previewLiveStudio),
    viewer: computed(() =>
      !viewerFresh.value
        ? "Unavailable"
        : state.value.viewers.value?.state === "offline"
          ? "Offline"
          : state.value.viewers.value?.state === "live"
            ? statisticNumber(state.value.viewers.value.viewers)
            : "Unavailable",
    ),
    messages: computed(() =>
      statisticNumber(chatFresh.value ? state.value.chat.messages : null),
    ),
    commands: computed(() =>
      statisticNumber(chatFresh.value ? state.value.chat.commands : null),
    ),
    chatCoverage: computed(() =>
      !chatFresh.value
        ? "Chat is not connected or its reading is stale; no activity count is inferred."
        : state.value.chat.observedSeconds < 60
          ? `Observed for ${Math.floor(state.value.chat.observedSeconds)} seconds; warming up the 60-second window.`
          : "Observed Twitch intake over the last 60 seconds.",
    ),
    viewerStatus: computed(() =>
      !viewerFresh.value && state.value.viewers.checkedAt
        ? "Viewer reading is stale or belongs to a previous connection."
        : state.value.viewers.value?.state === "unavailable" ||
            !state.value.viewers.value
          ? "Connect or reauthorize the streamer to monitor Twitch-reported viewers."
          : "Twitch-reported viewers · refreshed every 15 seconds.",
    ),
    obsStatus: computed(() =>
      !obsFresh.value
        ? "OBS health unavailable or stale. Connect OBS to monitor it."
        : store.state?.runtime.obs?.snapshot?.reconnecting
          ? "OBS is reconnecting the broadcast."
          : state.value.obs.value?.state === "live"
            ? "OBS output is live."
            : "OBS is connected; output is off air.",
    ),
    updated: (at: string | null) => {
      const value = age(at);
      return value === null ? "Waiting for a reading" : `Checked ${value}s ago`;
    },
    healthRows: computed(() => [
      { label: "Bitrate", value: health("bitrateKbps", 0, " kbps") },
      { label: "Active FPS", value: health("stats_activeFps", 1, "") },
      { label: "OBS CPU", value: health("stats_cpuUsage", 1, "%") },
      {
        label: "Dropped output frames",
        value: health("outputDroppedFramePercent", 2, "%"),
      },
    ]),
    preview: () => {
      store.studioExampleEnabled = true;
      store.obsEditorOpen = true;
      store.studioExampleRevision++;
    },
  });
}
