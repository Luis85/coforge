import type { StudioStore } from "./studio-store";
import type { ChatInput } from "./chat";
import { cleanLine, cleanText } from "../domain/sanitize";
import { recordOperation } from "./population";
/** Observe a real Twitch echo for public chat, without command intake, game registration or another reply. */
export async function observeBotChat(
  store: StudioStore,
  input: ChatInput,
): Promise<void> {
  await store.transaction((state) => {
    const bot = state.integration.twitchBotUsesStreamer
      ? state.integration.twitchBroadcasterId
      : state.integration.twitchBotUserId;
    if (
      !state.integration.twitchEnabled ||
      input.channelId !== state.integration.twitchBroadcasterId ||
      input.userId !== `twitch:${bot}` ||
      !input.messageId
    )
      return;
    if (
      state.chat.some(
        (message) =>
          message.source === "twitch" &&
          message.externalId === input.messageId &&
          message.twitchChannelId === input.channelId,
      )
    )
      return;
    if (
      state.ingestMeta.chatRemovals?.channelId === input.channelId &&
      state.ingestMeta.chatRemovals.messages.includes(input.messageId)
    )
      return;
    const at =
      input.sentAt && Number.isFinite(Date.parse(input.sentAt))
        ? input.sentAt
        : new Date().toISOString();
    const removals = state.ingestMeta.chatRemovals;
    if (
      removals?.channelId === input.channelId &&
      ((removals.clearAt && Date.parse(at) <= Date.parse(removals.clearAt)) ||
        removals.users.some(
          (user) =>
            `twitch:${user.id}` === input.userId &&
            Date.parse(at) <= Date.parse(user.at),
        ))
    )
      return;
    state.chat.push({
      id: crypto.randomUUID(),
      userId: input.userId,
      username: cleanLine(input.username, 50),
      text: cleanText(input.text, 2000),
      createdAt: at,
      kind: "message",
      source: "twitch",
      externalId: input.messageId,
      twitchChannelId: input.channelId,
    });
    recordOperation(state, "twitch-message-observed");
  });
}
