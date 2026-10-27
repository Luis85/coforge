import type { ObsSceneRpc } from "./obs-scenes-data";
import { rawSceneItems } from "./obs-scenes-data";
import type { ObsExistingSource } from "../../features/coforge/domain/obs-scenes";
import { IntegrationFailure } from "../../features/coforge/domain/integration-failure";
/** Existing nested scenes/groups may be reused, but adding a reference must not create a cycle. */
export async function obsSceneReferences(
  rpc: ObsSceneRpc,
  source: ObsExistingSource,
  target: string,
  sceneNames: ReadonlySet<string>,
): Promise<boolean> {
  const seen = new Set<string>();
  const visit = async (
    name: string,
    group: boolean,
    depth: number,
  ): Promise<boolean> => {
    if (name === target) return true;
    if (seen.has(name)) return false;
    if (depth > 32 || seen.size >= 200)
      throw new IntegrationFailure(
        "validation",
        "This nested-scene graph is too large to verify here. Manage it in OBS Studio.",
      );
    seen.add(name);
    const response = await rpc.request(
      group ? "GetGroupSceneItemList" : "GetSceneItemList",
      { sceneName: name },
    );
    for (const item of rawSceneItems(response.sceneItems)) {
      if (typeof item.sourceName !== "string")
        throw new IntegrationFailure(
          "service",
          "OBS returned an invalid nested source.",
        );
      if (
        (item.isGroup === true || sceneNames.has(item.sourceName)) &&
        (await visit(item.sourceName, item.isGroup === true, depth + 1))
      )
        return true;
    }
    return false;
  };
  return source.kind !== "input"
    ? visit(source.name, source.kind === "group", 0)
    : false;
}
export async function checkObsSceneGraph(
  rpc: ObsSceneRpc,
  source: ObsExistingSource,
  target: string,
  sceneNames: ReadonlySet<string>,
): Promise<void> {
  if (await obsSceneReferences(rpc, source, target, sceneNames))
    throw new IntegrationFailure(
      "validation",
      "This source would create a nested-scene cycle. Choose another source.",
    );
}
