import type { StudioStore } from "./studio-store";
import type { Timers } from "./ports";
import type { ObsMetrics } from "../domain/stream-metrics";
import { emptyLiveStudio, type LiveViewerReading } from "../domain/live-studio";
export interface LiveStudioPort {
  obs(): Promise<ObsMetrics>;
  twitch(): Promise<LiveViewerReading>;
}

/** Independent, bounded read lanes. Runtime-only monitoring never writes archive samples or public effects. */
export class LiveStudioMonitor {
  private readonly state = emptyLiveStudio();
  private timer: number | undefined;
  private closed = false;
  private pendingObs = false;
  private pendingViewers = false;
  private nextViewers = 0;
  private channel = "";
  private chatStart = 0;
  private lastChat: { messages: number; commands: number } | null = null;
  private chatWindow: Array<{
    at: number;
    messages: number;
    commands: number;
  }> = [];
  private previousObs: {
    at: number;
    bytes: number;
    startedAt: string | null;
  } | null = null;
  private obsEndpoint = "";
  private publishing: Promise<void> = Promise.resolve();
  private publicationQueued = false;
  constructor(
    private readonly store: StudioStore,
    private readonly port: LiveStudioPort,
    private readonly timers: Timers,
  ) {}
  start(): void {
    if (this.closed || this.timer !== undefined) return;
    this.tick();
    this.timer = this.timers.setInterval(() => this.tick(), 5000);
  }
  async stop(): Promise<void> {
    this.closed = true;
    if (this.timer !== undefined) this.timers.clearInterval(this.timer);
    this.timer = undefined;
    await this.publishing;
  }
  private publish(): void {
    if (this.closed || this.publicationQueued) return;
    this.publicationQueued = true;
    this.publishing = this.publishing
      .then(async () => {
        this.publicationQueued = false;
        if (!this.closed)
          await this.store.updateRuntime({
            liveStudio: structuredClone(this.state),
          });
      })
      .catch(() => undefined);
  }
  private chat(now: number): void {
    const state = this.store.liveChatSnapshot();
    const ready = state.phase === "connected";
    const current = { messages: state.messages, commands: state.commands };
    if (
      !ready ||
      !this.lastChat ||
      current.messages < this.lastChat.messages ||
      current.commands < this.lastChat.commands
    ) {
      this.chatWindow = [];
      this.chatStart = now;
      this.lastChat = ready ? current : null;
    } else {
      this.chatWindow.push({
        at: now,
        messages: current.messages - this.lastChat.messages,
        commands: current.commands - this.lastChat.commands,
      });
      this.lastChat = current;
    }
    this.chatWindow = this.chatWindow.filter((item) => item.at > now - 60000);
    this.state.chat = {
      messages: ready
        ? this.chatWindow.reduce((sum, item) => sum + item.messages, 0)
        : null,
      commands: ready
        ? this.chatWindow.reduce((sum, item) => sum + item.commands, 0)
        : null,
      observedSeconds: ready
        ? Math.min(60, Math.max(0, (now - this.chatStart) / 1000))
        : 0,
      checkedAt: new Date(now).toISOString(),
    };
  }
  private tick(): void {
    if (this.closed) return;
    const now = Date.now();
    const channel = this.store.integrationSnapshot().twitchBroadcasterId;
    if (channel !== this.channel) {
      this.channel = channel;
      this.lastChat = null;
      this.chatWindow = [];
      this.nextViewers = 0;
      this.state.channelId = channel;
      this.state.viewers = { value: null, checkedAt: null };
    }
    this.chat(now);
    this.publish();
    if (!this.pendingObs) void this.readObs();
    if (!this.pendingViewers && now >= this.nextViewers) {
      this.nextViewers = now + 15000;
      void this.readViewers(channel);
    }
  }
  private async readObs(): Promise<void> {
    this.pendingObs = true;
    const endpoint = this.store.obsContext().settings.endpoint;
    if (endpoint !== this.obsEndpoint) {
      this.obsEndpoint = endpoint;
      this.previousObs = null;
    }
    try {
      const value = await this.port.obs();
      if (this.closed || endpoint !== this.store.obsContext().settings.endpoint)
        return;
      const at = value.observedAt ? Date.parse(value.observedAt) : Date.now();
      const bytes = value.health.outputBytes;
      const previous = this.previousObs;
      const seconds = previous ? (at - previous.at) / 1000 : 0;
      const health = { ...value.health };
      const sameOutput =
        previous &&
        (!previous.startedAt ||
          !value.startedAt ||
          Math.abs(
            Date.parse(previous.startedAt) - Date.parse(value.startedAt),
          ) < 10000);
      health.bitrateKbps =
        value.state === "live" &&
        previous &&
        sameOutput &&
        typeof bytes === "number" &&
        bytes >= previous.bytes &&
        seconds > 0
          ? ((bytes - previous.bytes) * 8) / seconds / 1000
          : null;
      health.outputDroppedFramePercent =
        typeof health.outputTotalFrames === "number" &&
        health.outputTotalFrames > 0 &&
        typeof health.outputSkippedFrames === "number"
          ? (health.outputSkippedFrames / health.outputTotalFrames) * 100
          : null;
      this.previousObs =
        value.state === "live" && typeof bytes === "number"
          ? { at, bytes, startedAt: value.startedAt }
          : null;
      this.state.obs = {
        value: { ...value, health },
        checkedAt: new Date(at).toISOString(),
      };
    } catch {
      if (!this.closed) {
        this.previousObs = null;
        this.state.obs = { value: null, checkedAt: new Date().toISOString() };
      }
    } finally {
      this.pendingObs = false;
      this.publish();
    }
  }
  private async readViewers(channel: string): Promise<void> {
    this.pendingViewers = true;
    try {
      const value = await this.port.twitch();
      if (
        !this.closed &&
        channel === this.store.integrationSnapshot().twitchBroadcasterId
      )
        this.state.viewers = { value, checkedAt: new Date().toISOString() };
    } catch {
      if (!this.closed && channel === this.channel)
        this.state.viewers = {
          value: null,
          checkedAt: new Date().toISOString(),
        };
    } finally {
      this.pendingViewers = false;
      this.publish();
    }
  }
}
