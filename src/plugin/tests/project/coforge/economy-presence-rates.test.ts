import { afterEach, describe, expect, it, vi } from "vitest";
import { ingestChat } from "../../../features/coforge/application/chat";
import { creditPresence } from "../../../features/coforge/application/economy";
import { defaultEconomyDefinition } from "../../../features/coforge/domain/command-economy";
import { emptyStore } from "./memory-storage";
afterEach(() => vi.useRealTimers());
describe("observed presence currency and subscriber rates", () => {
  it("funds an unregistered observed viewer without retroactively awarding registration XP", async () => {
    vi.useFakeTimers();
    vi.setSystemTime("2026-10-28T12:00:00Z");
    const { store } = await emptyStore();
    await ingestChat(store, {
      username: "River",
      userId: "99",
      source: "twitch",
      text: "Hello",
    });
    await store.transaction((state) => {
      state.integration.twitchBroadcasterId = "123";
    });
    const from = Date.now();
    await vi.advanceTimersByTimeAsync(60_000);
    await store.transaction((state) =>
      creditPresence(state, {
        id: "before",
        channelId: "123",
        from,
        to: Date.now(),
        playerIds: ["twitch:99"],
      }),
    );
    expect(store.snapshot().population!.players[0]).toMatchObject({
      coins: 1,
      xp: 0,
      registeredPresenceSeconds: 0,
    });
    await ingestChat(store, {
      username: "River",
      userId: "99",
      source: "twitch",
      text: "!register",
    });
    await vi.advanceTimersByTimeAsync(60_000);
    await store.transaction((state) =>
      creditPresence(state, {
        id: "after",
        channelId: "123",
        from: from + 60_000,
        to: Date.now(),
        playerIds: ["twitch:99"],
      }),
    );
    expect(store.snapshot().population!.players[0]).toMatchObject({
      coins: 2,
      xp: 1,
      presenceSeconds: 120,
      registeredPresenceSeconds: 60,
    });
  });
  it("uses a fresh current-channel subscriber total instead of adding it to base and falls back honestly", async () => {
    vi.useFakeTimers();
    vi.setSystemTime("2026-10-28T12:00:00Z");
    const { store } = await emptyStore();
    await ingestChat(store, {
      username: "River",
      userId: "99",
      source: "twitch",
      text: "Hello",
    });
    await store.transaction((state) => {
      state.integration.twitchBroadcasterId = "123";
      state.population.rules.coinsPerMinute = 2;
      const definition = defaultEconomyDefinition();
      definition.premiumCurrencyPerMinute = 5;
      state.population.economy = {
        configurationRevision: 1,
        definition,
        usages: [],
        redemptions: [],
        usageTombstones: {},
        droppedUsages: 0,
      };
    });
    const start = Date.now();
    await vi.advanceTimersByTimeAsync(60_000);
    await store.transaction((state) =>
      creditPresence(state, {
        id: "fresh",
        channelId: "123",
        from: start,
        to: Date.now(),
        playerIds: ["twitch:99"],
        subscribers: {
          channelId: "123",
          checkedAt: new Date().toISOString(),
          playerIds: ["twitch:99"],
        },
      }),
    );
    expect(store.snapshot().population!.players[0]?.coins).toBe(5);
    await vi.advanceTimersByTimeAsync(60_000);
    await store.transaction((state) =>
      creditPresence(state, {
        id: "stale",
        channelId: "123",
        from: start + 60_000,
        to: Date.now(),
        playerIds: ["twitch:99"],
        subscribers: {
          channelId: "123",
          checkedAt: new Date(start).toISOString(),
          playerIds: ["twitch:99"],
        },
      }),
    );
    expect(store.snapshot().population!.players[0]?.coins).toBe(7);
    await vi.advanceTimersByTimeAsync(60_000);
    await store.transaction((state) =>
      creditPresence(state, {
        id: "other",
        channelId: "123",
        from: start + 120_000,
        to: Date.now(),
        playerIds: ["twitch:99"],
        subscribers: {
          channelId: "elsewhere",
          checkedAt: new Date().toISOString(),
          playerIds: ["twitch:99"],
        },
      }),
    );
    expect(store.snapshot().population!.players[0]?.coins).toBe(9);
    expect(store.snapshot().population!.players[0]?.xp).toBe(0);
  });
});
