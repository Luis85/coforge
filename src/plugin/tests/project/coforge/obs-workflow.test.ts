import { describe, expect, it } from "vitest";
import { ObsWorkflow } from "../../../features/coforge/application/obs-workflow";
import type { ObsControlPort } from "../../../features/coforge/application/obs-port";
import type { ObsSnapshot } from "../../../features/coforge/domain/obs";
import { emptyStore } from "./memory-storage";
import { IntegrationFailure } from "../../../features/coforge/domain/integration-failure";
import { StudioStore } from "../../../features/coforge/application/studio-store";

function fakeObs() {
  const snapshot: ObsSnapshot = {
    epoch: 1,
    revision: 1,
    scenes: [
      { id: "live", name: "Gameplay" },
      { id: "brb", name: "Be right back" },
      { id: "interview", name: "Interview" },
    ],
    programSceneId: "live",
    active: false,
    reconnecting: false,
    transitioning: false,
    timecode: "00:00:00.000",
    observedAt: new Date().toISOString(),
  };
  const calls: string[] = [];
  const read = async () => structuredClone({ ...snapshot, revision: ++snapshot.revision });
  const port: ObsControlPort = {
    connect: read,
    disconnect: () => undefined,
    snapshot: read,
    subscribe: () => () => undefined,
    dispose: () => undefined,
    savePassword: async () => undefined,
    selectScene: async (id) => {
      calls.push(`scene:${id}`);
      snapshot.programSceneId = id;
      return read();
    },
    startStream: async () => {
      calls.push("start");
      snapshot.active = true;
      return read();
    },
    stopStream: async () => {
      calls.push("stop");
      snapshot.active = false;
      return read();
    },
  };
  return {
    port,
    calls,
    setScene: (id: string) => {
      snapshot.programSceneId = id;
    },
    reconnecting: () => {
      snapshot.reconnecting = true;
    },
  };
}
describe("streamer OBS workflow", () => {
  it("persists the actual resume scene before an uncertain BRB switch and recovers it after reload", async () => {
    const { store, storage } = await emptyStore();
    const obs = fakeObs();
    const workflow = new ObsWorkflow(store, obs.port);
    await workflow.configure({ liveSceneId: "live", breakSceneId: "brb" });
    await workflow.connect();
    await workflow.prepare();
    await workflow.goLive();
    obs.setScene("interview");
    const select = obs.port.selectScene;
    obs.port.selectScene = async (id) => {
      expect(store.obsContext().resumeSceneId).toBe("interview");
      await select(id);
      throw new IntegrationFailure("uncertain", "OBS confirmation was lost.");
    };
    await expect(workflow.pause()).rejects.toMatchObject({ kind: "uncertain" });
    workflow.dispose();
    const restarted = new StudioStore(storage);
    await restarted.init();
    obs.port.selectScene = select;
    const recovered = new ObsWorkflow(restarted, obs.port);
    recovered.start();
    await recovered.connect();
    await recovered.resume();
    expect(obs.calls.at(-1)).toBe("scene:interview");
    recovered.dispose();
  });
  it("rejects concurrent start attempts and can stop a reconnecting live output", async () => {
    const { store } = await emptyStore();
    const obs = fakeObs();
    const workflow = new ObsWorkflow(store, obs.port);
    await workflow.configure({ liveSceneId: "live", breakSceneId: "brb" });
    await workflow.connect();
    await workflow.prepare();
    const results = await Promise.allSettled([workflow.goLive(), workflow.goLive()]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(obs.calls.filter((call) => call === "start")).toHaveLength(1);
    obs.reconnecting();
    await workflow.stop();
    expect(obs.calls.at(-1)).toBe("stop");
    workflow.dispose();
  });
  it("holds an unknown mutation across reload without starting again", async () => {
    const { store, storage } = await emptyStore();
    const obs = fakeObs();
    const workflow = new ObsWorkflow(store, obs.port);
    await workflow.configure({ liveSceneId: "live" });
    await workflow.connect();
    await workflow.prepare();
    obs.port.startStream = async () => {
      obs.calls.push("start");
      throw new IntegrationFailure("uncertain", "Refresh OBS before retrying.");
    };
    await expect(workflow.goLive()).rejects.toMatchObject({ kind: "uncertain" });
    const restarted = new StudioStore(storage);
    await restarted.init();
    const recovered = new ObsWorkflow(restarted, obs.port);
    recovered.start();
    await expect(recovered.goLive()).rejects.toMatchObject({ kind: "uncertain" });
    expect(obs.calls).toEqual(["start"]);
    recovered.dispose();
    workflow.dispose();
  });
  it("prepares, goes live, uses BRB without stopping, restores the scene and then stops", async () => {
    const { store } = await emptyStore();
    const obs = fakeObs();
    const workflow = new ObsWorkflow(store, obs.port);
    const events: string[] = [];
    store.subscribeEvents((event) => {
      events.push(event.type);
    });
    await workflow.configure({ liveSceneId: "live", breakSceneId: "brb" });
    await workflow.connect();
    expect(obs.calls).toEqual([]);
    await workflow.prepare();
    await workflow.goLive();
    await workflow.pause();
    expect(obs.calls).toEqual(["start", "scene:brb"]);
    expect(store.snapshot().runtime.obs).toMatchObject({ onBreak: true, snapshot: { active: true } });
    await workflow.resume();
    await workflow.stop();
    expect(obs.calls).toEqual(["start", "scene:brb", "scene:live", "stop"]);
    expect(events).toEqual(
      expect.arrayContaining([
        "stream-prepare-requested",
        "stream-prepared",
        "stream-go-live-requested",
        "stream-started",
        "stream-paused",
        "stream-resumed",
        "stream-stopped",
      ]),
    );
    workflow.dispose();
  });
  it("does not start OBS when the requested interaction cannot be persisted", async () => {
    const { store, storage } = await emptyStore();
    const obs = fakeObs();
    const workflow = new ObsWorkflow(store, obs.port);
    await workflow.configure({ liveSceneId: "live", breakSceneId: "brb" });
    await workflow.connect();
    await workflow.prepare();
    storage.failNextSave = true;
    await expect(workflow.goLive()).rejects.toThrow();
    expect(obs.calls).not.toContain("start");
    workflow.dispose();
  });
});
