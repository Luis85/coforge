import type { StreamHistory, StreamObservation, StreamSummary } from "../domain/stream-metrics";
export interface StreamMetricsPort {
  capture(): Promise<StreamObservation>;
}
export interface StreamHistoryPort {
  active(): Promise<StreamHistory | null>;
  read(id: string): Promise<StreamHistory | null>;
  save(history: StreamHistory): Promise<void>;
  list(): Promise<StreamSummary[]>;
}
export interface StreamHistoryActions {
  read(id: string): Promise<StreamHistory | null>;
  list(): Promise<StreamSummary[]>;
  export(id: string): Promise<string>;
}
