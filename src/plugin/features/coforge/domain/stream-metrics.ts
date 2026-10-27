import type { TwitchChannel } from "./twitch";
export const STREAM_METRIC_SCOPES = ["channel:read:subscriptions"] as const;
export type MetricSourceState = "live" | "offline" | "unavailable";
export interface TwitchMetrics {
  state: MetricSourceState;
  streamId: string | null;
  startedAt: string | null;
  viewers: number | null;
  channel: TwitchChannel | null;
  followers: number | null;
  subscribers: number | null;
  subscriptionPoints: number | null;
  unavailable: string[];
}
export interface ObsMetrics {
  epoch?: number;
  observedAt?: string;
  state: MetricSourceState;
  startedAt: string | null;
  scene: string | null;
  health: Record<string, number | null>;
}
export interface StreamObservation {
  channelId: string;
  at: string;
  twitch: TwitchMetrics;
  obs: ObsMetrics;
}
export interface CoforgeMetrics {
  counters: Record<string, number>;
  streamCounters: Record<string, number>;
  intervalCounters: Record<string, number>;
  registeredPlayers: number;
  blockedPlayers: number;
  coins: number;
  xp: number;
  reputation: number;
  chatPresenceSeconds: number;
  requestsByStatus: Record<string, number>;
  requestsByProject: Record<string, number>;
  botRepliesByStatus: Record<string, number>;
}
export interface StreamSample extends StreamObservation {
  minute: number;
  gapSeconds: number;
  coforge: CoforgeMetrics;
}
export interface StreamHistory {
  schemaVersion: 1;
  id: string;
  channelId: string;
  startedAt: string;
  twitchStreamId: string | null;
  obsStartedAt: string | null;
  endedAt: string | null;
  endReason: "offline" | "new-broadcast" | "channel-changed" | null;
  baselineCounters: Record<string, number>;
  samples: StreamSample[];
  finalSnapshot?: StreamSample;
  summary?: StreamSummary;
}
export interface StreamSummary {
  id: string;
  channelId: string;
  startedAt: string;
  endedAt: string | null;
  samples: number;
  lastSampleAt: string;
  peakObservedViewers: number | null;
  meanObservedViewers: number | null;
  followerNetChange?: number | null;
  subscriberNetChange?: number | null;
}
export interface StreamRecordingState {
  phase: "idle" | "recording" | "error";
  message: string;
  recent: StreamSummary[];
  lastSavedAt?: string;
}
export function summarizeStream(history: StreamHistory): StreamSummary {
  const viewers = history.samples.flatMap((sample) => (sample.twitch.viewers === null ? [] : [sample.twitch.viewers]));
  const observations = [...history.samples, ...(history.finalSnapshot ? [history.finalSnapshot] : [])];
  const change = (key: "followers" | "subscribers") => {
    const values = observations.flatMap((sample) => (sample.twitch[key] === null ? [] : [sample.twitch[key]!]));
    return values.length >= 2 ? values[values.length - 1]! - values[0]! : null;
  };
  return {
    id: history.id,
    channelId: history.channelId,
    startedAt: history.startedAt,
    endedAt: history.endedAt,
    samples: history.samples.length,
    lastSampleAt: history.samples.at(-1)?.at ?? history.startedAt,
    peakObservedViewers: viewers.length ? viewers.reduce((peak, value) => Math.max(peak, value), 0) : null,
    meanObservedViewers: viewers.length ? viewers.reduce((sum, value) => sum + value, 0) / viewers.length : null,
    followerNetChange: change("followers"),
    subscriberNetChange: change("subscribers"),
  };
}
