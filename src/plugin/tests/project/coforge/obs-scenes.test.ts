import { describe, expect, it } from "vitest";
import { ObsSceneWorkflow } from "../../../features/coforge/application/obs-scene-workflow";
import type { ObsScenePort } from "../../../features/coforge/application/obs-scene-port";
import {
  sceneContext,
  type ObsSceneDetail,
} from "../../../features/coforge/domain/obs-scenes";
import type { ObsSnapshot } from "../../../features/coforge/domain/obs";
import { emptyStore } from "./memory-storage";
import { IntegrationFailure } from "../../../features/coforge/domain/integration-failure";

async function kit() {
  const { store, storage } = await emptyStore();
  const snapshot: ObsSnapshot = {
    epoch: 1,
    revision: 1,
    sceneVersion: 0,
    sceneCollectionVersion: 0,
    scenes: [
      { id: "game", name: "Game" },
      { id: "break", name: "Break" },
      { id: "extra", name: "Extra" },
    ],
    programSceneId: "game",
    active: true,
    reconnecting: false,
    transitioning: false,
    timecode: "",
    observedAt: new Date().toISOString(),
  };
  await store.transaction((state) => {
    state.obsSettings = {
      endpoint: "ws://localhost:4455/",
      executable: "",
      passwordSecret: "obs-reference",
      autoConnect: false,
      liveSceneId: "game",
      breakSceneId: "break",
    };
  });
  const detail: ObsSceneDetail = {
    context: sceneContext(snapshot),
    sceneId: "extra",
    name: "Extra",
    items: [],
    sources: [],
    available: ["scene-rename", "scene-delete"],
    observedAt: snapshot.observedAt,
  };
  const calls: string[] = [];
  let busy = false;
  let uncertain = false;
  const port: ObsScenePort = {
    inspect: async () => detail,
    execute: async (action) => {
      calls.push(action.kind);
      return {
        snapshot,
        detail: { ...detail, sceneId: "renamed", name: "Renamed" },
        renamed: { from: "extra", to: "renamed" },
      };
    },
  };
  const workflow = new ObsSceneWorkflow(store, port, {
    claim: async () => {
      if (busy) throw new IntegrationFailure("validation", "Busy");
      busy = true;
    },
    release: async () => {
      busy = false;
    },
    fresh: async () => snapshot,
    accept: async () => undefined,
    uncertain: () => uncertain,
    invalidate: () => undefined,
    failed: (_message, unknown) => {
      uncertain = unknown;
    },
  });
  return { store, storage, snapshot, calls, port, workflow };
}
describe("OBS scene application boundary", () => {
  it("protects program, assigned and unconfirmed scene deletions without an OBS mutation", async () => {
    const app = await kit();
    for (const [sceneId, confirmedName, confirmed] of [
      ["game", "Game", true],
      ["break", "Break", true],
      ["extra", "Extra", false],
    ] as const)
      await expect(
        app.workflow.execute({
          kind: "scene-delete",
          sceneId,
          confirmedName,
          confirmed,
          expected: sceneContext(app.snapshot),
        }),
      ).rejects.toThrow();
    expect(app.calls).toEqual([]);
  });
  it("journals before effects and updates fallback-name scene references after a confirmed rename", async () => {
    const app = await kit();
    await app.store.transaction((state) => {
      state.obsSettings!.liveSceneId = "extra";
    });
    const events: string[] = [];
    app.store.subscribeEvents((event) => {
      events.push(event.type);
    });
    app.port.execute = async () => {
      app.calls.push("rename");
      expect(app.store.obsContext().command).toMatchObject({
        kind: "scene-rename",
        status: "pending",
      });
      return {
        snapshot: app.snapshot,
        detail: null,
        renamed: { from: "extra", to: "renamed" },
      };
    };
    await app.workflow.execute({
      kind: "scene-rename",
      sceneId: "extra",
      name: "Renamed",
      expected: sceneContext(app.snapshot),
    });
    expect(app.store.obsContext().settings.liveSceneId).toBe("renamed");
    expect(events).toContain("obs-scene-action-confirmed");
    app.storage.failNextSave = true;
    await expect(
      app.workflow.execute({
        kind: "scene-create",
        name: "New",
        expected: sceneContext(app.snapshot),
      }),
    ).rejects.toThrow();
    expect(app.calls).toEqual(["rename"]);
  });
  it("holds an unknown scene outcome and never replays it", async () => {
    const app = await kit();
    app.port.execute = async () => {
      app.calls.push("create");
      throw new IntegrationFailure("uncertain", "Connection lost");
    };
    const action = {
      kind: "scene-create",
      name: "New",
      expected: sceneContext(app.snapshot),
    };
    await expect(app.workflow.execute(action)).rejects.toMatchObject({
      kind: "uncertain",
    });
    await expect(app.workflow.execute(action)).rejects.toMatchObject({
      kind: "uncertain",
    });
    expect(app.calls).toEqual(["create"]);
    expect((await app.storage.load()).data?.obsCommand?.status).toBe(
      "uncertain",
    );
  });
});
