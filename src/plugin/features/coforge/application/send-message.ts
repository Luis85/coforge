import type { StudioStore } from "./studio-store";
import type { ChatSenderPort } from "./integration-ports";
import { IntegrationFailure } from "../domain/integration-failure";
import { recordOperation } from "./population";

/** Explicit operator send with durable intent. A failed confirmation never implies the public message was absent. */
export async function sendOperatorMessage(
  store: StudioStore,
  sender: ChatSenderPort,
  input: { text: string; channelId: string; senderId: string; senderName: string },
): Promise<void> {
  if (!input.text.trim() || [...input.text].length > 500)
    throw new IntegrationFailure("validation", "Chat messages must contain 1–500 characters.");
  const id = crypto.randomUUID();
  await store.transaction((state) => {
    state.botReplies.push({
      id,
      text: input.text,
      channelId: input.channelId,
      senderId: input.senderId,
      createdAt: new Date().toISOString(),
      status: "sending",
    });
  });
  try {
    const messageId = await sender.send(input.text, undefined, input.senderId, input.channelId);
    await store.transaction((state) => {
      const reply = state.botReplies.find((reply) => reply.id === id);
      if (reply) {
        reply.status = "sent";
        reply.messageId = messageId;
      }
      state.chat.push({
        id: crypto.randomUUID(),
        userId: "system:coforge",
        username: input.senderName,
        text: input.text,
        kind: "system",
        source: "twitch",
        externalId: messageId,
        twitchChannelId: input.channelId,
        createdAt: new Date().toISOString(),
      });
      recordOperation(state, "reply-confirmed");
    });
  } catch (error) {
    const uncertain = !(error instanceof IntegrationFailure) || ["uncertain", "service"].includes(error.kind);
    try {
      await store.transaction((state) => {
        const reply = state.botReplies.find((reply) => reply.id === id);
        if (reply) {
          reply.status = uncertain ? "uncertain" : "failed";
          reply.error =
            error instanceof IntegrationFailure
              ? error.message
              : "Delivery was not confirmed. Check Twitch before sending again.";
        }
        recordOperation(state, uncertain ? "reply-uncertain" : "reply-failed", uncertain ? "uncertain" : "none");
      });
    } catch {
      /* Stored sending intent becomes uncertain on recovery; never automatically replay an operator send. */
    }
    throw error;
  }
}
