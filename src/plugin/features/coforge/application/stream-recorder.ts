import type { StudioStore } from "./studio-store";
import type { Timers } from "./ports";
import type { StreamHistoryPort, StreamMetricsPort } from "./stream-metrics-ports";
import type { StreamHistory, StreamObservation, StreamSample } from "../domain/stream-metrics";
import { coforgeMetrics, metricCounters } from "./coforge-metrics";
import { recordOperation } from "./population";

/** One owned, serialized sampler. No public effects, duplicate minute buckets or fabricated catch-up data. */
export class StreamRecorder {
  private timer: number | undefined;
  private pending: Promise<void> | undefined;
  private closed = false;
  private started = false;
  private nextAt = 0;
  private unsubscribe = () => {};
  constructor(
    private readonly store: StudioStore,
    private readonly history: StreamHistoryPort,
    private readonly source: StreamMetricsPort,
    private readonly timers: Timers,
  ) {}
  async start(): Promise<void> {
    if (this.started || this.closed) return;
    this.started = true;
    this.unsubscribe = this.store.subscribeEvents((event) => {
      if (["stream-started", "stream-stopped", "obs-stream-state-changed", "connected"].includes(event.type))
        void this.capture();
    });
    await this.capture();
  }
  async stop(): Promise<void> {
    this.closed = true;
    this.unsubscribe();
    if (this.timer !== undefined) this.timers.clearTimeout(this.timer);
    this.timer = undefined;
    await this.pending;
  }
  capture(): Promise<void> {
    if (this.closed) return Promise.resolve();
    if (this.pending) return this.pending;
    if (this.timer !== undefined) this.timers.clearTimeout(this.timer);
    this.timer = undefined;
    this.nextAt = Date.now() + 60000;
    this.pending = this.run()
      .catch(async () => {
        if (!this.closed)
          await this.store.updateRuntime({
            streamRecording: {
              phase: "error",
              message:
                "Stream metrics could not be saved. Check vault access and Twitch permissions; existing history is retained.",
              recent: await this.history.list().catch(() => []),
            },
          });
      })
      .catch(() => undefined)
      .finally(() => {
        this.pending = undefined;
        if (!this.closed)
          this.timer = this.timers.setTimeout(
            () => {
              void this.capture();
            },
            Math.max(1000, this.nextAt - Date.now()),
          );
      });
    return this.pending;
  }
  private async save(value: StreamHistory): Promise<void> {
    if (this.closed) return;
    await this.history.save(value);
    if (this.closed) return;
    await this.store.transaction((state) =>
      recordOperation(
        state,
        value.endedAt ? "stream-history-ended" : "stream-snapshot-saved",
        "committed",
        undefined,
        1,
        value.id,
      ),
    );
  }
  private newStream(observation: StreamObservation): StreamHistory {
    return {
      schemaVersion: 1,
      id: observation.twitch.streamId
        ? `twitch-${observation.channelId}-${observation.twitch.streamId}`
        : `obs-${crypto.randomUUID()}`,
      channelId: observation.channelId,
      startedAt: observation.twitch.startedAt ?? observation.obs.startedAt ?? observation.at,
      twitchStreamId: observation.twitch.streamId,
      obsStartedAt: observation.obs.startedAt,
      endedAt: null,
      endReason: null,
      baselineCounters: metricCounters(this.store.internalSnapshot()),
      samples: [],
    };
  }
  private sample(history: StreamHistory, observation: StreamObservation): StreamSample {
    const previous = history.samples.at(-1);
    const minute = Math.max(0, Math.floor((Date.parse(observation.at) - Date.parse(history.startedAt)) / 60000));
    const health = { ...observation.obs.health };
    const bytes = health.outputBytes;
    const priorBytes = previous?.obs.health.outputBytes;
    const seconds = previous ? (Date.parse(observation.at) - Date.parse(previous.at)) / 1000 : 0;
    health.bitrateKbps =
      typeof bytes === "number" && typeof priorBytes === "number" && bytes >= priorBytes && seconds > 0
        ? ((bytes - priorBytes) * 8) / seconds / 1000
        : null;
    health.outputDroppedFramePercent =
      typeof health.outputTotalFrames === "number" &&
      health.outputTotalFrames > 0 &&
      typeof health.outputSkippedFrames === "number"
        ? (health.outputSkippedFrames / health.outputTotalFrames) * 100
        : null;
    return {
      ...observation,
      obs: { ...observation.obs, health },
      minute,
      gapSeconds: previous ? Math.max(0, minute - previous.minute - 1) * 60 : minute * 60,
      coforge: coforgeMetrics(
        this.store.internalSnapshot(),
        history.baselineCounters,
        previous?.coforge.counters ?? history.baselineCounters,
      ),
    };
  }
  private async run(): Promise<void> {
    const lease = this.store.integrationSnapshot().twitchBroadcasterId;
    const observation = await this.source.capture();
    if (this.closed || lease !== this.store.integrationSnapshot().twitchBroadcasterId) return;
    let active = await this.history.active();
    const live = observation.twitch.state === "live" || observation.obs.state === "live";
    const offline =
      (observation.twitch.state === "offline" && observation.obs.state !== "live") ||
      (!active?.twitchStreamId && observation.obs.state === "offline" && observation.twitch.state !== "live");
    const changedChannel = active && active.channelId !== observation.channelId;
    const changedStream =
      active &&
      observation.twitch.streamId &&
      active.twitchStreamId &&
      observation.twitch.streamId !== active.twitchStreamId;
    const changedObs =
      active &&
      !observation.twitch.streamId &&
      active.obsStartedAt &&
      observation.obs.startedAt &&
      Math.abs(Date.parse(active.obsStartedAt) - Date.parse(observation.obs.startedAt)) > 10000;
    if (active && (changedChannel || changedStream || changedObs || offline)) {
      if (offline && !changedChannel && !changedStream && !changedObs)
        active.finalSnapshot = this.sample(active, observation);
      active.endedAt = observation.at;
      active.endReason = changedChannel ? "channel-changed" : changedStream || changedObs ? "new-broadcast" : "offline";
      await this.save(active);
      active = null;
    }
    if (live) {
      if (!active) {
        const fresh = this.newStream(observation);
        active = (await this.history.read(fresh.id)) ?? fresh;
        active.endedAt = null;
        active.endReason = null;
        delete active.finalSnapshot;
      }
      const previous = active.samples.at(-1);
      const minute = Math.max(0, Math.floor((Date.parse(observation.at) - Date.parse(active.startedAt)) / 60000));
      if (!previous || minute > previous.minute) {
        active.twitchStreamId ??= observation.twitch.streamId;
        active.obsStartedAt ??= observation.obs.startedAt;
        active.samples.push(this.sample(active, observation));
        await this.save(active);
      }
      this.nextAt = Date.parse(active.startedAt) + (minute + 1) * 60000;
    }
    if (!this.closed)
      await this.store.updateRuntime({
        streamRecording: {
          phase: live ? "recording" : "idle",
          message: live
            ? "Recording one JSON sample per minute while live."
            : "Waiting for a confirmed live stream. Unknown intervals are not backfilled.",
          recent: await this.history.list(),
          ...(active?.samples.at(-1) ? { lastSavedAt: active.samples.at(-1)!.at } : {}),
        },
      });
  }
}
