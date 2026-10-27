import type { OperationCode, OperationRecord } from "../domain/population";
/** Named, immutable post-commit facts. Subscriber failures never undo a write or request an external retry. */
export interface StudioEvent {
  readonly type: OperationCode;
  readonly record: Readonly<OperationRecord>;
  readonly revision: number;
}
export interface StudioEventSink {
  publish(event: StudioEvent): void | Promise<void>;
}
export type StudioEventListener = (event: StudioEvent) => void | Promise<void>;
export class StudioEvents {
  private readonly listeners = new Set<StudioEventListener>();
  private closed = false;
  constructor(
    private readonly sink?: StudioEventSink,
    private readonly onError: () => void = () => {},
  ) {}
  subscribe(listener: StudioEventListener): () => void {
    if (!this.closed) this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  publish(records: readonly OperationRecord[], revision: number): void {
    if (this.closed) return;
    for (const record of records) {
      if (this.closed) return;
      const event = Object.freeze({ type: record.code, record: Object.freeze({ ...record }), revision });
      if (this.sink) this.deliver(event, (value) => this.sink!.publish(value));
      // Registration during notification takes effect on the next fact, not the current one.
      const callbacks = [...this.listeners];
      for (const callback of callbacks) {
        if (this.closed) return;
        if (this.listeners.has(callback)) this.deliver(event, callback);
      }
    }
  }
  dispose(): void {
    this.closed = true;
    this.listeners.clear();
  }
  private deliver(event: StudioEvent, callback: StudioEventListener): void {
    try {
      const result = callback(event);
      if (result) void result.catch(() => this.failed());
    } catch {
      this.failed();
    }
  }
  private failed(): void {
    if (!this.closed)
      try {
        this.onError();
      } catch {
        /* Reporting failures remain isolated from committed effects. */
      }
  }
}
