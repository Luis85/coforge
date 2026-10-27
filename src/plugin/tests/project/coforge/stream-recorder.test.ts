import { afterEach, describe, expect, it, vi } from "vitest";
import { StreamRecorder } from "../../../features/coforge/application/stream-recorder";
import type { StreamHistory, StreamObservation } from "../../../features/coforge/domain/stream-metrics";
import type { StreamHistoryPort } from "../../../features/coforge/application/stream-metrics-ports";
import { emptyStore, nodeTimers } from "./memory-storage";

afterEach(() => vi.useRealTimers());
function memoryHistory() {
  const files = new Map<string, StreamHistory>();
  let active: string | null = null;
  const history: StreamHistoryPort = {
    active: async () => (active ? structuredClone(files.get(active) ?? null) : null),
    read: async (id) => structuredClone(files.get(id) ?? null),
    save: async (value) => {
      files.set(value.id, structuredClone(value));
      active = value.endedAt ? null : value.id;
    },
    list: async () => [],
  };
  return { history, files };
}
const observation = (): StreamObservation => ({
  channelId: "123",
  at: new Date().toISOString(),
  twitch: {
    state: "live",
    streamId: "1",
    startedAt: "2026-10-27T10:00:00Z",
    viewers: 10,
    channel: null,
    followers: null,
    subscribers: null,
    subscriptionPoints: null,
    unavailable: ["followers", "subscriptions"],
  },
  obs: { state: "unavailable", startedAt: null, scene: null, health: {} },
});
describe("minute stream recording", () => {
  it("keeps stream baselines across reload, preserves unavailable totals and separates broadcasts", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-27T10:00:00Z"));
    const { store } = await emptyStore();
    const { history, files } = memoryHistory();
    let id = "1";
    const worker = new StreamRecorder(
      store,
      history,
      { capture: async () => ({ ...observation(), twitch: { ...observation().twitch, streamId: id } }) },
      nodeTimers(),
    );
    await worker.start();
    await store.transaction((state) => {
      state.population.counters["twitch-message-observed"] = 5;
    });
    await vi.advanceTimersByTimeAsync(60000);
    expect(files.get("twitch-123-1")?.samples[1]).toMatchObject({
      twitch: { followers: null, subscribers: null },
      coforge: { streamCounters: { "twitch-message-observed": 5 } },
    });
    id = "2";
    await worker.capture();
    expect(files.size).toBe(2);
    expect(files.get("twitch-123-1")?.endReason).toBe("new-broadcast");
    expect(files.get("twitch-123-2")?.baselineCounters["twitch-message-observed"]).toBe(5);
    await worker.stop();
  });
  it("does not publish a saved event after a failed file write and does not persist an in-flight capture after stopping", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-27T10:00:00Z"));
    const { store } = await emptyStore();
    const { history, files } = memoryHistory();
    const events: string[] = [];
    store.subscribeEvents((event) => {
      events.push(event.type);
    });
    history.save = async () => {
      throw new Error("Disk full");
    };
    const worker = new StreamRecorder(store, history, { capture: async () => observation() }, nodeTimers());
    await worker.start();
    expect(events).not.toContain("stream-snapshot-saved");
    expect(store.snapshot().runtime.streamRecording?.phase).toBe("error");
    await worker.stop();
    let resolve!: (value: StreamObservation) => void;
    const pending = new Promise<StreamObservation>((done) => {
      resolve = done;
    });
    const waiting = new StreamRecorder(store, history, { capture: () => pending }, nodeTimers());
    const start = waiting.start();
    const stop = waiting.stop();
    resolve(observation());
    await Promise.all([start, stop]);
    expect(files.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("attaches a late Twitch stream ID to the same OBS history and retains the final partial-minute activity", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-27T10:00:00Z"));
    const { store } = await emptyStore();
    const { history, files } = memoryHistory();
    let phase = 0;
    const source = async (): Promise<StreamObservation> => {
      const value = observation();
      if (phase === 0)
        value.twitch = { ...value.twitch, state: "unavailable", streamId: null, startedAt: null, viewers: null };
      value.obs = {
        state: phase === 2 ? "offline" : "live",
        startedAt: phase === 2 ? null : "2026-10-27T10:00:00Z",
        scene: "Gameplay",
        health: {},
      };
      if (phase === 2)
        value.twitch = { ...value.twitch, state: "offline", streamId: null, startedAt: null, viewers: null };
      return value;
    };
    const worker = new StreamRecorder(store, history, { capture: source }, nodeTimers());
    await worker.start();
    phase = 1;
    await vi.advanceTimersByTimeAsync(60000);
    expect(files.size).toBe(1);
    const id = [...files.keys()][0]!;
    expect(files.get(id)?.twitchStreamId).toBe("1");
    await store.transaction((state) => {
      state.population.counters["twitch-message-observed"] = 7;
    });
    phase = 2;
    await worker.capture();
    expect(files.get(id)?.finalSnapshot?.coforge.streamCounters["twitch-message-observed"]).toBe(7);
    await worker.stop();
  });
  it("records one object per stream, samples each minute, resumes and never backfills offline gaps", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-27T10:00:00Z"));
    const { store } = await emptyStore();
    const files = new Map<string, StreamHistory>();
    let active: string | null = null;
    const history: StreamHistoryPort = {
      active: async () => (active ? structuredClone(files.get(active) ?? null) : null),
      read: async (id) => structuredClone(files.get(id) ?? null),
      save: async (value) => {
        files.set(value.id, structuredClone(value));
        active = value.endedAt ? null : value.id;
      },
      list: async () => [],
    };
    let live = false;
    const capture = async (): Promise<StreamObservation> => ({
      channelId: "123",
      at: new Date().toISOString(),
      twitch: {
        state: live ? "live" : "offline",
        streamId: live ? "stream-1" : null,
        startedAt: live ? "2026-10-27T10:00:00Z" : null,
        viewers: live ? 12 : null,
        channel: null,
        followers: 100,
        subscribers: 4,
        subscriptionPoints: 8,
        unavailable: [],
      },
      obs: { state: "unavailable", startedAt: null, scene: null, health: {} },
    });
    const worker = new StreamRecorder(store, history, { capture }, nodeTimers());
    await worker.start();
    expect(files.size).toBe(0);
    live = true;
    await worker.capture();
    await Promise.all([worker.capture(), worker.capture()]);
    expect(files.get("twitch-123-stream-1")?.samples).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(60000);
    expect(files.get("twitch-123-stream-1")?.samples).toHaveLength(2);
    await worker.stop();
    vi.setSystemTime(Date.now() + 5 * 60000);
    const restored = new StreamRecorder(store, history, { capture }, nodeTimers());
    await restored.start();
    const saved = files.get("twitch-123-stream-1")!;
    expect(saved.samples).toHaveLength(3);
    expect(saved.samples[2]?.gapSeconds).toBeGreaterThan(0);
    live = false;
    await restored.capture();
    expect(files.get("twitch-123-stream-1")?.endedAt).toBeTruthy();
    await vi.advanceTimersByTimeAsync(120000);
    expect(files.get("twitch-123-stream-1")?.samples).toHaveLength(3);
    await restored.stop();
    expect(vi.getTimerCount()).toBe(0);
  });
});
