import type { ObsScenePort } from "../../features/coforge/application/obs-scene-port";
import type { ObsSnapshot } from "../../features/coforge/domain/obs";
import type {
  ObsSceneAction,
  ObsSceneContext,
  ObsSceneResult,
} from "../../features/coforge/domain/obs-scenes";
import { IntegrationFailure } from "../../features/coforge/domain/integration-failure";
import {
  assertSceneContext,
  existingScene,
  inspectObsScene,
  sceneCapabilities,
  type ObsSceneRpc,
} from "./obs-scenes-data";
import { copyObsScene } from "./obs-scene-copy";
import { checkObsSceneGraph, obsSceneReferences } from "./obs-scene-graph";

/** Allowlisted v5 scene operations. No input settings, capture-device access, RemoveInput or stream-service data. */
export class ObsScenesAdapter implements ObsScenePort {
  constructor(
    private readonly rpc: ObsSceneRpc,
    private readonly snapshot: () => Promise<ObsSnapshot>,
    private readonly available: () => ReadonlySet<string>,
    private readonly current: () => ObsSceneContext,
  ) {}
  async inspect(id: string) {
    const snapshot = await this.snapshot();
    const detail = await inspectObsScene(
      this.rpc,
      snapshot,
      this.available(),
      id,
    );
    assertSceneContext(detail.context, {
      ...snapshot,
      epoch: this.current().epoch,
      sceneCollectionVersion: this.current().collection,
      sceneVersion: this.current().revision,
    });
    return detail;
  }
  async execute(action: ObsSceneAction): Promise<ObsSceneResult> {
    const before = await this.snapshot();
    assertSceneContext(action.expected, before);
    if (before.transitioning || before.reconnecting)
      throw new IntegrationFailure(
        "validation",
        "Wait until OBS is stable before editing scenes.",
      );
    if (!sceneCapabilities(this.available()).includes(action.kind))
      throw new IntegrationFailure(
        "validation",
        "This OBS server does not support the selected scene action. Update OBS or use its own scene editor.",
      );
    let changed = false;
    const deadline = Date.now() + 45000;
    const rpc: ObsSceneRpc = {
      request: async (type, data) => {
        if (Date.now() > deadline)
          throw new IntegrationFailure(
            changed ? "uncertain" : "service",
            "The scene action reached its time limit. Refresh and inspect OBS before continuing.",
          );
        const current = this.current();
        const mutation = !type.startsWith("Get");
        if (
          current.epoch !== action.expected.epoch ||
          current.collection !== action.expected.collection
        )
          throw new IntegrationFailure(
            changed ? "uncertain" : "validation",
            "The OBS connection or scene collection changed. Refresh before another scene action.",
          );
        if (
          mutation &&
          !changed &&
          current.revision !== action.expected.revision
        )
          throw new IntegrationFailure(
            "validation",
            "OBS scenes changed during review. Refresh the editor.",
          );
        const response = await this.rpc.request(type, data);
        if (mutation) changed = true;
        if (
          this.current().epoch !== action.expected.epoch ||
          this.current().collection !== action.expected.collection
        )
          throw new IntegrationFailure(
            changed ? "uncertain" : "validation",
            "The OBS connection changed before this scene action was confirmed.",
          );
        return response;
      },
    };
    try {
      let targetId: string | null = "sceneId" in action ? action.sceneId : null;
      let renamed: { from: string; to: string } | undefined;
      let createdItem: number | undefined;
      let desiredIndex: number | undefined;
      if (
        action.kind === "scene-create" ||
        action.kind === "scene-duplicate" ||
        action.kind === "scene-rename"
      ) {
        if (before.scenes.some((scene) => scene.name === action.name))
          throw new IntegrationFailure(
            "validation",
            "A scene already uses this name. Choose a unique name.",
          );
        if (action.kind === "scene-duplicate")
          await copyObsScene(
            rpc,
            existingScene(before, action.sceneId).name,
            action.name,
          );
        else if (action.kind === "scene-create")
          await rpc.request("CreateScene", { sceneName: action.name });
        else
          await rpc.request("SetSceneName", {
            sceneName: existingScene(before, action.sceneId).name,
            newSceneName: action.name,
          });
        const after = await this.snapshot();
        const target = after.scenes.find((scene) => scene.name === action.name);
        if (!target)
          throw new IntegrationFailure(
            "uncertain",
            "OBS did not confirm the new scene name. Refresh its scene list.",
          );
        targetId = target.id;
        if (action.kind === "scene-rename")
          renamed = { from: action.sceneId, to: target.id };
      } else if (action.kind === "scene-delete") {
        const scene = existingScene(before, action.sceneId);
        if (
          !action.confirmed ||
          scene.name !== action.confirmedName ||
          before.scenes.length <= 1 ||
          [before.programSceneId, before.previewSceneId].includes(scene.id)
        )
          throw new IntegrationFailure(
            "validation",
            "The scene is in use or its deletion was not confirmed. Refresh and review the target.",
          );
        for (const id of [before.programSceneId, before.previewSceneId]) {
          const parent = before.scenes.find((scene) => scene.id === id);
          if (
            parent &&
            (await obsSceneReferences(
              rpc,
              { ...parent, kind: "scene" },
              scene.name,
              new Set(before.scenes.map((scene) => scene.name)),
            ))
          )
            throw new IntegrationFailure(
              "validation",
              "This scene is nested in program or preview output. Switch to an unrelated scene before deleting it.",
            );
        }
        await rpc.request("RemoveScene", { sceneName: scene.name });
        targetId = null;
      } else if (action.kind === "scene-switch") {
        const scene = existingScene(before, action.sceneId);
        if (scene.id === before.programSceneId)
          throw new IntegrationFailure(
            "validation",
            "This scene is already the program scene.",
          );
        await rpc.request("SetCurrentProgramScene", { sceneName: scene.name });
      } else {
        const detail = await inspectObsScene(
          rpc,
          before,
          this.available(),
          action.sceneId,
        );
        const sceneName = detail.name;
        if (action.kind === "item-add") {
          const source = detail.sources.find(
            (source) => source.id === action.sourceId,
          );
          if (!source || detail.items.some((item) => item.name === source.name))
            throw new IntegrationFailure(
              "validation",
              "Choose an existing source that is not already in this scene.",
            );
          await checkObsSceneGraph(
            rpc,
            source,
            sceneName,
            new Set(before.scenes.map((scene) => scene.name)),
          );
          const response = await rpc.request("CreateSceneItem", {
            sceneName,
            sourceName: source.name,
            sceneItemEnabled: true,
          });
          if (
            typeof response.sceneItemId !== "number" ||
            !Number.isInteger(response.sceneItemId)
          )
            throw new IntegrationFailure(
              "uncertain",
              "OBS did not identify the added source. Refresh the scene.",
            );
          createdItem = response.sceneItemId;
        } else {
          const item = detail.items.find((item) => item.id === action.itemId);
          if (!item)
            throw new IntegrationFailure(
              "validation",
              "This scene item no longer exists. Refresh before editing it.",
            );
          if (action.kind === "item-visible")
            await rpc.request("SetSceneItemEnabled", {
              sceneName,
              sceneItemId: item.id,
              sceneItemEnabled: action.enabled,
            });
          if (action.kind === "item-order") {
            const index = item.index + (action.direction === "up" ? 1 : -1);
            if (index < 0 || index >= detail.items.length)
              throw new IntegrationFailure(
                "validation",
                "This source is already at the edge of the scene.",
              );
            desiredIndex = index;
            await rpc.request("SetSceneItemIndex", {
              sceneName,
              sceneItemId: item.id,
              sceneItemIndex: index,
            });
          }
          if (action.kind === "item-remove") {
            if (!action.confirmed || item.name !== action.confirmedName)
              throw new IntegrationFailure(
                "validation",
                "The source changed. Confirm its current name before removal.",
              );
            await rpc.request("RemoveSceneItem", {
              sceneName,
              sceneItemId: item.id,
            });
          }
        }
      }
      const snapshot = await this.snapshot();
      if (
        action.kind === "scene-delete" &&
        snapshot.scenes.some((scene) => scene.id === action.sceneId)
      )
        throw new IntegrationFailure(
          "uncertain",
          "OBS did not confirm scene removal.",
        );
      if (
        action.kind === "scene-switch" &&
        snapshot.programSceneId !== action.sceneId
      )
        throw new IntegrationFailure(
          "uncertain",
          "OBS did not confirm the selected program scene.",
        );
      const detail = targetId ? await this.inspect(targetId) : null;
      if (
        detail &&
        action.kind === "item-visible" &&
        detail.items.find((item) => item.id === action.itemId)?.enabled !==
          action.enabled
      )
        throw new IntegrationFailure(
          "uncertain",
          "OBS did not confirm source visibility.",
        );
      if (
        detail &&
        action.kind === "item-remove" &&
        detail.items.some((item) => item.id === action.itemId)
      )
        throw new IntegrationFailure(
          "uncertain",
          "OBS did not confirm source removal.",
        );
      if (
        detail &&
        action.kind === "item-add" &&
        !detail.items.some((item) => item.id === createdItem)
      )
        throw new IntegrationFailure(
          "uncertain",
          "OBS did not confirm source membership.",
        );
      if (
        detail &&
        action.kind === "item-order" &&
        detail.items.find((item) => item.id === action.itemId)?.index !==
          desiredIndex
      )
        throw new IntegrationFailure(
          "uncertain",
          "OBS did not confirm source order.",
        );
      if (
        this.current().epoch !== action.expected.epoch ||
        this.current().collection !== action.expected.collection
      )
        throw new IntegrationFailure(
          "uncertain",
          "The OBS collection changed before scene confirmation.",
        );
      return { snapshot, detail, ...(renamed ? { renamed } : {}) };
    } catch (error) {
      if (error instanceof IntegrationFailure && !changed) throw error;
      throw new IntegrationFailure(
        "uncertain",
        "OBS may have applied part of this scene action. Refresh and inspect it before continuing; no mutation was replayed.",
      );
    }
  }
}
