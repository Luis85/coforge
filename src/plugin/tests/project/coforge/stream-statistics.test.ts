import { describe, expect, it } from "vitest";
import {
  metricSeries,
  comparisonCandidates,
  statisticsSummary,
} from "../../../features/coforge/domain/stream-statistics";
import type { StreamHistory, StreamSample } from "../../../features/coforge/domain/stream-metrics";

const sample = (minute: number, viewers: number | null, gapSeconds = 0): StreamSample => ({
  channelId: "123",
  at: new Date(Date.parse("2026-10-27T10:00:00Z") + minute * 60000).toISOString(),
  minute,
  gapSeconds,
  twitch: {
    state: "live",
    streamId: "1",
    startedAt: "2026-10-27T10:00:00Z",
    viewers,
    followers: 100 + minute,
    subscribers: 4,
    subscriptionPoints: 4,
    channel: null,
    unavailable: [],
  },
  obs: { state: "live", startedAt: null, scene: "Game", health: { bitrateKbps: 6000 } },
  coforge: {
    counters: {},
    streamCounters: { "twitch-message-observed": minute * 5 },
    intervalCounters: { "twitch-message-observed": 5 },
    registeredPlayers: 2,
    blockedPlayers: 0,
    coins: 10,
    xp: 20,
    reputation: 30,
    chatPresenceSeconds: 120,
    requestsByStatus: {},
    requestsByProject: {},
    botRepliesByStatus: {},
  },
});
export const statisticsHistory = (): StreamHistory => ({
  schemaVersion: 1,
  id: "twitch-123-1",
  channelId: "123",
  startedAt: "2026-10-27T10:00:00Z",
  twitchStreamId: "1",
  obsStartedAt: null,
  endedAt: "2026-10-27T10:06:00Z",
  endReason: "offline",
  baselineCounters: {},
  samples: [sample(0, 0), sample(1, 10), sample(2, null), sample(5, 20, 120)],
});
describe("stream statistics projection", () => {
  it("does not manufacture activity or coverage for an empty recording", () => {
    const history = statisticsHistory();
    history.samples = [];
    expect(statisticsSummary(history)).toMatchObject({
      samples: 0,
      meanViewers: null,
      peakViewers: null,
      chatMessages: null,
      missingMinutes: null,
    });
  });
  it("keeps real zeroes, nulls and discontinuities, aligned to elapsed time", () => {
    const series = metricSeries(statisticsHistory(), "viewers");
    expect(series.points.map((point) => [point.minute, point.value])).toEqual([
      [0, 0],
      [1, 10],
      [2, null],
      [5, 20],
    ]);
    expect(series.points[3]?.breakBefore).toBe(true);
    expect(series.missing).toBe(1);
  });
  it("uses observed growth baselines and includes a final partial interval in activity summaries", () => {
    const history = statisticsHistory();
    history.finalSnapshot = {
      ...sample(6, null),
      twitch: { ...sample(6, null).twitch, state: "offline" },
      coforge: { ...sample(6, null).coforge, streamCounters: { "twitch-message-observed": 37 } },
    };
    expect(metricSeries(history, "follower-change").points.map((point) => point.value)).toEqual([0, 1, 2, 5, 6]);
    expect(statisticsSummary(history)).toMatchObject({
      chatMessages: 37,
      peakViewers: 20,
      meanViewers: 10,
      missingMinutes: 2,
    });
  });
  it("offers only earlier completed streams on the selected channel, never the selected session itself", () => {
    const selected = statisticsHistory();
    const base = {
      channelId: "123",
      startedAt: "2026-10-26T10:00:00Z",
      endedAt: "2026-10-26T11:00:00Z",
      samples: 3,
      lastSampleAt: "2026-10-26T11:00:00Z",
      peakObservedViewers: 1,
      meanObservedViewers: 1,
    };
    expect(
      comparisonCandidates(selected, [
        { ...base, id: "previous" },
        { ...base, id: selected.id },
        { ...base, id: "other", channelId: "456" },
        { ...base, id: "later", startedAt: "2026-10-28T10:00:00Z" },
        { ...base, id: "live", endedAt: null },
      ]).map((item) => item.id),
    ).toEqual(["previous"]);
  });
});
