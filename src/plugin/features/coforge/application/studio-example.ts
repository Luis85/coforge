import type { LiveStudioState } from "../domain/live-studio";
import type { ObsSnapshot } from "../domain/obs";
import type { ObsSceneActions } from "../domain/obs-scenes";
export interface StudioExample {
  snapshot(): ObsSnapshot;
  scenes: ObsSceneActions;
  telemetry(): LiveStudioState;
  uncertain(): boolean;
  refresh(): Promise<void>;
}
