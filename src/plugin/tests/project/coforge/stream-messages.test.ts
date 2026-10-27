import { afterEach, describe, expect, it, vi } from "vitest";
import {
  activateStreamMessage,
  saveStreamMessage,
  scheduleStreamMessages,
} from "../../../features/coforge/application/stream-messages";
import { emptyStore } from "./memory-storage";
import { StudioStore } from "../../../features/coforge/application/studio-store";
afterEach(() => {
  vi.useRealTimers();
});
describe("recurring stream messages", () => {
  it("starts paused, queues once per live interval and cancels unsent work on pause", async () => {
    vi.useFakeTimers();
    const { store } = await emptyStore();
    await store.transaction((state) => {
      state.integration.twitchBroadcasterId = "123";
      state.integration.twitchBotReplies = true;
    });
    const id = await store.transaction((state) =>
      saveStreamMessage(state, { text: "Join The Hood with !register", intervalMinutes: 5 }),
    );
    expect(store.snapshot().streamMessages?.[0]?.active).toBe(false);
    await store.transaction((state) => {
      activateStreamMessage(state, id, true);
      scheduleStreamMessages(state, "stream-1");
    });
    expect(store.snapshot().botReplies).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(300_000);
    await store.transaction((state) => scheduleStreamMessages(state, "stream-1"));
    await store.transaction((state) => scheduleStreamMessages(state, "stream-1"));
    expect(store.snapshot().botReplies).toHaveLength(1);
    await store.transaction((state) => activateStreamMessage(state, id, false));
    expect(store.snapshot().botReplies?.[0]?.status).toBe("cancelled");
  });
  it("does not catch up offline intervals or transfer messages into another channel", async () => {
    vi.useFakeTimers();
    const { store } = await emptyStore();
    const id = await store.transaction((state) => {
      state.integration.twitchBroadcasterId = "123";
      state.integration.twitchBotReplies = true;
      const id = saveStreamMessage(state, { text: "Our community message", intervalMinutes: 1 });
      activateStreamMessage(state, id, true);
      return id;
    });
    await store.transaction((state) => scheduleStreamMessages(state, "first"));
    await store.transaction((state) => scheduleStreamMessages(state, null));
    await vi.advanceTimersByTimeAsync(3_600_000);
    await store.transaction((state) => scheduleStreamMessages(state, "second"));
    expect(store.snapshot().botReplies).toHaveLength(0);
    await store.transaction((state) => {
      state.integration.twitchBroadcasterId = "456";
    });
    await expect(store.transaction((state) => activateStreamMessage(state, id, true))).rejects.toThrow(
      "another Twitch channel",
    );
  });
  it("holds an unconfirmed recurring send after restart until an explicit reviewed activation", async () => {
    const { store, storage } = await emptyStore();
    const id = await store.transaction((state) => {
      state.integration.twitchBroadcasterId = "123";
      state.integration.twitchBotReplies = true;
      const id = saveStreamMessage(state, { text: "Join The Hood", intervalMinutes: 5 });
      activateStreamMessage(state, id, true);
      state.botReplies.push({
        id: "interrupted-send",
        streamMessageId: id,
        channelId: "123",
        senderId: "123",
        text: "Join The Hood",
        createdAt: new Date().toISOString(),
        status: "sending",
      });
      return id;
    });
    const restarted = new StudioStore(storage);
    await restarted.init();
    expect(restarted.snapshot().streamMessages?.[0]).toMatchObject({
      active: false,
      lastError: expect.stringContaining("unconfirmed"),
    });
    expect(restarted.snapshot().botReplies?.[0]?.status).toBe("uncertain");
    await restarted.transaction((state) => activateStreamMessage(state, id, true));
    const reviewed = new StudioStore(storage);
    await reviewed.init();
    expect(reviewed.snapshot().streamMessages?.[0]?.active).toBe(true);
    expect(reviewed.snapshot().botReplies?.[0]).toMatchObject({ status: "uncertain", reviewedAt: expect.any(String) });
  });
});
