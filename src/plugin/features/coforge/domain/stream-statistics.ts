import type { StreamHistory, StreamSummary } from "./stream-metrics";
import { summarizeStream } from "./stream-metrics";
import { statisticsMetric, type StatisticsMetricId } from "./statistics-metrics";
export interface MetricPoint {
  minute: number;
  value: number | null;
  at: string;
  breakBefore: boolean;
  gapSeconds: number;
}
export interface StatisticsSeries {
  id: string;
  startedAt: string;
  points: MetricPoint[];
  missing: number;
  sampled: number;
}
export function metricSeries(history: StreamHistory, id: StatisticsMetricId): StatisticsSeries {
  const definition = statisticsMetric(id);
  const last = history.samples.at(-1);
  const observations = [
    ...history.samples,
    ...(definition.includeFinal &&
    history.finalSnapshot &&
    (!last || Date.parse(history.finalSnapshot.at) > Date.parse(last.at))
      ? [history.finalSnapshot]
      : []),
  ];
  const baseline = definition.growth ? (observations.map(definition.read).find((value) => value !== null) ?? null) : 0;
  const points: MetricPoint[] = observations.map((sample, index) => {
    const raw = definition.read(sample);
    const previous = observations[index - 1];
    const minute = Math.max(0, (Date.parse(sample.at) - Date.parse(history.startedAt)) / 60000);
    return {
      minute,
      at: sample.at,
      value: raw === null || baseline === null ? null : raw - baseline,
      gapSeconds: sample.gapSeconds,
      breakBefore:
        !previous ||
        definition.read(previous) === null ||
        sample.gapSeconds > 0 ||
        Date.parse(sample.at) - Date.parse(previous.at) > 90000,
    };
  });
  return {
    id: history.id,
    startedAt: history.startedAt,
    points,
    missing: points.filter((point) => point.value === null).length,
    sampled: points.length,
  };
}
export function comparisonCandidates(
  selected: Pick<StreamHistory, "id" | "startedAt" | "channelId">,
  streams: readonly StreamSummary[],
): StreamSummary[] {
  return streams
    .filter(
      (stream) =>
        stream.id !== selected.id &&
        stream.channelId === selected.channelId &&
        stream.endedAt &&
        Date.parse(stream.startedAt) < Date.parse(selected.startedAt),
    )
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt) || a.id.localeCompare(b.id));
}
export function statisticsSummary(history: StreamHistory) {
  const values = metricSeries(history, "viewers").points.flatMap((point) =>
    point.value === null ? [] : [point.value],
  );
  const final = history.finalSnapshot ?? history.samples.at(-1);
  const counter = (key: string) => (final ? (final.coforge.streamCounters[key] ?? 0) : null);
  const observed = summarizeStream(history);
  return {
    samples: history.samples.length,
    peakViewers: values.length ? values.reduce((max, value) => Math.max(max, value), 0) : null,
    meanViewers: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
    followers: observed.followerNetChange ?? null,
    subscribers: observed.subscriberNetChange ?? null,
    chatMessages: counter("twitch-message-observed"),
    requests: counter("request-created"),
    bugs: counter("bug-created"),
    votes: counter("vote-counted"),
    missingMinutes: history.samples.length
      ? history.samples.reduce((sum, sample) => sum + sample.gapSeconds, 0) / 60 +
        (history.finalSnapshot?.gapSeconds ?? 0) / 60
      : null,
  };
}
