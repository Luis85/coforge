import type { ObsSceneRpc } from "./obs-scenes-data";
import { rawSceneItems, parsedSceneItems } from "./obs-scenes-data";
import { record } from "../../features/coforge/domain/check";
import { IntegrationFailure } from "../../features/coforge/domain/integration-failure";
const transformKeys = [
  "positionX",
  "positionY",
  "scaleX",
  "scaleY",
  "rotation",
  "cropTop",
  "cropBottom",
  "cropLeft",
  "cropRight",
  "boundsType",
  "boundsWidth",
  "boundsHeight",
  "alignment",
  "boundsAlignment",
];
function fingerprint(
  raw: Array<Record<string, unknown>>,
  includeIds = true,
): string {
  return JSON.stringify(
    raw
      .map((item) => ({
        ...(includeIds ? { id: item.sceneItemId } : {}),
        source: item.sourceName,
        index: item.sceneItemIndex,
        enabled: item.sceneItemEnabled,
        locked: item.sceneItemLocked,
        transform: Object.fromEntries(
          transformKeys.map((key) => [
            key,
            record(item.sceneItemTransform ?? {})[key],
          ]),
        ),
      }))
      .sort((a, b) => Number(a.index) - Number(b.index)),
  );
}
/** OBS copies layout/crop via DuplicateSceneItem; source objects remain shared. Never delete a partial copy. */
export async function copyObsScene(
  rpc: ObsSceneRpc,
  from: string,
  to: string,
): Promise<void> {
  const deadline = Date.now() + 30000;
  const raw = rawSceneItems(
    (await rpc.request("GetSceneItemList", { sceneName: from })).sceneItems,
  );
  const items = parsedSceneItems(raw).sort((a, b) => a.index - b.index);
  if (items.length > 200)
    throw new IntegrationFailure(
      "validation",
      "This scene is too large to duplicate here. Duplicate it in OBS Studio.",
    );
  const transition = await rpc.request("GetSceneSceneTransitionOverride", {
    sceneName: from,
  });
  const duration =
    transition.transitionDuration === null ||
    transition.transitionDuration === -1
      ? null
      : transition.transitionDuration;
  if (
    transition.transitionName !== null &&
    (typeof transition.transitionName !== "string" ||
      transition.transitionName.length > 300)
  )
    throw new IntegrationFailure(
      "service",
      "OBS returned invalid transition settings.",
    );
  if (
    duration !== null &&
    (typeof duration !== "number" ||
      !Number.isInteger(duration) ||
      duration < 50 ||
      duration > 20000)
  )
    throw new IntegrationFailure(
      "service",
      "OBS returned an invalid transition duration.",
    );
  const modes = new Map<number, string>();
  for (const item of items) {
    if (Date.now() > deadline)
      throw new IntegrationFailure(
        "service",
        "Scene-copy inspection timed out. No new scene was requested.",
      );
    const mode = (
      await rpc.request("GetSceneItemBlendMode", {
        sceneName: from,
        sceneItemId: item.id,
      })
    ).sceneItemBlendMode;
    if (typeof mode !== "string" || !/^OBS_BLEND_[A-Z_]+$/.test(mode))
      throw new IntegrationFailure(
        "service",
        "OBS returned an incomplete scene blend mode.",
      );
    modes.set(item.id, mode);
  }
  if (Date.now() > deadline)
    throw new IntegrationFailure(
      "service",
      "Scene-copy inspection timed out. No new scene was requested.",
    );
  await rpc.request("CreateScene", { sceneName: to });
  for (const item of items) {
    if (Date.now() > deadline)
      throw new IntegrationFailure(
        "uncertain",
        "The scene copy stopped at its time limit. Review the partial scene in OBS before continuing.",
      );
    const result = await rpc.request("DuplicateSceneItem", {
      sceneName: from,
      sceneItemId: item.id,
      destinationSceneName: to,
    });
    const id = result.sceneItemId;
    if (typeof id !== "number" || !Number.isInteger(id) || id < 0)
      throw new IntegrationFailure(
        "uncertain",
        "OBS did not identify a copied scene item. Review the new scene.",
      );
    await rpc.request("SetSceneItemLocked", {
      sceneName: to,
      sceneItemId: id,
      sceneItemLocked: item.locked,
    });
    await rpc.request("SetSceneItemBlendMode", {
      sceneName: to,
      sceneItemId: id,
      sceneItemBlendMode: modes.get(item.id),
    });
  }
  if (
    typeof transition.transitionName === "string" &&
    transition.transitionName
  ) {
    await rpc.request("SetSceneSceneTransitionOverride", {
      sceneName: to,
      transitionName: transition.transitionName,
      transitionDuration: duration,
    });
  }
  const targetRaw = rawSceneItems(
    (await rpc.request("GetSceneItemList", { sceneName: to })).sceneItems,
  );
  const target = parsedSceneItems(targetRaw).sort((a, b) => a.index - b.index);
  if (
    target.length !== items.length ||
    target.some(
      (item, index) =>
        item.name !== items[index]!.name ||
        item.enabled !== items[index]!.enabled ||
        item.locked !== items[index]!.locked,
    )
  )
    throw new IntegrationFailure(
      "uncertain",
      "OBS did not confirm all copied scene items. Review the partial copy before continuing.",
    );
  if (fingerprint(raw, false) !== fingerprint(targetRaw, false))
    throw new IntegrationFailure(
      "uncertain",
      "OBS did not confirm the copied scene layout. Review the new scene.",
    );
  for (let index = 0; index < target.length; index++) {
    const mode = await rpc.request("GetSceneItemBlendMode", {
      sceneName: to,
      sceneItemId: target[index]!.id,
    });
    if (mode.sceneItemBlendMode !== modes.get(items[index]!.id))
      throw new IntegrationFailure(
        "uncertain",
        "OBS did not confirm a copied blend mode. Review the new scene.",
      );
  }
  const after = rawSceneItems(
    (await rpc.request("GetSceneItemList", { sceneName: from })).sceneItems,
  );
  if (fingerprint(raw) !== fingerprint(after))
    throw new IntegrationFailure(
      "uncertain",
      "The original scene changed during duplication. Review the copy; it was not replayed.",
    );
}
