import { afterEach, describe, expect, it, vi } from "vitest";
import { ingestChat } from "../../../features/coforge/application/chat";
import { StudioStore } from "../../../features/coforge/application/studio-store";
import { emptyStore } from "./memory-storage";

afterEach(() => {
  vi.useRealTimers();
});
const viewer = { username: "River", userId: "99", source: "twitch" as const };
describe("player registration and participation", () => {
  it("requires explicit registration, preserves identity on rename, and does not register legacy contributors", async () => {
    const { store, storage } = await emptyStore();
    expect(await ingestChat(store, { ...viewer, text: "!request CFP-001 A bridge over the river" })).toMatchObject({
      ok: false,
    });
    expect(store.snapshot().ideas).toHaveLength(0);
    expect(store.snapshot().population?.players.filter((player) => player.registeredAt)).toHaveLength(0);
    expect(await ingestChat(store, { ...viewer, text: "!register" })).toMatchObject({ ok: true });
    expect(await ingestChat(store, { ...viewer, text: "!request CFP-001 A bridge over the river" })).toMatchObject({
      ok: true,
    });
    await ingestChat(store, { ...viewer, username: "NewRiver", text: "!register" });
    const reloaded = new StudioStore(storage);
    await reloaded.init();
    expect(reloaded.snapshot().population?.players.filter((player) => player.registeredAt)).toHaveLength(1);
    expect(reloaded.snapshot().ideas[0]?.authorId).toBe("twitch:99");
  });
  it("greets an unregistered viewer once per day and never repeats a redelivered greeting", async () => {
    const { store } = await emptyStore();
    await store.transaction((state) => {
      state.integration.twitchEnabled = true;
      state.integration.twitchBroadcasterId = "123";
      state.integration.twitchBotReplies = true;
    });
    await ingestChat(store, { ...viewer, text: "Hello", messageId: "first" });
    await ingestChat(store, { ...viewer, text: "Hello", messageId: "first" });
    await ingestChat(store, { ...viewer, text: "Still here", messageId: "second" });
    expect(store.snapshot().botReplies).toHaveLength(1);
    expect(store.snapshot().botReplies?.[0]?.text).toContain("!register");
    await ingestChat(store, { ...viewer, text: "!register", messageId: "registration" });
    await ingestChat(store, { ...viewer, text: "Thank you", messageId: "third" });
    expect(store.snapshot().population?.counters.greeted).toBe(1);
    expect(store.snapshot().botReplies).toHaveLength(2);
  });
  it("keeps restrictions and balances when re-registering, and a local block rejects all participation", async () => {
    const { store } = await emptyStore();
    await ingestChat(store, { ...viewer, text: "!register" });
    await store.transaction((state) => {
      const player = state.population.players[0]!;
      player.coins = 42;
      player.xp = 120;
      player.blocked = true;
    });
    for (const text of [
      "!register",
      "!request CFP-001 A bridge over the river",
      "!bug CFP-001 The bridge crashes",
      "!vote CF-001",
    ])
      expect(await ingestChat(store, { ...viewer, text })).toMatchObject({ ok: false });
    expect(store.snapshot().population?.players[0]).toMatchObject({ blocked: true, coins: 42, xp: 120 });
  });
  it("enforces a persisted five-minute feature cooldown, while a bug does not reset it", async () => {
    vi.useFakeTimers();
    vi.setSystemTime("2026-10-27T10:00:00Z");
    const { store, storage } = await emptyStore();
    await ingestChat(store, { ...viewer, text: "!register" });
    await ingestChat(store, { ...viewer, text: "!request CFP-001 A bridge over the river" });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(await ingestChat(store, { ...viewer, text: "!bug CFP-001 The river bridge crashes" })).toMatchObject({
      ok: true,
    });
    const reloaded = new StudioStore(storage);
    await reloaded.init();
    expect(
      await ingestChat(reloaded, { ...viewer, text: "!request CFP-001 A lantern beside the bridge" }),
    ).toMatchObject({ ok: false, message: expect.stringContaining("240") });
    await vi.advanceTimersByTimeAsync(240_000);
    expect(
      await ingestChat(reloaded, { ...viewer, text: "!request CFP-001 A lantern beside the bridge" }),
    ).toMatchObject({ ok: true });
  });
});
