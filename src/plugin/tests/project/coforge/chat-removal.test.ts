import { describe, expect, it } from "vitest";
import { emptyStore } from "./memory-storage";
import { ingestChat } from "../../../features/coforge/application/chat";
import { removeTwitchChat } from "../../../features/coforge/application/chat-removal";
describe("public chat moderation", () => {
  it("removes retained text, rejects late deleted messages and protects a changed channel", async () => {
    const { store } = await emptyStore();
    await store.transaction((state) => {
      state.integration.twitchBroadcasterId = "123";
    });
    const message = {
      username: "Viewer",
      userId: "twitch:456",
      text: "Public message",
      source: "twitch" as const,
      messageId: "message-1",
      channelId: "123",
      sentAt: "2026-10-27T10:00:00Z",
    };
    await ingestChat(store, message);
    expect(store.snapshot().chat).toHaveLength(1);
    await removeTwitchChat(store, {
      channelId: "123",
      type: "message",
      messageId: "message-1",
    });
    expect(store.snapshot().chat).toEqual([]);
    await removeTwitchChat(store, {
      channelId: "123",
      type: "message",
      messageId: "late-message",
    });
    expect(
      (await ingestChat(store, { ...message, messageId: "late-message" }))
        .duplicate,
    ).toBe(true);
    expect(store.snapshot().chat).toEqual([]);
    await removeTwitchChat(store, {
      channelId: "123",
      type: "user",
      userId: "456",
      at: "2026-10-27T10:01:00Z",
    });
    await ingestChat(store, { ...message, messageId: "late-user-message" });
    expect(store.snapshot().chat).toEqual([]);
    await ingestChat(store, {
      ...message,
      messageId: "new-message",
      sentAt: "2026-10-27T10:02:00Z",
    });
    expect(store.snapshot().chat).toHaveLength(1);
    await removeTwitchChat(store, { channelId: "other", type: "all" });
    expect(store.snapshot().chat).toHaveLength(1);
    await removeTwitchChat(store, { channelId: "123", type: "all" });
    expect(store.snapshot().chat).toEqual([]);
  });
});
