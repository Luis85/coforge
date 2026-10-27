import { list, nullable, number, oneOf, optional, record, shape, text, timestamp, type Check } from "./check";
import type { StreamHistory, StreamSummary } from "./stream-metrics";
const id = text({ min: 1, max: 160, pattern: /^[a-zA-Z0-9_-]+$/ });
const count = number({ min: 0 });
const numericMap: Check<Record<string, number>> = (value) => {
  const result: Record<string, number> = {};
  const entries = Object.entries(record(value));
  if (entries.length > 10000) throw new Error("Metric map is too large.");
  for (const [key, amount] of entries) result[text({ max: 160 })(key)] = count(amount);
  return result;
};
const health: Check<Record<string, number | null>> = (value) => {
  const result: Record<string, number | null> = {};
  for (const [key, amount] of Object.entries(record(value))) {
    if (Object.keys(result).length >= 50) throw new Error("Metric health map is too large.");
    result[text({ max: 80 })(key)] = nullable(count)(amount);
  }
  return result;
};
const state = oneOf(["live", "offline", "unavailable"] as const);
const channel = shape({
  id: text({ max: 100 }),
  login: text({ max: 100 }),
  name: text({ max: 100 }),
  title: text({ max: 500 }),
  categoryId: text({ max: 100 }),
  categoryName: text({ max: 300 }),
  tags: optional(list(text({ max: 100 }))),
  language: optional(text({ max: 20 })),
});
const sample = shape({
  channelId: text({ max: 100 }),
  at: timestamp,
  minute: number({ integer: true, min: 0 }),
  gapSeconds: count,
  twitch: shape({
    state,
    streamId: nullable(id),
    startedAt: nullable(timestamp),
    viewers: nullable(count),
    channel: nullable(channel),
    followers: nullable(count),
    subscribers: nullable(count),
    subscriptionPoints: nullable(count),
    unavailable: list(text({ max: 80 }), { max: 20 }),
  }),
  obs: shape({ state, startedAt: nullable(timestamp), scene: nullable(text({ max: 300 })), health }),
  coforge: shape({
    counters: numericMap,
    streamCounters: numericMap,
    intervalCounters: numericMap,
    registeredPlayers: count,
    blockedPlayers: count,
    coins: count,
    xp: count,
    reputation: count,
    chatPresenceSeconds: count,
    requestsByStatus: numericMap,
    requestsByProject: numericMap,
    botRepliesByStatus: numericMap,
  }),
});
export const streamSummaryCheck: Check<StreamSummary> = shape({
  id,
  channelId: text({ max: 100 }),
  startedAt: timestamp,
  endedAt: nullable(timestamp),
  samples: number({ integer: true, min: 0 }),
  lastSampleAt: timestamp,
  peakObservedViewers: nullable(count),
  meanObservedViewers: nullable(count),
  followerNetChange: optional(nullable(number())),
  subscriberNetChange: optional(nullable(number())),
});
export const streamHistoryCheck: Check<StreamHistory> = shape({
  schemaVersion: oneOf([1] as const),
  id,
  channelId: text({ max: 100 }),
  startedAt: timestamp,
  twitchStreamId: nullable(id),
  obsStartedAt: nullable(timestamp),
  endedAt: nullable(timestamp),
  endReason: nullable(oneOf(["offline", "new-broadcast", "channel-changed"] as const)),
  baselineCounters: numericMap,
  samples: list(sample, { max: 100000 }),
  finalSnapshot: optional(sample),
  summary: optional(streamSummaryCheck),
});
export const streamHistoryId = id;
