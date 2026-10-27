// @vitest-environment happy-dom
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, disposePinia } from "pinia";
import { expect, it } from "vitest";
import { StudioService } from "../../../features/coforge/application/studio";
import { ObsWorkflow } from "../../../features/coforge/application/obs-workflow";
import { createDemoRunner } from "../../../features/coforge/application/demo-agent";
import type { ObsControlPort } from "../../../features/coforge/application/obs-port";
import type { ObsSnapshot } from "../../../features/coforge/domain/obs";
import StudioApp from "../../../presentation/components/coforge/StudioApp.vue";
import { coforgeKey, type CoforgeContext } from "../../../presentation/context/coforge-context";
import { MemoryStorage, nodeTimers } from "./memory-storage";

it("opens the preparation dashboard and controls the fake OBS stream through explicit buttons", async () => {
  const timers = nodeTimers();
  const runner = createDemoRunner(timers, [1, 1]);
  const studio = new StudioService(new MemoryStorage(), {
    timers,
    runners: { demo: runner, claude: runner },
    probeRuntime: async () => ({ cliAvailable: false, projectPath: null, allowImplementation: false }),
  });
  await studio.start();
  const calls: string[] = [];
  const historyExports: string[] = [];
  const state: ObsSnapshot = {
    epoch: 1,
    revision: 0,
    active: false,
    reconnecting: false,
    transitioning: false,
    programSceneId: "live",
    timecode: "00:00:00.000",
    observedAt: new Date().toISOString(),
    scenes: [
      { id: "live", name: "Gameplay" },
      { id: "brb", name: "BRB" },
    ],
  };
  const snapshot = async () => structuredClone({ ...state, revision: ++state.revision });
  const port: ObsControlPort = {
    detect: async () => ({ status: "found", running: false, passwordSaved: false }),
    open: async () => {
      calls.push("open");
      return snapshot();
    },
    connect: snapshot,
    snapshot,
    disconnect: () => undefined,
    dispose: () => undefined,
    savePassword: async () => undefined,
    subscribe: () => () => undefined,
    selectScene: async (id) => {
      calls.push(`scene:${id}`);
      state.programSceneId = id;
      return snapshot();
    },
    startStream: async () => {
      calls.push("start");
      state.active = true;
      return snapshot();
    },
    stopStream: async () => {
      calls.push("stop");
      state.active = false;
      return snapshot();
    },
  };
  const obs = new ObsWorkflow(studio.store, port);
  obs.start();
  const context: CoforgeContext = {
    studio,
    startupError: () => null,
    onNotice: () => () => undefined,
    host: {
      streamHistory: { list: async () => [{ id: 'fixture-stream', channelId: '123', startedAt: '2026-10-27T10:00:00Z', endedAt: null, samples: 2, lastSampleAt: '2026-10-27T10:01:00Z', peakObservedViewers: 15, meanObservedViewers: 12 }],
        export: async id => { historyExports.push(id); return '/private/synthetic-export.json'; } },
      obs,
      setSecret: () => false,
      hasSecret: () => false,
      openIdeaNote: async () => true,
      saveExport: async () => "export.json",
      publishBoard: async () => ({ folder: "", changed: false }),
      installPagesWorkflow: async () => ({ folder: "", workflow: "", created: false }),
    },
  };
  const pinia = createPinia();
  const wrapper = mount(StudioApp, { global: { plugins: [pinia], provide: { [coforgeKey as symbol]: context } } });
  const button = (text: string) => {
    const found = wrapper.findAll("button").find((button) => button.text() === text);
    if (!found) throw new Error(`Missing ${text}`);
    return found;
  };
  try {
    await flushPromises();
    expect(wrapper.get("h1").text()).toBe("Stream studio");
    await button('Export stream JSON').trigger('click');
    await flushPromises();
    expect(historyExports).toEqual(['fixture-stream']);
    expect(wrapper.find('[aria-label="Guided stream setup"]').exists()).toBe(true);
    await button("Skip setup for now").trigger("click");
    await flushPromises();
    expect(studio.state().setupGuide?.dismissed).toBe(true);
    await button("Guided setup").trigger("click");
    await flushPromises();
    expect(button("Go live").attributes("disabled")).toBeDefined();
    await button("Open OBS Studio").trigger("click");
    await flushPromises();
    expect(calls).toEqual(["open"]);
    const selects = wrapper.get('[aria-label="OBS connection and scenes"]').findAll("select");
    await selects[0]!.setValue("live");
    await selects[1]!.setValue("brb");
    await wrapper.get('[aria-label="OBS connection and scenes"] form').trigger("submit");
    await flushPromises();
    await studio.updateIntegration({
      twitchEnabled: true,
      twitchBroadcasterId: "channel",
      twitchClientId: "fixture-client",
    });
    await studio.store.updateRuntime({
      twitch: {
        phase: "connected",
        message: "Connected",
        canManage: true,
        canModerate: true,
        canChat: true,
        streamer: { id: "channel", login: "streamer", scopes: ['moderator:read:followers', 'channel:read:subscriptions'] },
        bot: { id: "channel", login: "streamer", scopes: [] },
        channel: {
          id: "channel",
          login: "streamer",
          name: "Streamer",
          title: "Game development",
          categoryId: "1",
          categoryName: "Development",
        },
      },
    });
    const reviewStep = wrapper.findAll("button").find((item) => item.text().startsWith("5."));
    await reviewStep!.trigger("click");
    await flushPromises();
    expect(button("Finish setup").attributes("disabled")).toBeDefined();
    const reviewLabel = wrapper.findAll("label").find((item) => item.text().includes("I reviewed the destination"));
    await reviewLabel!.get("input").setValue(true);
    await flushPromises();
    expect(button("Finish setup").attributes("disabled")).toBeUndefined();
    await button("Finish setup").trigger("click");
    await flushPromises();
    expect(studio.state().setupGuide?.completedAt).toBeTruthy();
    expect(calls).toEqual(["open"]);
    await button("Prepare stream").trigger("click");
    await flushPromises();
    expect(button("Go live").attributes("disabled")).toBeUndefined();
    await button("Go live").trigger("click");
    await flushPromises();
    await button("Pause / BRB").trigger("click");
    await flushPromises();
    expect(calls).toEqual(["open", "start", "scene:brb"]);
    await button("Resume stream").trigger("click");
    await flushPromises();
    await button("Stop stream").trigger("click");
    await flushPromises();
    expect(calls).toEqual(["open", "start", "scene:brb", "scene:live", "stop"]);
  } finally {
    wrapper.unmount();
    obs.dispose();
    disposePinia(pinia);
    await studio.stop();
  }
});
