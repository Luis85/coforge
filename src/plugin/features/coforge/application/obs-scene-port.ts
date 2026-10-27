import type {
  ObsSceneAction,
  ObsSceneDetail,
  ObsSceneResult,
} from "../domain/obs-scenes";
export interface ObsScenePort {
  inspect(sceneId: string): Promise<ObsSceneDetail>;
  execute(action: ObsSceneAction): Promise<ObsSceneResult>;
}
