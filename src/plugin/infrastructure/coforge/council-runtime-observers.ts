import type { CouncilRuntimeSnapshot } from "../../features/coforge/application/council-ports";

/** Isolate every view observer and give each its own snapshot. */
export class CouncilRuntimeObservers {
  private readonly listeners = new Set<
    (snapshot: CouncilRuntimeSnapshot) => void
  >();
  subscribe(listener: (snapshot: CouncilRuntimeSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  publish(snapshot: () => CouncilRuntimeSnapshot): void {
    for (const listener of this.listeners) {
      try {
        listener(snapshot());
      } catch {
        /* A view failure cannot alter execution or another observer's evidence. */
      }
    }
  }
  clear(): void {
    this.listeners.clear();
  }
}
