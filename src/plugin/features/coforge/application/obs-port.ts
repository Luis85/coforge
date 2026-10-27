import type { ObsObservation, ObsSettings, ObsSnapshot } from "../domain/obs";
/** Mutations resolve with observed confirmation. Authentication and protocol frames never enter application/UI code. */
export interface ObsControlPort {
  connect(settings: ObsSettings): Promise<ObsSnapshot>;
  disconnect(): void;
  snapshot(): Promise<ObsSnapshot>;
  selectScene(id: string): Promise<ObsSnapshot>;
  startStream(): Promise<ObsSnapshot>;
  stopStream(): Promise<ObsSnapshot>;
  savePassword(secretName: string, value: string): Promise<void>;
  subscribe(listener: (state: ObsObservation) => void): () => void;
  dispose(): void;
}
