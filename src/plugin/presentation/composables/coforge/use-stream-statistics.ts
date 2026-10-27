import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import {
  comparisonCandidates,
  metricSeries,
  statisticsSummary,
} from "../../../features/coforge/domain/stream-statistics";
import { STATISTICS_METRICS, statisticsMetric } from "../../../features/coforge/domain/statistics-metrics";
import {
  summarizeStream,
  type StreamHistory,
  type StreamSummary,
} from "../../../features/coforge/domain/stream-metrics";
import { useCoforge } from "../../context/coforge-context";
import { useStudioStore } from "../../stores/coforge-studio";
import { elapsedTime, statisticNumber, streamDate } from "./statistics-format";
const comparisonRows = [
  { key: "meanViewers", label: "Mean observed viewers", decimals: 1 },
  { key: "peakViewers", label: "Peak observed viewers", decimals: 0 },
  { key: "followers", label: "Observed follower change", decimals: 0 },
  { key: "subscribers", label: "Observed subscriber change", decimals: 0 },
  { key: "chatMessages", label: "Observed Twitch messages", decimals: 0 },
  { key: "requests", label: "Feature requests", decimals: 0 },
  { key: "bugs", label: "Bug reports", decimals: 0 },
  { key: "votes", label: "Votes", decimals: 0 },
  { key: "samples", label: "Minute samples", decimals: 0 },
  { key: "missingMinutes", label: "Missing recorded minutes", decimals: 1 },
] as const;

export function useStreamStatistics() {
  const { host } = useCoforge();
  const store = useStudioStore();
  const entries = ref<StreamSummary[]>([]);
  const histories = ref<StreamHistory[]>([]);
  const loading = ref(false);
  const listing = ref(false);
  const error = ref("");
  const notice = ref("");
  const example = ref(false);
  let examples: StreamHistory[] = [];
  let revision = 0;
  let listRevision = 0;
  let initialized = false;
  let closed = false;
  const ordered = (values: StreamSummary[]) =>
    [...values].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
  const selected = computed(() => entries.value.find((stream) => stream.id === store.statisticsStream));
  const candidates = computed(() => (selected.value ? comparisonCandidates(selected.value, entries.value) : []));
  const metric = computed(() => statisticsMetric(store.statisticsMetric));
  const series = computed(() => histories.value.map((history) => metricSeries(history, store.statisticsMetric)));
  async function load() {
    const current = ++revision;
    loading.value = true;
    error.value = "";
    histories.value = [];
    const ids = [store.statisticsStream, ...store.statisticsComparisons].filter(Boolean);
    try {
      const result = await Promise.allSettled(
        ids.map((id) =>
          example.value
            ? Promise.resolve(examples.find((history) => history.id === id) ?? null)
            : host.streamHistory!.read(id),
        ),
      );
      if (closed || current !== revision) return;
      const primary = result[0];
      if (!primary || primary.status !== "fulfilled" || !primary.value)
        throw new Error("The selected stream history could not be read. Refresh or choose another stream.");
      const first = primary.value;
      histories.value = [
        first,
        ...result
          .slice(1)
          .flatMap((item) =>
            item.status === "fulfilled" &&
            item.value &&
            item.value.id !== first.id &&
            item.value.channelId === first.channelId &&
            item.value.endedAt &&
            Date.parse(item.value.startedAt) < Date.parse(first.startedAt)
              ? [item.value]
              : [],
          ),
      ];
      if (histories.value.length !== ids.length)
        error.value = "One comparison history is unavailable. Its line is omitted; remove it or refresh.";
      entries.value = ordered(
        entries.value.map((entry) => {
          const history = histories.value.find((history) => history.id === entry.id);
          return history ? summarizeStream(history) : entry;
        }),
      );
    } catch (problem) {
      if (!closed && current === revision)
        error.value = problem instanceof Error ? problem.message : "Stream statistics could not be loaded.";
    } finally {
      if (!closed && current === revision) loading.value = false;
    }
  }
  watch(
    () => `${store.statisticsStream}\n${store.statisticsComparisons.join("|")}`,
    (next, previous) => {
      if (!store.statisticsStream) {
        revision++;
        histories.value = [];
        loading.value = false;
        return;
      }
      const changed = next.split("\n")[0] !== previous?.split("\n")[0];
      const allowed = candidates.value.map((stream) => stream.id);
      const comparisons = changed
        ? allowed.slice(0, 1)
        : store.statisticsComparisons.filter((id) => allowed.includes(id)).slice(0, 3);
      if (comparisons.join("|") !== store.statisticsComparisons.join("|")) {
        store.statisticsComparisons = comparisons;
        return;
      }
      store.statisticsPage = 0;
      void load();
    },
  );
  watch(
    () => store.statisticsMetric,
    () => {
      store.statisticsPage = 0;
    },
  );
  async function refresh() {
    const current = ++listRevision;
    listing.value = true;
    const previous = store.statisticsStream;
    try {
      error.value = "";
      const streams = example.value ? examples.map(summarizeStream) : await host.streamHistory!.list();
      if (closed || current !== listRevision) return;
      entries.value = ordered(streams);
      if (!entries.value.some((stream) => stream.id === store.statisticsStream))
        store.statisticsStream = entries.value[0]?.id ?? "";
      const initial = !initialized;
      initialized = true;
      if (
        initial &&
        previous &&
        previous === store.statisticsStream &&
        !store.statisticsComparisons.length &&
        candidates.value[0]
      ) {
        store.statisticsComparisons = [candidates.value[0].id];
        return;
      }
      if (previous && previous === store.statisticsStream) await load();
    } catch {
      if (!closed && current === listRevision)
        error.value = "Stream histories could not be listed. Check CoForge/Streams and try again.";
    } finally {
      if (!closed && current === listRevision) listing.value = false;
    }
  }
  watch(
    () => store.state?.runtime.streamRecording?.recent,
    (next) => {
      if (!next || example.value) return;
      const before = selected.value;
      const after = next.find((stream) => stream.id === store.statisticsStream);
      const changedIds =
        ordered(next)
          .map((stream) => stream.id)
          .join("|") !== entries.value.map((stream) => stream.id).join("|");
      if (
        changedIds ||
        (before &&
          after &&
          `${before.lastSampleAt}|${before.endedAt}|${before.samples}` !==
            `${after.lastSampleAt}|${after.endedAt}|${after.samples}`)
      )
        void refresh();
    },
  );
  onMounted(() => {
    if (host.streamHistory) void refresh();
  });
  onBeforeUnmount(() => {
    closed = true;
    revision++;
  });
  return reactive({
    comparisonRows,
    store,
    entries,
    histories,
    loading: computed(() => loading.value || listing.value),
    error,
    notice,
    example,
    candidates,
    metric,
    series,
    selected,
    failedComparisons: computed(() =>
      histories.value.length
        ? store.statisticsComparisons
            .filter((id) => !histories.value.some((history) => history.id === id))
            .map((id) => ({ id, date: entries.value.find((entry) => entry.id === id)?.startedAt }))
        : [],
    ),
    canPreview: Boolean(host.previewStreamStatistics),
    supported: Boolean(host.streamHistory),
    groups: [...new Set(STATISTICS_METRICS.map((metric) => metric.group))],
    metrics: STATISTICS_METRICS,
    label: (stream: StreamSummary) =>
      `${streamDate(stream.startedAt)} · ${stream.samples} samples${stream.endedAt ? "" : " · recording"}`,
    streamDate,
    format: statisticNumber,
    elapsed: elapsedTime,
    title: computed(
      () =>
        histories.value[0]?.samples.find((sample) => sample.twitch.channel)?.twitch.channel?.title ||
        (selected.value ? `Stream on ${streamDate(selected.value.startedAt)}` : "Choose a recorded stream"),
    ),
    summaries: computed(() =>
      histories.value.map((history) => ({
        id: history.id,
        date: streamDate(history.startedAt),
        ...statisticsSummary(history),
      })),
    ),
    rows: computed(
      () => series.value[0]?.points.slice(store.statisticsPage * 50, (store.statisticsPage + 1) * 50) ?? [],
    ),
    rowCount: computed(() => series.value[0]?.points.length ?? 0),
    refresh: () => {
      if (host.streamHistory || example.value) void refresh();
    },
    preview: () => {
      examples = host.previewStreamStatistics?.() ?? [];
      example.value = true;
      void refresh();
    },
    addComparison: (event: Event) => {
      const target = event.target;
      if (
        target instanceof HTMLSelectElement &&
        target.value &&
        !store.statisticsComparisons.includes(target.value) &&
        store.statisticsComparisons.length < 3
      ) {
        store.statisticsComparisons = [...store.statisticsComparisons, target.value];
        target.value = "";
      }
    },
    removeComparison: (id: string) => {
      store.statisticsComparisons = store.statisticsComparisons.filter((value) => value !== id);
    },
    previousPage: () => {
      store.statisticsPage = Math.max(0, store.statisticsPage - 1);
    },
    nextPage: () => {
      if ((store.statisticsPage + 1) * 50 < (series.value[0]?.points.length ?? 0)) store.statisticsPage++;
    },
    export: () => {
      if (!example.value && host.streamHistory && store.statisticsStream)
        void store
          .mutate(async () => {
            const path = await host.streamHistory!.export(store.statisticsStream);
            notice.value = `Stream JSON exported to ${path}`;
          })
          .catch(() => {
            error.value = "The selected stream could not be exported.";
          });
    },
  });
}
