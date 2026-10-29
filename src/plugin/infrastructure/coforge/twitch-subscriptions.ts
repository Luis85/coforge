import { object, TwitchError, type HttpResponse } from './twitch-http';

interface SubscriptionConnection { channelId: string; clientId: string; streamerId?: string }
type Query = (query: Record<string, string | readonly string[]>) => Promise<HttpResponse>;

/** Filtered endpoint contract: https://dev.twitch.tv/docs/api/reference/#get-broadcaster-subscriptions */
export async function readChannelSubscriptions(userIds: readonly string[], query: Query, connection: () => SubscriptionConnection): Promise<string[]> {
  if (!userIds.length) return [];
  if (userIds.length > 100 || userIds.some(id => !/^\d{1,40}$/.test(id)))
    throw new TwitchError('validation', 'Select at most 100 numeric Twitch users per subscription lookup.');
  const captured = connection();
  if (!/^\d+$/.test(captured.channelId) || !captured.clientId)
    throw new TwitchError('authorization', 'Connect the broadcaster before verifying subscriptions.');
  const requested = [...new Set(userIds)];
  const response = await query({ broadcaster_id: captured.channelId, user_id: requested, first: '100' });
  const current = connection();
  if (current.channelId !== captured.channelId || current.clientId !== captured.clientId || current.streamerId !== captured.channelId)
    throw new TwitchError('authorization', 'The Twitch connection changed. Refresh before verifying subscriptions.');
  const payload = object(response.json);
  const pagination = payload.pagination;
  const cursor = object(pagination).cursor;
  if (!Array.isArray(payload.data) || !pagination || typeof pagination !== 'object' || Array.isArray(pagination)
    || (cursor !== undefined && cursor !== ''))
    throw new TwitchError('service', 'Twitch returned incomplete subscription evidence. Base income remains available.');
  const subscribers = new Set<string>();
  for (const value of payload.data) {
    const row = object(value);
    if (row.broadcaster_id !== captured.channelId || typeof row.user_id !== 'string'
      || !requested.includes(row.user_id) || subscribers.has(row.user_id))
      throw new TwitchError('service', 'Twitch returned unrelated or duplicate subscription evidence.');
    subscribers.add(row.user_id);
  }
  return requested.filter(id => subscribers.has(id));
}
