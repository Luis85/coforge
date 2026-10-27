import type { ObsScene, ObsSnapshot } from "../../features/coforge/domain/obs";
import {
  OBS_SCENE_KINDS,
  sceneContext,
  type ObsSceneContext,
  type ObsSceneDetail,
  type ObsSceneItem,
  type ObsExistingSource,
  type ObsSceneKind,
} from "../../features/coforge/domain/obs-scenes";
import { record } from "../../features/coforge/domain/check";
import { IntegrationFailure } from "../../features/coforge/domain/integration-failure";
export type ObsSceneRequest =
  | "GetSceneItemList"
  | "GetGroupSceneItemList"
  | "GetInputList"
  | "GetGroupList"
  | "CreateScene"
  | "SetSceneName"
  | "RemoveScene"
  | "SetCurrentProgramScene"
  | "CreateSceneItem"
  | "RemoveSceneItem"
  | "DuplicateSceneItem"
  | "SetSceneItemEnabled"
  | "SetSceneItemIndex"
  | "SetSceneItemLocked"
  | "GetSceneItemBlendMode"
  | "SetSceneItemBlendMode"
  | "GetSceneSceneTransitionOverride"
  | "SetSceneSceneTransitionOverride";
export interface ObsSceneRpc {
  request(
    type: ObsSceneRequest,
    data?: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
}
const requirements: Record<ObsSceneKind, ObsSceneRequest[]> = {
  "scene-create": ["CreateScene"],
  "scene-rename": ["SetSceneName"],
  "scene-delete": ["RemoveScene"],
  "scene-switch": ["SetCurrentProgramScene"],
  "scene-duplicate": [
    "CreateScene",
    "DuplicateSceneItem",
    "GetSceneItemList",
    "SetSceneItemLocked",
    "GetSceneItemBlendMode",
    "SetSceneItemBlendMode",
    "GetSceneSceneTransitionOverride",
    "SetSceneSceneTransitionOverride",
  ],
  "item-visible": ["GetSceneItemList", "SetSceneItemEnabled"],
  "item-order": ["GetSceneItemList", "SetSceneItemIndex"],
  "item-add": ["GetSceneItemList", "GetInputList", "CreateSceneItem"],
  "item-remove": ["GetSceneItemList", "RemoveSceneItem"],
};
export const sceneCapabilities = (available: ReadonlySet<string>) =>
  OBS_SCENE_KINDS.filter((kind) =>
    requirements[kind].every((type) => available.has(type)),
  );
export function existingScene(snapshot: ObsSnapshot, id: string): ObsScene {
  const scene = snapshot.scenes.find((scene) => scene.id === id);
  if (!scene)
    throw new IntegrationFailure(
      "validation",
      "This scene no longer exists. Refresh the editor.",
    );
  return scene;
}
export function assertSceneContext(
  expected: ObsSceneContext,
  snapshot: ObsSnapshot,
): void {
  const actual = sceneContext(snapshot);
  if (
    actual.epoch !== expected.epoch ||
    actual.collection !== expected.collection ||
    actual.revision !== expected.revision
  )
    throw new IntegrationFailure(
      "validation",
      "OBS scenes changed. Refresh the editor and review the action again.",
    );
}
function sourceName(value: unknown): string {
  if (typeof value !== "string" || !value || value.length > 300)
    throw new IntegrationFailure(
      "service",
      "OBS returned an invalid scene or source name.",
    );
  return value;
}
export function rawSceneItems(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value) || value.length > 1000)
    throw new IntegrationFailure(
      "service",
      "OBS returned an incomplete or oversized scene-item list.",
    );
  return value.map((item) => record(item));
}
export function parsedSceneItems(
  raw: Array<Record<string, unknown>>,
): ObsSceneItem[] {
  const result = raw.map<ObsSceneItem>((item) => {
    if (
      !Number.isInteger(item.sceneItemId) ||
      typeof item.sceneItemId !== "number" ||
      item.sceneItemId < 0 ||
      typeof item.sceneItemIndex !== "number" ||
      !Number.isInteger(item.sceneItemIndex) ||
      item.sceneItemIndex < 0 ||
      typeof item.sceneItemEnabled !== "boolean" ||
      typeof item.sceneItemLocked !== "boolean"
    )
      throw new IntegrationFailure(
        "service",
        "OBS returned incomplete scene-item state.",
      );
    const name = sourceName(item.sourceName);
    const kind =
      item.isGroup === true
        ? "group"
        : item.sourceType === "OBS_SOURCE_TYPE_SCENE"
          ? "scene"
          : typeof item.inputKind === "string"
            ? "input"
            : "unknown";
    return {
      id: item.sceneItemId,
      index: item.sceneItemIndex,
      enabled: item.sceneItemEnabled,
      locked: item.sceneItemLocked,
      name,
      sourceId: `${kind}:${typeof item.sourceUuid === "string" && item.sourceUuid ? item.sourceUuid : name}`,
      kind,
    };
  });
  if (new Set(result.map((item) => item.id)).size !== result.length)
    throw new IntegrationFailure(
      "service",
      "OBS returned duplicate scene-item identities.",
    );
  return result.sort((a, b) => b.index - a.index);
}
export async function existingSources(
  rpc: ObsSceneRpc,
  snapshot: ObsSnapshot,
  available: ReadonlySet<string>,
  target: string,
): Promise<ObsExistingSource[]> {
  const result: ObsExistingSource[] = snapshot.scenes
    .filter((scene) => scene.id !== target)
    .map((scene) => ({
      id: `scene:${scene.id}`,
      name: scene.name,
      kind: "scene",
    }));
  if (available.has("GetInputList")) {
    const data = await rpc.request("GetInputList");
    if (!Array.isArray(data.inputs) || data.inputs.length > 2000)
      throw new IntegrationFailure(
        "service",
        "OBS returned an incomplete input list.",
      );
    for (const value of data.inputs) {
      const input = record(value);
      const name = sourceName(input.inputName);
      result.push({
        id: `input:${typeof input.inputUuid === "string" && input.inputUuid ? input.inputUuid : name}`,
        name,
        kind: "input",
      });
    }
  }
  if (available.has("GetGroupList")) {
    const data = await rpc.request("GetGroupList");
    if (!Array.isArray(data.groups) || data.groups.length > 1000)
      throw new IntegrationFailure(
        "service",
        "OBS returned an incomplete group list.",
      );
    for (const value of data.groups) {
      const name = sourceName(value);
      result.push({ id: `group:${name}`, name, kind: "group" });
    }
  }
  return result.sort((a, b) => a.name.localeCompare(b.name));
}
export async function inspectObsScene(
  rpc: ObsSceneRpc,
  snapshot: ObsSnapshot,
  available: ReadonlySet<string>,
  id: string,
): Promise<ObsSceneDetail> {
  if (!available.has("GetSceneItemList"))
    throw new IntegrationFailure(
      "validation",
      "This OBS server does not support scene-item inspection.",
    );
  const scene = existingScene(snapshot, id);
  const raw = await rpc.request("GetSceneItemList", { sceneName: scene.name });
  const sources = await existingSources(rpc, snapshot, available, id);
  return {
    context: sceneContext(snapshot),
    sceneId: scene.id,
    name: scene.name,
    items: parsedSceneItems(rawSceneItems(raw.sceneItems)),
    sources,
    available: sceneCapabilities(available),
    observedAt: new Date().toISOString(),
  };
}
