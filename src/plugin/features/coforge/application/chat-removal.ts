import type { StudioStore } from "./studio-store";
import type { ChatRemoval } from "../domain/chat-removal";
import { recordOperation } from "./population";
/** Remove the retained text as well as the display. Never replay moderation-deleted messages in a capture view. */
export async function removeTwitchChat(
  store: StudioStore,
  removal: ChatRemoval,
): Promise<void> {
  await store.transaction((state) => {
    if (state.integration.twitchBroadcasterId !== removal.channelId) return;
    const at =
      removal.at && Number.isFinite(Date.parse(removal.at))
        ? removal.at
        : new Date().toISOString();
    const previous = state.ingestMeta.chatRemovals;
    const history =
      previous?.channelId === removal.channelId
        ? previous
        : { channelId: removal.channelId, messages: [], users: [] };
    if (removal.type === "message" && removal.messageId)
      history.messages = [
        ...new Set([...history.messages, removal.messageId]),
      ].slice(-1000);
    if (
      removal.type === "all" &&
      (!history.clearAt || Date.parse(at) > Date.parse(history.clearAt))
    )
      history.clearAt = at;
    if (removal.type === "user" && removal.userId) {
      const current = history.users.find((user) => user.id === removal.userId);
      if (!current || Date.parse(at) > Date.parse(current.at))
        history.users = [
          ...history.users.filter((user) => user.id !== removal.userId),
          { id: removal.userId, at },
        ].slice(-1000);
    }
    state.ingestMeta.chatRemovals = history;
    state.chat = state.chat.filter(
      (message) =>
        message.source !== "twitch" ||
        message.twitchChannelId !== removal.channelId ||
        (removal.type === "message"
          ? message.externalId !== removal.messageId
          : removal.type === "user"
            ? message.userId !== `twitch:${removal.userId}`
            : false),
    );
    recordOperation(state, "twitch-chat-removed");
  });
}
