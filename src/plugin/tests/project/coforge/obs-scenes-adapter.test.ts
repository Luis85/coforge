import { describe, expect, it } from "vitest";
import { ObsScenesAdapter } from "../../../infrastructure/coforge/obs-scenes-adapter";
import {
  ObsSceneServer,
  OBS_SCENE_SERVER_REQUESTS,
} from "../../support/coforge/obs-scene-server";
const kit = () => {
  const server = new ObsSceneServer();
  return {
    server,
    adapter: new ObsScenesAdapter(
      server,
      server.snapshot,
      () => OBS_SCENE_SERVER_REQUESTS,
      server.context,
    ),
  };
};
describe("OBS scene RPC adapter", () => {
  it("adds a prepared music source disabled without enabling other scene memberships", async () => {
    const { server, adapter } = kit();
    const detail = await adapter.inspect("scene-intro");
    const source = detail.sources.find(source => source.kind === "input")!;
    const result = await adapter.execute({ kind: "item-add", sceneId: detail.sceneId, sourceId: source.id, enabled: false, expected: detail.context });
    expect(server.requests.find(request => request.type === "CreateSceneItem")?.data).toMatchObject({ sourceName: source.name, sceneItemEnabled: false });
    expect(result.detail?.items.find(item => item.sourceId === source.id)?.enabled).toBe(false);
  });
  it("duplicates a scene with shared sources, layout, visibility, order, locks and blend modes without switching program", async () => {
    const { server, adapter } = kit();
    const original = await adapter.inspect("scene-game");
    const result = await adapter.execute({
      kind: "scene-duplicate",
      sceneId: original.sceneId,
      name: "Copied game",
      expected: original.context,
    });
    expect(
      result.detail?.items.map((item) => [
        item.name,
        item.index,
        item.enabled,
        item.locked,
      ]),
    ).toEqual(
      original.items.map((item) => [
        item.name,
        item.index,
        item.enabled,
        item.locked,
      ]),
    );
    expect(result.snapshot.programSceneId).toBe("scene-game");
    expect(
      server.requests.some((request) => request.type === "DuplicateSceneItem"),
    ).toBe(true);
    expect(
      server.scenes.find((scene) => scene.name === "Copied game")?.items[1]
        ?.source,
    ).toBe(server.inputs[1]);
  });
  it("reads back visibility and order, and removes only the selected membership", async () => {
    const { server, adapter } = kit();
    let detail = await adapter.inspect("scene-game");
    const item = detail.items[0]!;
    detail = (
      await adapter.execute({
        kind: "item-visible",
        sceneId: detail.sceneId,
        itemId: item.id,
        enabled: true,
        expected: detail.context,
      })
    ).detail!;
    expect(detail.items.find((row) => row.id === item.id)?.enabled).toBe(true);
    detail = (
      await adapter.execute({
        kind: "item-order",
        sceneId: detail.sceneId,
        itemId: item.id,
        direction: "down",
        expected: detail.context,
      })
    ).detail!;
    expect(detail.items.find((row) => row.id === item.id)?.index).toBe(0);
    detail = (
      await adapter.execute({
        kind: "item-remove",
        sceneId: detail.sceneId,
        itemId: item.id,
        confirmed: true,
        confirmedName: item.name,
        expected: detail.context,
      })
    ).detail!;
    expect(detail.items.some((row) => row.id === item.id)).toBe(false);
    expect(
      server.scenes.find((scene) => scene.id === "scene-break")?.items,
    ).toHaveLength(1);
  });
  it("rejects nested scene cycles and stale review contexts before mutation", async () => {
    const { server, adapter } = kit();
    await server.request("CreateSceneItem", {
      sceneName: "Example break",
      sourceName: "Example gameplay",
    });
    let detail = await adapter.inspect("scene-game");
    server.requests.length = 0;
    await expect(
      adapter.execute({
        kind: "item-add",
        sceneId: detail.sceneId,
        sourceId: "scene:scene-break",
        expected: detail.context,
      }),
    ).rejects.toMatchObject({ kind: "validation" });
    expect(
      server.requests.every((request) => request.type.startsWith("Get")),
    ).toBe(true);
    detail = await adapter.inspect("scene-intro");
    server.version++;
    await expect(
      adapter.execute({
        kind: "scene-delete",
        sceneId: detail.sceneId,
        confirmedName: detail.name,
        confirmed: true,
        expected: detail.context,
      }),
    ).rejects.toMatchObject({ kind: "validation" });
  });
  it("holds ignored mutations and partial copies as uncertain, without deleting or replaying the new scene", async () => {
    const { server, adapter } = kit();
    const detail = await adapter.inspect("scene-game");
    server.ignoreVisibility = true;
    await expect(
      adapter.execute({
        kind: "item-visible",
        sceneId: detail.sceneId,
        itemId: detail.items[0]!.id,
        enabled: true,
        expected: detail.context,
      }),
    ).rejects.toMatchObject({ kind: "uncertain" });
    server.ignoreVisibility = false;
    server.failDuplicateAt = 2;
    await expect(
      adapter.execute({
        kind: "scene-duplicate",
        sceneId: detail.sceneId,
        name: "Partial copy",
        expected: server.context(),
      }),
    ).rejects.toMatchObject({ kind: "uncertain" });
    expect(server.scenes.some((scene) => scene.name === "Partial copy")).toBe(
      true,
    );
    expect(
      server.requests.some((request) => request.type === "RemoveScene"),
    ).toBe(false);
  });
});
