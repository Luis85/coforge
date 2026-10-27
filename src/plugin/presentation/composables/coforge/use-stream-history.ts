import { computed, onMounted, reactive, ref, watch } from "vue";
import type { StreamSummary } from "../../../features/coforge/domain/stream-metrics";
import { useCoforge } from "../../context/coforge-context";
import { useStudioStore } from "../../stores/coforge-studio";

export function useStreamHistory() {
  const { host } = useCoforge();
  const store = useStudioStore();
  const entries = ref<StreamSummary[]>([]);
  const error = ref("");
  const working = ref(false);
  const notice = ref("");
  watch(
    () => store.state?.runtime.streamRecording?.recent,
    (next) => {
      if (next) entries.value = next;
    },
    { immediate: true },
  );
  watch(entries, (next) => {
    if (!next.some((stream) => stream.id === store.historySelection)) store.historySelection = next[0]?.id ?? "";
  });
  async function run(action: () => Promise<unknown>) {
    working.value = true;
    error.value = "";
    notice.value = "";
    try {
      await store.mutate(action);
    } catch (problem) {
      error.value = problem instanceof Error ? problem.message : "Stream history is unavailable.";
    } finally {
      working.value = false;
    }
  }
  const refresh = () =>
    run(async () => {
      entries.value = await host.streamHistory!.list();
      if (!entries.value.some((stream) => stream.id === store.historySelection))
        store.historySelection = entries.value[0]?.id ?? "";
    });
  onMounted(() => {
    if (host.streamHistory) void refresh();
  });
  return reactive({
    store,
    entries,
    error,
    working,
    notice,
    supported: Boolean(host.streamHistory),
    statistics: () => { store.statisticsStream = store.historySelection; store.navigate('statistics'); },
    message: computed(
      () =>
        store.state?.runtime.streamRecording?.message ??
        "Histories are recorded while a confirmed OBS or Twitch stream is live.",
    ),
    selected: computed(() => entries.value.find((stream) => stream.id === store.historySelection)),
    label: (stream: StreamSummary) =>
      `${new Date(stream.startedAt).toLocaleString()} · ${stream.samples} samples${stream.endedAt ? "" : " · recording"}`,
    refresh: () => {
      if (host.streamHistory) void refresh();
    },
    export: () => {
      if (host.streamHistory && store.historySelection)
        void run(async () => {
          const path = await host.streamHistory!.export(store.historySelection);
          notice.value = `Stream JSON exported to ${path}`;
        });
    },
  });
}
