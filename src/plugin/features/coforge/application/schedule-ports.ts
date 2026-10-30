import type { ScheduledStream, ScheduleNote } from "../domain/schedule";
export interface ScheduleStorage {
  list(): Promise<ScheduleNote[]>;
  save(plan: ScheduledStream, expected: string | null): Promise<ScheduleNote>;
  open(id: string): Promise<void>;
}
export type ScheduleStep = "project" | "channel" | "scenes" | "music";
export interface ScheduleActions {
  list(): Promise<ScheduleNote[]>;
  save(input: unknown, expected: string | null): Promise<ScheduleNote>;
  open(id: string): Promise<void>;
  apply(id: string, expected: string, step: ScheduleStep): Promise<void>;
}
export interface SchedulePreparation {
  project(plan: ScheduledStream): Promise<void>;
  channel(plan: ScheduledStream): Promise<void>;
  scenes(plan: ScheduledStream): Promise<void>;
  music(plan: ScheduledStream): Promise<void>;
}
