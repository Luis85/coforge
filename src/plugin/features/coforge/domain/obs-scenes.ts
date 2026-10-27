import type { ObsSnapshot } from "./obs";
export const OBS_SCENE_KINDS = [
  "scene-create",
  "scene-rename",
  "scene-duplicate",
  "scene-delete",
  "scene-switch",
  "item-visible",
  "item-order",
  "item-add",
  "item-remove",
] as const;
export type ObsSceneKind = (typeof OBS_SCENE_KINDS)[number];
export interface ObsSceneContext {
  epoch: number;
  collection: number;
  revision: number;
}
export interface ObsSceneItem {
  id: number;
  name: string;
  sourceId: string;
  kind: "input" | "scene" | "group" | "unknown";
  enabled: boolean;
  locked: boolean;
  index: number;
}
export interface ObsExistingSource {
  id: string;
  name: string;
  kind: "input" | "scene" | "group";
}
export interface ObsSceneDetail {
  context: ObsSceneContext;
  sceneId: string;
  name: string;
  items: ObsSceneItem[];
  sources: ObsExistingSource[];
  available: ObsSceneKind[];
  observedAt: string;
}
type Target = { sceneId: string };
export type ObsSceneAction = { expected: ObsSceneContext } & (
  | { kind: "scene-create"; name: string }
  | (Target & { kind: "scene-rename"; name: string })
  | (Target & { kind: "scene-duplicate"; name: string })
  | (Target & {
      kind: "scene-delete";
      confirmed: boolean;
      confirmedName: string;
    })
  | (Target & { kind: "scene-switch" })
  | (Target & { kind: "item-visible"; itemId: number; enabled: boolean })
  | (Target & { kind: "item-order"; itemId: number; direction: "up" | "down" })
  | (Target & { kind: "item-add"; sourceId: string })
  | (Target & {
      kind: "item-remove";
      itemId: number;
      confirmed: boolean;
      confirmedName: string;
    })
);
export interface ObsSceneResult {
  snapshot: ObsSnapshot;
  detail: ObsSceneDetail | null;
  renamed?: { from: string; to: string };
}
export interface ObsSceneActions {
  inspect(sceneId: string): Promise<ObsSceneDetail>;
  execute(input: unknown): Promise<ObsSceneResult>;
}
export const sceneContext = (snapshot: ObsSnapshot): ObsSceneContext => ({
  epoch: snapshot.epoch,
  collection: snapshot.sceneCollectionVersion ?? 0,
  revision: snapshot.sceneVersion ?? 0,
});
