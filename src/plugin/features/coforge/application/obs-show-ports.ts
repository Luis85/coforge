import type { ObsShowState, ObsShowStep } from '../domain/obs-show';
export interface ObsShowExecutor { execute(step: ObsShowStep): Promise<void>; live(): boolean; ready?(): boolean; settle?(): Promise<void> }
export interface ObsShowActions {
  snapshot(): ObsShowState;
  savePlan(input: unknown): Promise<ObsShowState>;
  deletePlan(id: string): Promise<void>;
  runCue(planId: string, cueId: string): Promise<ObsShowState>;
  recover(): Promise<ObsShowState>;
  setAutomation(enabled: boolean): Promise<ObsShowState>;
  addMarker(label: string): Promise<ObsShowState>;
}
