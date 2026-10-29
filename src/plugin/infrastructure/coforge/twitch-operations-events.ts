import type { TwitchActivity, TwitchParameters, TwitchResource } from '../../features/coforge/domain/twitch-operations';
import { cleanLine } from '../../features/coforge/domain/sanitize';
import { object } from './twitch-http';
import { startTwitch, type TwitchConnectionStatus, type TwitchTransport } from './twitch';
import { operationsEventSubscriptions, TWITCH_OPERATIONS_EVENT_TYPES } from './twitch-operations-event-catalogue';
export { operationsEventResources, operationsEventScopes, operationsEventSubscriptions } from './twitch-operations-event-catalogue';

export interface TwitchOperationsEventConfig {
  clientId: string; broadcasterId: string; resources: readonly TwitchResource[]; scopes: readonly string[];
}
const text = (value: unknown, max = 500): string | undefined => typeof value === 'string' ? cleanLine(value).slice(0, max) : undefined;
const numericId = (value: unknown): string | undefined => typeof value === 'string' && /^\d{1,40}$/.test(value) ? value : undefined;

/** A deliberately small private projection; unrelated payload fields are never retained. */
function details(event: Record<string, unknown>, type: string): TwitchParameters {
  const result: TwitchParameters = {};
  for (const key of ['id', 'status', 'title', 'user_input', 'reason', 'text', 'tier', 'type', 'category_name', 'category_id', 'duration_seconds']) {
    const value = event[key];
    if (typeof value === 'string') result[key] = cleanLine(value).slice(0, 500);
    else if (typeof value === 'number' && Number.isFinite(value)) result[key] = value;
  }
  for (const key of ['is_gift', 'is_anonymous', 'is_permanent']) if (typeof event[key] === 'boolean') result[key] = event[key];
  if (typeof event.message_id === 'string') result.msg_id = event.message_id.slice(0, 200);
  const message = text(object(event.message).text);
  if (message !== undefined) result.message = message;
  const reward = object(event.reward);
  if (typeof reward.id === 'string') result.reward_id = reward.id.slice(0, 100);
  if (typeof reward.title === 'string') result.reward_title = cleanLine(reward.title).slice(0, 45);
  if (typeof reward.cost === 'number' && Number.isFinite(reward.cost)) result.reward_cost = reward.cost;
  if (type.startsWith('channel.channel_points_custom_reward_redemption.') && typeof event.id === 'string') result.redemption_id = event.id.slice(0, 100);
  return result;
}

export function parseTwitchActivity(value: unknown, channelId: string): TwitchActivity | null {
  const frame = object(value); const metadata = object(frame.metadata); const payload = object(frame.payload);
  const subscription = object(payload.subscription); const condition = object(subscription.condition); const event = object(payload.event);
  const type = subscription.type; const id = metadata.message_id; const at = metadata.message_timestamp;
  if (metadata.message_type !== 'notification' || typeof type !== 'string' || !TWITCH_OPERATIONS_EVENT_TYPES.includes(type)
    || typeof id !== 'string' || !id || id.length > 200 || typeof at !== 'string' || !Number.isFinite(Date.parse(at))) return null;
  const raid = type === 'channel.raid';
  const incoming = raid && event.to_broadcaster_user_id === channelId && condition.to_broadcaster_user_id === channelId;
  const outgoing = raid && event.from_broadcaster_user_id === channelId && condition.from_broadcaster_user_id === channelId;
  if (raid ? incoming === outgoing : event.broadcaster_user_id !== channelId || condition.broadcaster_user_id !== channelId) return null;
  if (condition.moderator_user_id !== undefined && condition.moderator_user_id !== channelId || condition.user_id !== undefined && condition.user_id !== channelId) return null;
  const actorId = numericId(raid ? incoming ? event.from_broadcaster_user_id : event.to_broadcaster_user_id : event.user_id);
  const actorName = text(raid ? incoming ? event.from_broadcaster_user_name : event.to_broadcaster_user_name : event.user_name, 80);
  const amountValue = raid ? event.viewers : type === 'channel.cheer' ? event.bits : type === 'channel.subscription.gift' ? event.total : undefined;
  const amount = typeof amountValue === 'number' && Number.isFinite(amountValue) && amountValue >= 0 ? amountValue : undefined;
  const label = outgoing ? 'Outgoing raid' : activityLabel(type);
  const summary = `${actorName ? actorName + ': ' : ''}${label}${amount !== undefined ? ' (' + amount + ')' : ''}`;
  const streamId = type === 'stream.online' && typeof event.id === 'string' ? event.id.slice(0, 100) : undefined;
  const retainedDetails = details(event, type);
  if (raid) retainedDetails.raid_direction = incoming ? 'incoming' : 'outgoing';
  return { id, channelId, type, at: new Date(at).toISOString(), summary,
    ...(actorId ? { actorId } : {}), ...(actorName ? { actorName } : {}), ...(amount === undefined ? {} : { amount }),
    ...(streamId ? { streamId } : {}), details: retainedDetails };
}

function activityLabel(type: string): string {
  const labels: Readonly<Record<string, string>> = {
    'stream.online': 'Stream started', 'stream.offline': 'Stream ended', 'channel.update': 'Channel information changed',
    'channel.follow': 'Followed the channel', 'channel.subscribe': 'Subscribed', 'channel.subscription.end': 'Subscription ended',
    'channel.subscription.gift': 'Gifted subscriptions', 'channel.subscription.message': 'Shared a resubscription message',
    'channel.cheer': 'Cheered Bits', 'channel.raid': 'Incoming raid', 'channel.ad_break.begin': 'Ad break started',
    'channel.ban': 'Channel restriction applied', 'channel.unban': 'Channel restriction removed',
    'automod.message.hold': 'Message held for moderation', 'automod.message.update': 'Held message reviewed',
  };
  return labels[type] ?? type.replace(/^channel\./, '').replaceAll('_', ' ').replaceAll('.', ' · ');
}

/** Broadcaster events reuse the guarded lifecycle, separately from the chat-account session. */
export function startTwitchOperationsEvents(config: TwitchOperationsEventConfig, transport: TwitchTransport,
  onActivity: (activity: TwitchActivity) => Promise<unknown>, onStatus: (status: TwitchConnectionStatus) => void): () => void {
  const subscriptions = operationsEventSubscriptions(config.resources, config.scopes, config.broadcasterId);
  if (!subscriptions.length) return () => {};
  const permitted = new Set(subscriptions.map(item => item.type));
  let liveStreamId: string | undefined;
  return startTwitch({ clientId: config.clientId, broadcasterId: config.broadcasterId, botUserId: config.broadcasterId }, {
    ...transport, subscriptions, onNotification: async frame => {
      const activity = parseTwitchActivity(frame, config.broadcasterId);
      if (!activity || !permitted.has(activity.type)) return;
      if (activity.type === 'stream.online') liveStreamId = activity.streamId;
      if (liveStreamId && !activity.streamId) activity.streamId = liveStreamId;
      await onActivity(activity);
      if (activity.type === 'stream.offline') liveStreamId = undefined;
    },
  }, () => Promise.resolve(), status => {
    if (status.phase === 'connecting' || status.phase === 'error') liveStreamId = undefined;
    onStatus({ ...status, message: status.message.replaceAll('chatbot', 'broadcaster').replaceAll('chat', 'activity') });
  });
}
