import type { TwitchAction, TwitchParameters, TwitchResource } from '../../features/coforge/domain/twitch-operations';
import { TwitchError } from './twitch-http';
import type { TwitchEndpointRequest, TwitchQuery } from './twitch-operations-http';

type Endpoint = Omit<TwitchEndpointRequest, 'scopes'>;
const moderatorQuery = (channel: string) => ({ broadcaster_id: channel, moderator_id: channel });
const selected = (values: TwitchParameters, names: readonly string[]): TwitchParameters => Object.fromEntries(Object.entries(values).filter(([name]) => names.includes(name)));
const queryValues = (values: TwitchParameters): TwitchQuery => Object.fromEntries(Object.entries(values).map(([name, value]) => [name, Array.isArray(value) ? value : String(value)]));
const READ_PARAMETERS: Partial<Record<TwitchResource, readonly string[]>> = {
  'blocked-terms': ['after', 'first'], 'unban-requests': ['after', 'first', 'status', 'user_id'],
  rewards: ['id'], redemptions: ['after', 'first', 'reward_id', 'id', 'status'],
  polls: ['after', 'first', 'id'], predictions: ['after', 'first', 'id'],
  clips: ['after', 'first', 'started_at', 'ended_at'], markers: ['after', 'first', 'video_id'],
  followers: ['after', 'first', 'user_id'], subscribers: ['after', 'first', 'user_id'],
  bits: ['count', 'period', 'started_at', 'user_id'], moderators: ['after', 'first', 'user_id'], vips: ['after', 'first', 'user_id'],
  schedule: ['after', 'first', 'id', 'start_time'], videos: ['after', 'first'],
};

/** Endpoint request shapes follow https://dev.twitch.tv/docs/api/reference/. */
export function twitchReadEndpoint(resource: TwitchResource, channel: string, values: TwitchParameters): Endpoint {
  const allowed = READ_PARAMETERS[resource] ?? [];
  if (Object.keys(values).some(key => !allowed.includes(key))) throw new TwitchError('validation', 'Unsupported Twitch read parameter.');
  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value) || typeof value === 'boolean' || typeof value === 'string' && value.length > 4096)
      throw new TwitchError('validation', `Invalid Twitch ${key} parameter.`);
    const maximum = resource === 'polls' ? 20 : resource === 'predictions' || resource === 'schedule' ? 25 : 100;
    if (['first', 'count'].includes(key) && (!Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > maximum))
      throw new TwitchError('validation', `Choose a Twitch page size from 1 to ${maximum}.`);
    if (['user_id', 'video_id'].includes(key) && (typeof value !== 'string' || !/^\d{1,40}$/.test(value))) throw new TwitchError('validation', `Invalid Twitch ${key} parameter.`);
    if (['started_at', 'ended_at', 'start_time'].includes(key) && (typeof value !== 'string' || !Number.isFinite(Date.parse(value)))) throw new TwitchError('validation', `Invalid Twitch ${key} date.`);
  }
  const page = queryValues(selected(values, ['after', 'first']));
  const own = { broadcaster_id: channel };
  const mod = moderatorQuery(channel);
  switch (resource) {
    case 'chat-settings': return { method: 'GET', path: 'chat/settings', query: own };
    case 'automod-settings': return { method: 'GET', path: 'moderation/automod/settings', query: mod };
    case 'blocked-terms': return { method: 'GET', path: 'moderation/blocked_terms', query: { ...mod, ...page } };
    case 'unban-requests': return { method: 'GET', path: 'moderation/unban_requests', query: { ...mod, status: String(values.status ?? 'pending'), ...page, ...queryValues(selected(values, ['user_id'])) } };
    case 'shield': return { method: 'GET', path: 'moderation/shield_mode', query: mod };
    case 'ads': return { method: 'GET', path: 'channels/ads', query: own };
    case 'rewards': return { method: 'GET', path: 'channel_points/custom_rewards', query: { ...own, ...queryValues(selected(values, ['id'])) } };
    case 'redemptions': {
      if (typeof values.reward_id !== 'string' || !/^[\w-]{1,100}$/.test(values.reward_id)) throw new TwitchError('validation', 'Select a reward ID before loading its redemptions.');
      return { method: 'GET', path: 'channel_points/custom_rewards/redemptions', query: { ...own, reward_id: values.reward_id, ...(values.id && !values.status ? {} : { status: String(values.status ?? 'UNFULFILLED') }), ...page, ...queryValues(selected(values, ['id'])) } };
    }
    case 'polls': return { method: 'GET', path: 'polls', query: { ...own, ...page, ...queryValues(selected(values, ['id'])) } };
    case 'predictions': return { method: 'GET', path: 'predictions', query: { ...own, ...page, ...queryValues(selected(values, ['id'])) } };
    case 'clips': return { method: 'GET', path: 'clips', query: { ...own, ...page, ...queryValues(selected(values, ['started_at', 'ended_at'])) } };
    case 'markers': return { method: 'GET', path: 'streams/markers', query: { ...(values.video_id ? { video_id: String(values.video_id) } : { user_id: channel }), ...page } };
    case 'followers': return { method: 'GET', path: 'channels/followers', query: { ...own, ...page, ...queryValues(selected(values, ['user_id'])) } };
    case 'subscribers': return { method: 'GET', path: 'subscriptions', query: { ...own, ...page, ...queryValues(selected(values, ['user_id'])) } };
    case 'bits': return { method: 'GET', path: 'bits/leaderboard', query: queryValues(selected(values, ['count', 'period', 'started_at', 'user_id'])) };
    case 'moderators': return { method: 'GET', path: 'moderation/moderators', query: { ...own, ...page, ...queryValues(selected(values, ['user_id'])) } };
    case 'vips': return { method: 'GET', path: 'channels/vips', query: { ...own, ...page, ...queryValues(selected(values, ['user_id'])) } };
    case 'goals': return { method: 'GET', path: 'goals', query: own };
    case 'schedule': return { method: 'GET', path: 'schedule', query: { ...own, ...page, ...queryValues(selected(values, ['id', 'start_time'])) } };
    case 'videos': return { method: 'GET', path: 'videos', query: { user_id: channel, type: 'archive', ...page } };
    case 'hype-train': return { method: 'GET', path: 'hypetrain/status', query: own };
    case 'charity': return { method: 'GET', path: 'charity/campaigns', query: own };
    case 'activity': case 'automod-queue': throw new TwitchError('validation', 'This resource uses the locally collected EventSub history.');
  }
}

export function twitchWriteEndpoint(action: TwitchAction, channel: string): Endpoint {
  const p = action.parameters; const own = { broadcaster_id: channel }; const mod = moderatorQuery(channel);
  const body = selected(p, Object.keys(p).filter(name => name !== 'id'));
  switch (action.name) {
    case 'chat-settings': return { method: 'PATCH', path: 'chat/settings', query: mod, body: p };
    case 'automod-settings': return { method: 'PUT', path: 'moderation/automod/settings', query: mod, body: p };
    case 'automod-resolve': return { method: 'POST', path: 'moderation/automod/message', body: { user_id: channel, ...p } };
    case 'blocked-term-add': return { method: 'POST', path: 'moderation/blocked_terms', query: mod, body: p };
    case 'blocked-term-remove': return { method: 'DELETE', path: 'moderation/blocked_terms', query: { ...mod, id: String(p.id) } };
    case 'warn': return { method: 'POST', path: 'moderation/warnings', query: mod, body: { data: p } };
    case 'unban-request-resolve': return { method: 'PATCH', path: 'moderation/unban_requests', query: { ...mod, ...queryValues(p) } };
    case 'shield': return { method: 'PUT', path: 'moderation/shield_mode', query: mod, body: p };
    case 'commercial': return { method: 'POST', path: 'channels/commercial', body: { ...own, length: Number(p.length) } };
    case 'ad-snooze': return { method: 'POST', path: 'channels/ads/schedule/snooze', query: own };
    case 'raid-start': return { method: 'POST', path: 'raids', query: { from_broadcaster_id: channel, to_broadcaster_id: String(p.to_broadcaster_id) } };
    case 'raid-cancel': return { method: 'DELETE', path: 'raids', query: { broadcaster_id: channel } };
    case 'reward-create': return { method: 'POST', path: 'channel_points/custom_rewards', query: own, body: p };
    case 'reward-update': return { method: 'PATCH', path: 'channel_points/custom_rewards', query: { ...own, id: String(p.id) }, body };
    case 'reward-delete': return { method: 'DELETE', path: 'channel_points/custom_rewards', query: { ...own, id: String(p.id) } };
    case 'redemption-update': return { method: 'PATCH', path: 'channel_points/custom_rewards/redemptions', query: { ...own, id: String(p.id), reward_id: String(p.reward_id) }, body: { status: p.status } };
    case 'poll-create': return { method: 'POST', path: 'polls', body: { ...own, ...p, choices: Array.isArray(p.choices) ? p.choices.map(title => ({ title })) : [] } };
    case 'poll-end': return { method: 'PATCH', path: 'polls', body: { ...own, ...p } };
    case 'prediction-create': return { method: 'POST', path: 'predictions', body: { ...own, ...p, outcomes: Array.isArray(p.outcomes) ? p.outcomes.map(title => ({ title })) : [] } };
    case 'prediction-end': return { method: 'PATCH', path: 'predictions', body: { ...own, ...p } };
    case 'clip-create': return { method: 'POST', path: 'clips', query: { ...own, ...queryValues(p) } };
    case 'marker-create': return { method: 'POST', path: 'streams/markers', body: { user_id: channel, ...p } };
    case 'schedule-create': return { method: 'POST', path: 'schedule/segment', query: own, body: { ...p, duration: String(p.duration) } };
    case 'schedule-update': return { method: 'PATCH', path: 'schedule/segment', query: { ...own, id: String(p.id) }, body: { ...body, ...(p.duration === undefined ? {} : { duration: String(p.duration) }) } };
    case 'schedule-delete': return { method: 'DELETE', path: 'schedule/segment', query: { ...own, id: String(p.id) } };
    case 'schedule-vacation': return { method: 'PATCH', path: 'schedule/settings', query: { ...own, ...queryValues(p) } };
    case 'announcement': return { method: 'POST', path: 'chat/announcements', query: mod, body: p };
    case 'shoutout': return { method: 'POST', path: 'chat/shoutouts', query: { from_broadcaster_id: channel, moderator_id: channel, to_broadcaster_id: String(p.to_broadcaster_id) } };
    case 'moderator-add': case 'moderator-remove': return { method: action.name === 'moderator-add' ? 'POST' : 'DELETE', path: 'moderation/moderators', query: { ...own, user_id: String(p.user_id) } };
    case 'vip-add': case 'vip-remove': return { method: action.name === 'vip-add' ? 'POST' : 'DELETE', path: 'channels/vips', query: { ...own, user_id: String(p.user_id) } };
  }
}
