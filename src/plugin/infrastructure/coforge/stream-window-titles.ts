import {
  STREAM_SURFACES,
  type StreamSurface,
} from "../../features/coforge/domain/stream-surfaces";

export interface StreamWindowTitle {
  readonly surface: StreamSurface;
  readonly slot: number;
  readonly title: string;
}
export function streamWindowSurface(value: unknown): value is StreamSurface {
  return STREAM_SURFACES.some((surface) => surface.id === value);
}
export function streamWindowSlot(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

/** One plugin instance owns live-window reservations; project and vault identity never enter a title. */
export class StreamWindowSlots<Owner extends object> {
  private readonly owners = new Map<Owner, StreamWindowTitle>();

  get(owner: Owner): StreamWindowTitle | undefined {
    return this.owners.get(owner);
  }

  acquire(
    owner: Owner,
    surface: StreamSurface,
    preferred?: unknown,
  ): StreamWindowTitle {
    const existing = this.owners.get(owner);
    if (existing) return existing;
    const definition = STREAM_SURFACES.find((item) => item.id === surface);
    if (!definition) throw new Error("Choose a public stream display.");
    const used = new Set(
      Array.from(this.owners.values())
        .filter((window) => window.surface === surface)
        .map((window) => window.slot),
    );
    let slot =
      streamWindowSlot(preferred) && !used.has(preferred) ? preferred : 1;
    while (used.has(slot)) slot++;
    const title = Object.freeze({
      surface,
      slot,
      title: slot === 1 ? definition.title : `${definition.title} (${slot})`,
    });
    this.owners.set(owner, title);
    return title;
  }

  release(owner: Owner): void {
    this.owners.delete(owner);
  }
  clear(): void {
    this.owners.clear();
  }
}
