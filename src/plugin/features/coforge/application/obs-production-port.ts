import type { ObsProductionAction, ObsProductionFrame, ObsProductionSnapshot, ObsPropertyOption, ObsSceneTransform, ObsSourceFilter } from '../domain/obs-production';
export interface ObsProductionPort {
  inspect(): Promise<ObsProductionSnapshot>;
  execute(action: ObsProductionAction): Promise<ObsProductionSnapshot>;
  frame(sceneId: string): Promise<ObsProductionFrame>;
  properties(inputId: string, property: string): Promise<ObsPropertyOption[]>;
  transform(sceneId: string, itemId: number): Promise<ObsSceneTransform>;
  filters(inputId: string): Promise<ObsSourceFilter[]>;
  saveOutputSecret(secretName: string, value: string): Promise<void>;
}
