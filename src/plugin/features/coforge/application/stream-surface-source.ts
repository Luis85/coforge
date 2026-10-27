import type { StudioStore } from "./studio-store";
import { emptyStreamSurfaces } from "../domain/stream-surfaces";
import type { StreamSurfaceSource } from "./stream-surface-ports";
export class PublicStreamSource implements StreamSurfaceSource {
  private value = emptyStreamSurfaces();
  private key = "";
  private liveSince = 0;
  private connected = false;
  private readonly listeners = new Set<
    Parameters<StreamSurfaceSource["subscribe"]>[0]
  >();
  private stop = () => {};
  constructor(
    private readonly store: StudioStore,
    private readonly projectId?: string,
  ) {}
  start(): void {
    this.stop();
    this.stop = this.store.subscribeChanges(() => this.refresh());
    this.refresh();
  }
  private refresh(): void {
    if (!this.store.ready) return;
    const chat = this.store.liveChatSnapshot();
    const phase = chat.phase === "connected";
    if (
      phase &&
      chat.connectedAt &&
      Number.isFinite(Date.parse(chat.connectedAt))
    )
      this.liveSince = Date.parse(chat.connectedAt);
    else if (phase && !this.connected) this.liveSince = Date.now();
    this.connected = phase;
    const next = this.store.streamSurfaceSnapshot(
      this.liveSince,
      this.projectId,
    );
    const key = JSON.stringify(next);
    if (key === this.key) return;
    this.key = key;
    this.value = next;
    for (const listener of this.listeners) {
      try {
        listener(this.snapshot());
      } catch {
        /* A display cannot change canonical state. */
      }
    }
  }
  snapshot() {
    return structuredClone(this.value);
  }
  subscribe(listener: Parameters<StreamSurfaceSource["subscribe"]>[0]) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  asPort(): StreamSurfaceSource {
    return Object.freeze({
      snapshot: () => this.snapshot(),
      subscribe: (listener: Parameters<StreamSurfaceSource["subscribe"]>[0]) =>
        this.subscribe(listener),
    });
  }
  dispose(): void {
    this.stop();
    this.listeners.clear();
  }
}
