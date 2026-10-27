import { describe, expect, it, vi } from "vitest";
import { sendOperatorMessage } from "../../../features/coforge/application/send-message";
import { IntegrationFailure } from "../../../features/coforge/domain/integration-failure";
import { emptyStore } from "./memory-storage";
const message = { text: "Welcome to the stream", channelId: "123", senderId: "456", senderName: "bot" };
describe("explicit operator message delivery", () => {
  it("saves intent before the provider and records only confirmed messages as sent", async () => {
    const { store, storage } = await emptyStore();
    await sendOperatorMessage(
      store,
      {
        send: async () => {
          expect((await storage.load()).data?.botReplies?.[0]?.status).toBe("sending");
          return "confirmed-message";
        },
      },
      message,
    );
    expect(store.snapshot().botReplies?.[0]).toMatchObject({ status: "sent", messageId: "confirmed-message" });
    expect(store.snapshot().chat[0]).toMatchObject({ text: message.text, externalId: "confirmed-message" });
  });
  it("holds an unknown outcome and never posts when intent persistence fails", async () => {
    const { store, storage } = await emptyStore();
    const send = vi.fn(async () => {
      throw new IntegrationFailure("uncertain", "Check the channel.");
    });
    await expect(sendOperatorMessage(store, { send }, message)).rejects.toThrow("Check the channel");
    expect(store.snapshot().botReplies?.[0]?.status).toBe("uncertain");
    expect(store.snapshot().chat).toHaveLength(0);
    storage.failNextSave = true;
    await expect(sendOperatorMessage(store, { send }, message)).rejects.toThrow("Disk full");
    expect(send).toHaveBeenCalledOnce();
  });
});
