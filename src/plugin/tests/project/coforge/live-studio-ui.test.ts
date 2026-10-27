// @vitest-environment happy-dom
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, disposePinia } from "pinia";
import { expect, it, vi } from "vitest";
import LiveStudioPanel from "../../../presentation/components/coforge/LiveStudioPanel.vue";
import {
  coforgeKey,
  type CoforgeContext,
} from "../../../presentation/context/coforge-context";
import { useStudioStore } from "../../../presentation/stores/coforge-studio";
import { StudioService } from "../../../features/coforge/application/studio";
import { createDemoRunner } from "../../../features/coforge/application/demo-agent";
import { MemoryStorage, nodeTimers } from "./memory-storage";

it("keeps actual zero viewers, marks stale data unavailable and owns its display timer", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-27T10:00:00Z"));
  const timers = nodeTimers();
  const runner = createDemoRunner(timers);
  const studio = new StudioService(new MemoryStorage(), {
    timers,
    runners: { demo: runner, claude: runner },
    probeRuntime: async () => ({
      cliAvailable: false,
      projectPath: null,
      allowImplementation: false,
    }),
  });
  await studio.start();
  await studio.store.updateRuntime({
    obs: {
      connection: "connected",
      busy: false,
      prepared: false,
      onBreak: false,
      uncertain: false,
      snapshot: {
        epoch: 1,
        revision: 1,
        scenes: [],
        programSceneId: null,
        active: true,
        reconnecting: false,
        transitioning: false,
        timecode: "",
        observedAt: new Date().toISOString(),
      },
    },
    twitch: {
      phase: "connected",
      message: "",
      canChat: true,
      canManage: true,
      canModerate: true,
    },
    liveStudio: {
      channelId: "",
      viewers: {
        checkedAt: new Date().toISOString(),
        value: { state: "live", viewers: 0, streamId: "1", startedAt: null },
      },
      obs: {
        checkedAt: new Date().toISOString(),
        value: {
          epoch: 1,
          state: "live",
          startedAt: null,
          scene: "Game",
          health: { stats_activeFps: 60 },
        },
      },
      chat: {
        messages: 0,
        commands: 0,
        observedSeconds: 60,
        checkedAt: new Date().toISOString(),
      },
    },
  });
  const context: CoforgeContext = {
    studio,
    startupError: () => null,
    onNotice: () => () => undefined,
    host: {
      setSecret: () => false,
      hasSecret: () => false,
      openIdeaNote: async () => false,
      saveExport: async () => "",
      publishBoard: async () => ({ folder: "", changed: false }),
      installPagesWorkflow: async () => ({
        folder: "",
        workflow: "",
        created: false,
      }),
    },
  };
  const pinia = createPinia();
  const store = useStudioStore(pinia);
  store.state = studio.state();
  const wrapper = mount(LiveStudioPanel, {
    global: { plugins: [pinia], provide: { [coforgeKey as symbol]: context } },
  });
  try {
    await flushPromises();
    expect(
      wrapper.get('[aria-label="Live viewers"] .cf-live-value').text(),
    ).toBe("0");
    expect(wrapper.get('[aria-label="Live OBS health"]').text()).toContain(
      "60",
    );
    await vi.advanceTimersByTimeAsync(40000);
    expect(
      wrapper.get('[aria-label="Live viewers"] .cf-live-value').text(),
    ).toBe("Unavailable");
    expect(wrapper.get('[aria-label="Live OBS health"]').text()).toContain(
      "stale",
    );
  } finally {
    wrapper.unmount();
    store.dispose();
    disposePinia(pinia);
    await studio.stop();
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  }
});
