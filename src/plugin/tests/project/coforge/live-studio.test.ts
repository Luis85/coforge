import { afterEach, describe, expect, it, vi } from "vitest";
import { LiveStudioMonitor } from "../../../features/coforge/application/live-studio-monitor";
import { emptyStore, nodeTimers } from "./memory-storage";
import type { ObsMetrics } from "../../../features/coforge/domain/stream-metrics";
afterEach(() => vi.useRealTimers());
describe("live studio monitor", () => {
  it("derives bitrate despite inferred start-time jitter and discards an old channel response", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-27T10:00:00Z"));
    const { store } = await emptyStore();
    await store.transaction((state) => {
      state.integration.twitchBroadcasterId = "old";
    });
    let reading = 0;
    let finish!: (value: {
      state: "live";
      viewers: number;
      streamId: string;
      startedAt: null;
    }) => void;
    const monitor = new LiveStudioMonitor(
      store,
      {
        obs: async () => ({
          state: "live",
          startedAt: new Date(
            Date.parse("2026-10-27T09:00:00Z") + reading * 10,
          ).toISOString(),
          scene: null,
          health: { outputBytes: ++reading * 1000000 },
        }),
        twitch: () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      },
      nodeTimers(),
    );
    monitor.start();
    await vi.advanceTimersByTimeAsync(5000);
    expect(
      store.snapshot().runtime.liveStudio?.obs.value?.health.bitrateKbps,
    ).toBe(1600);
    await store.transaction((state) => {
      state.integration.twitchBroadcasterId = "new";
    });
    await vi.advanceTimersByTimeAsync(5000);
    finish({
      state: "live",
      viewers: 999,
      streamId: "old-stream",
      startedAt: null,
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(store.snapshot().runtime.liveStudio).toMatchObject({
      channelId: "new",
      viewers: { value: null },
    });
    await monitor.stop();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("tracks rolling observed chat and independent viewer/OBS cadences without archive writes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-27T10:00:00Z"));
    const { store, storage } = await emptyStore();
    await store.transaction((state) => {
      state.integration.twitchBroadcasterId = "123";
    });
    await store.updateRuntime({
      twitch: {
        phase: "connected",
        message: "Connected",
        canChat: true,
        canManage: true,
        canModerate: true,
      },
    });
    let obsCalls = 0;
    let twitchCalls = 0;
    const monitor = new LiveStudioMonitor(
      store,
      {
        obs: async () => {
          obsCalls++;
          return {
            state: "live",
            startedAt: null,
            scene: "Game",
            health: {
              outputBytes: obsCalls * 1000000,
              outputTotalFrames: 1000,
              outputSkippedFrames: 1,
              stats_activeFps: 60,
            },
          };
        },
        twitch: async () => {
          twitchCalls++;
          return {
            state: "live",
            viewers: 0,
            streamId: "stream",
            startedAt: "2026-10-27T10:00:00Z",
          };
        },
      },
      nodeTimers(),
    );
    monitor.start();
    await vi.advanceTimersByTimeAsync(0);
    const saves = storage.saves;
    await store.transaction((state) => {
      state.population.counters["twitch-message-observed"] = 7;
      state.population.counters["twitch-command-observed"] = 2;
    });
    await vi.advanceTimersByTimeAsync(15000);
    expect(obsCalls).toBe(4);
    expect(twitchCalls).toBe(2);
    expect(store.snapshot().runtime.liveStudio).toMatchObject({
      viewers: { value: { viewers: 0 } },
      chat: { messages: 7, commands: 2 },
    });
    expect(storage.saves).toBe(saves + 1);
    await store.updateRuntime({
      twitch: {
        phase: "error",
        message: "",
        canChat: false,
        canManage: false,
        canModerate: false,
      },
    });
    await vi.advanceTimersByTimeAsync(60000);
    expect(store.snapshot().runtime.liveStudio?.chat.messages).toBeNull();
    await monitor.stop();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("does not let a stalled viewer call block OBS, and never publishes after disposal", async () => {
    vi.useFakeTimers();
    const { store } = await emptyStore();
    let obsCalls = 0;
    let finish!: (value: ObsMetrics) => void;
    const pending = new Promise<ObsMetrics>((done) => {
      finish = done;
    });
    const monitor = new LiveStudioMonitor(
      store,
      {
        obs: async () => {
          obsCalls++;
          return { state: "live", startedAt: null, scene: null, health: {} };
        },
        twitch: () => new Promise(() => {}),
      },
      nodeTimers(),
    );
    monitor.start();
    await vi.advanceTimersByTimeAsync(10000);
    expect(obsCalls).toBe(3);
    await monitor.stop();
    expect(vi.getTimerCount()).toBe(0);
    const second = new LiveStudioMonitor(
      store,
      {
        obs: () => pending,
        twitch: async () => ({
          state: "unavailable",
          viewers: null,
          streamId: null,
          startedAt: null,
        }),
      },
      nodeTimers(),
    );
    second.start();
    await vi.advanceTimersByTimeAsync(0);
    await second.stop();
    const before = JSON.stringify(store.snapshot().runtime.liveStudio);
    finish({
      state: "live",
      startedAt: null,
      scene: "Late response",
      health: {},
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(JSON.stringify(store.snapshot().runtime.liveStudio)).toBe(before);
  });
});
