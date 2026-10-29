import type { AlertCue, AlertsDefinition, AlertsSnapshot, AlertTemplate } from '../domain/alerts';
export interface AlertsStorage { load(): Promise<AlertsDefinition>; save(next: AlertsDefinition): Promise<void> }
export interface AlertsTransport {
  start(): Promise<string>;
  /** Immediately publishes current connected-page count; it does not verify OBS or playback. */
  subscribeSources(listener: (sources: number) => void): () => void;
  /** Number of connected pages whose bounded stream accepted this cue. */
  send(cue: AlertCue): number;
  clear(): void;
  close(): Promise<void>;
}
export interface AlertsMedia { check(paths: readonly string[]): Promise<void> }
export interface AlertsActions {
  snapshot(): AlertsSnapshot;
  subscribe(listener: (state: AlertsSnapshot) => void): () => void;
  save(template: AlertTemplate): Promise<void>;
  remove(id: string): Promise<void>;
  fire(id: string, variables: Record<string, string>): Promise<{ sources: number }>;
  clear(): void;
}
