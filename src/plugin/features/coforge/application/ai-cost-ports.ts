import type { AICostTask } from "../domain/ai-costs";
export interface AICostStorage {
  load(): Promise<AICostTask[]>;
  save(tasks: AICostTask[]): Promise<void>;
}
export interface AICostState {
  tasks: AICostTask[];
  error: string;
  loading: boolean;
}
export interface AICostActions {
  snapshot(): AICostState;
  subscribe(listener: (state: AICostState) => void): () => void;
  refresh(): Promise<void>;
  setManual(
    id: string,
    amount: string | null,
    note: string,
    expected: string,
  ): Promise<void>;
}
