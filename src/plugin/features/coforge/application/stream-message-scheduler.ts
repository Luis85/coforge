import type { StudioStore } from "./studio-store";
import type { Timers } from "./ports";
import { scheduleStreamMessages } from "./stream-messages";

/** Independent scheduler: observes fresh live state; transport and presence accounting are separate concerns. */
export class StreamMessageScheduler {
  private timer: number | undefined;
  private generation = 0;
  private stopped = false;
  constructor(
    private readonly store: StudioStore,
    private readonly timers: Timers,
    private readonly liveStream: () => string | null,
    private readonly canSend: () => boolean,
    private readonly onError: () => void,
  ) {}
  start(): void {
    if (this.timer !== undefined || this.stopped) return;
    this.timer = this.timers.setInterval(() => this.refresh(), 15_000);
    this.refresh();
  }
  refresh(): void {
    const generation = this.generation;
    if (this.stopped || !this.store.ready) return;
    const snapshot = this.store.recurringSnapshot();
    const streamId = this.canSend() ? this.liveStream() : null;
    const channelId = this.store.integrationSnapshot().twitchBroadcasterId;
    const resetNeeded = snapshot.pending || snapshot.messages.some((message) => message.streamKey || message.nextDueAt);
    const due = snapshot.messages.some(
      (message) =>
        message.active &&
        message.channelId === channelId &&
        (message.streamKey !== `${channelId}:${streamId}` ||
          !message.nextDueAt ||
          Date.parse(message.nextDueAt) <= Date.now()),
    );
    if (streamId ? !due : !resetNeeded) return;
    void this.store
      .transaction((state) => {
        if (!this.stopped && generation === this.generation)
          scheduleStreamMessages(state, this.canSend() ? this.liveStream() : null);
      })
      .catch(() => {
        if (!this.stopped) this.onError();
      });
  }
  reset(): void {
    this.generation++;
    if (this.stopped || !this.store.ready) return;
    const snapshot = this.store.recurringSnapshot();
    if (!snapshot.pending && !snapshot.messages.some((message) => message.nextDueAt || message.streamKey)) return;
    void this.store
      .transaction((state) => {
        if (!this.stopped) scheduleStreamMessages(state, null);
      })
      .catch(() => {
        if (!this.stopped) this.onError();
      });
  }
  stop(): void {
    this.stopped = true;
    this.generation++;
    if (this.timer !== undefined) this.timers.clearInterval(this.timer);
  }
}
