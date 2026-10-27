import { afterEach, describe, expect, it, vi } from "vitest";
import { ingestChat } from "../../../features/coforge/application/chat";
import { creditPresence } from "../../../features/coforge/application/economy";
import { playerRank } from "../../../features/coforge/domain/population";
import { StudioStore } from "../../../features/coforge/application/studio-store";
import { emptyStore } from "./memory-storage";
afterEach(() => {
  vi.useRealTimers();
});
const viewer = { username: "River", userId: "99", source: "twitch" as const };
describe("evidenced player economy", () => {
  it("credits complete live presence intervals once and preserves partial minutes through restart", async () => {
    vi.useFakeTimers();
    vi.setSystemTime("2026-10-27T10:00:00Z");
    const { store, storage } = await emptyStore();
    await ingestChat(store, { ...viewer, text: "!register" });
    await store.transaction((state) => {
      state.integration.twitchBroadcasterId = "123";
    });
    const sample = {
      id: "sample-1",
      channelId: "123",
      from: Date.now(),
      to: Date.now() + 30_000,
      playerIds: ["twitch:99"],
    };
    await vi.advanceTimersByTimeAsync(30_000);
    await store.transaction((state) => creditPresence(state, sample));
    const restarted = new StudioStore(storage);
    await restarted.init();
    await restarted.transaction((state) => creditPresence(state, sample));
    await vi.advanceTimersByTimeAsync(30_000);
    await restarted.transaction((state) =>
      creditPresence(state, { ...sample, id: "sample-2", from: sample.to, to: sample.to + 30_000 }),
    );
    expect(restarted.snapshot().population?.players[0]).toMatchObject({ presenceSeconds: 60, coins: 1, xp: 1 });
    expect(restarted.snapshot().population?.rewards).toHaveLength(1);
    await restarted.transaction((state) =>
      creditPresence(state, { ...sample, id: "gap", from: sample.from - 300_000, to: Date.now() }),
    );
    expect(restarted.snapshot().population?.players[0]?.presenceSeconds).toBe(60);
  });
  it("awards each trusted feature milestone once across re-screening and restart", async () => {
    const { store, storage } = await emptyStore();
    await ingestChat(store, { ...viewer, text: "!register" });
    await ingestChat(store, { ...viewer, text: "!request CFP-001 A bridge over the river" });
    const screen = () =>
      store.transaction((state) => {
        state.ideas[0]!.status = "screened";
        state.ideas[0]!.screening = {
          verdict: "clear",
          reason: "Reviewed",
          signals: [],
          checkedAt: new Date().toISOString(),
          provider: "demo",
        };
      });
    await screen();
    await store.transaction((state) => {
      state.ideas[0]!.status = "inbox";
      delete state.ideas[0]!.screening;
    });
    await screen();
    expect(store.snapshot().population?.players[0]).toMatchObject({ xp: 10, reputation: 10 });
    await store.transaction((state) => {
      state.ideas[0]!.status = "shipped";
    });
    const restarted = new StudioStore(storage);
    await restarted.init();
    await restarted.transaction(() => undefined);
    const population = restarted.snapshot().population!;
    expect(population.players[0]).toMatchObject({ xp: 60, reputation: 60, coins: 0 });
    expect(population.rewards).toHaveLength(2);
    expect(playerRank(population.players[0]!, population.environment)).toBe(1);
  });
});
