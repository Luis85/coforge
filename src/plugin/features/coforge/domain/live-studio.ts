import type { MetricSourceState, ObsMetrics } from "./stream-metrics";
export interface LiveViewerReading {
  state: MetricSourceState;
  viewers: number | null;
  streamId: string | null;
  startedAt: string | null;
}
export interface TimedReading<T> {
  value: T | null;
  checkedAt: string | null;
}
export interface LiveChatReading {
  messages: number | null;
  commands: number | null;
  observedSeconds: number;
  checkedAt: string;
}
export interface LiveStudioState {
  channelId: string;
  viewers: TimedReading<LiveViewerReading>;
  obs: TimedReading<ObsMetrics>;
  chat: LiveChatReading;
}
export const emptyLiveStudio = (): LiveStudioState => ({
  channelId: "",
  viewers: { value: null, checkedAt: null },
  obs: { value: null, checkedAt: null },
  chat: {
    messages: null,
    commands: null,
    observedSeconds: 0,
    checkedAt: new Date().toISOString(),
  },
});
