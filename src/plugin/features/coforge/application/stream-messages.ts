import type { InternalState } from "./ports";
import { cleanText } from "../domain/sanitize";
import { streamMessageInput } from "../domain/stream-messages";
import { StudioError } from "../domain/errors";
import { recordOperation } from "./population";

export function saveStreamMessage(state: InternalState, input: unknown, id?: string): string {
  const value = streamMessageInput(input);
  const message = cleanText(value.text, 500);
  if (!message.trim() || [...message].length > 500) throw new StudioError("Use a message of 1–500 characters.");
  const existing = id ? state.streamMessages.find((item) => item.id === id) : undefined;
  if (id && !existing) throw new StudioError("Stream message not found.");
  const now = new Date().toISOString();
  if (existing) {
    Object.assign(existing, { text: message, intervalMinutes: value.intervalMinutes, updatedAt: now, active: false });
    cancelPending(state, existing.id);
    delete existing.nextDueAt;
  } else {
    if (state.streamMessages.length >= 100) throw new StudioError("You can maintain up to 100 recurring messages.");
    const id = crypto.randomUUID();
    state.streamMessages.push({
      id,
      text: message,
      intervalMinutes: value.intervalMinutes,
      active: false,
      channelId: state.integration.twitchBroadcasterId,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  }
  return existing.id;
}
function cancelPending(state: InternalState, id: string): void {
  for (const reply of state.botReplies)
    if (reply.streamMessageId === id && reply.status === "pending") reply.status = "cancelled";
}
export function activateStreamMessage(state: InternalState, id: string, active: boolean): void {
  const item = state.streamMessages.find((item) => item.id === id);
  if (!item) throw new StudioError("Stream message not found.");
  if (active && !state.integration.twitchBroadcasterId)
    throw new StudioError("Connect a Twitch channel before activating stream messages.");
  if (active && item.channelId && item.channelId !== state.integration.twitchBroadcasterId)
    throw new StudioError("This message belongs to another Twitch channel. Create a new message for this channel.");
  item.channelId ||= state.integration.twitchBroadcasterId;
  item.active = active;
  item.updatedAt = new Date().toISOString();
  if (active) delete item.lastError;
  if (active)
    for (const reply of state.botReplies)
      if (reply.streamMessageId === id && reply.status === "uncertain") reply.reviewedAt = new Date().toISOString();
  delete item.nextDueAt;
  delete item.streamKey;
  if (!active) cancelPending(state, id);
}
export function removeStreamMessage(state: InternalState, id: string): void {
  if (!state.streamMessages.some((item) => item.id === id)) throw new StudioError("Stream message not found.");
  cancelPending(state, id);
  state.streamMessages = state.streamMessages.filter((item) => item.id !== id);
}
/** No catch-up: a new live session or reconnect starts a fresh interval. */
export function scheduleStreamMessages(state: InternalState, streamId: string | null, now = Date.now()): void {
  const channelId = state.integration.twitchBroadcasterId;
  for (const item of [...state.streamMessages].sort((a, b) =>
    (a.lastQueuedAt ?? "").localeCompare(b.lastQueuedAt ?? ""),
  )) {
    if (!streamId || !state.integration.twitchBotReplies || !item.active || item.channelId !== channelId) {
      delete item.nextDueAt;
      delete item.streamKey;
      cancelPending(state, item.id);
      continue;
    }
    const key = `${channelId}:${streamId}`;
    if (item.streamKey !== key || !item.nextDueAt) {
      item.streamKey = key;
      item.nextDueAt = new Date(now + item.intervalMinutes * 60_000).toISOString();
      continue;
    }
    if (Date.parse(item.nextDueAt) > now) continue;
    const due = item.nextDueAt;
    item.nextDueAt = new Date(now + item.intervalMinutes * 60_000).toISOString();
    if (
      state.botReplies.some(
        (reply) => reply.streamMessageId === item.id && ["pending", "sending"].includes(reply.status),
      )
    )
      continue;
    if (state.botReplies.filter((reply) => ["pending", "sending"].includes(reply.status)).length >= 50) {
      item.lastError = "The delivery queue was full. This occurrence was skipped; the next interval remains scheduled.";
      recordOperation(state, "broadcast-skipped", "none");
      continue;
    }
    state.botReplies.push({
      id: `recurring:${item.id}:${due}`,
      streamMessageId: item.id,
      streamKey: key,
      channelId,
      senderId: state.integration.twitchBotUsesStreamer ? channelId : state.integration.twitchBotUserId,
      text: item.text,
      createdAt: new Date(now).toISOString(),
      status: "pending",
    });
    item.lastQueuedAt = new Date(now).toISOString();
    recordOperation(state, "broadcast-queued");
  }
}
