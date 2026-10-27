import type { IntegrationSettings } from '../../features/coforge/domain/types';
import type { ModerationAction, TwitchChannel, TwitchRole, TwitchChannelUpdate } from '../../features/coforge/domain/twitch';
import { TwitchAccounts, BOT_SCOPES } from './twitch-auth';
import { assertResponse, object, strings, TwitchError, type HttpRequest, type HttpResponse } from './twitch-http';
import type { ChatSenderPort, PlayerModerationPort, LivePresencePort, ModerationReceipt } from '../../features/coforge/application/integration-ports';

const HELIX = 'https://api.twitch.tv/helix/';
const numeric = (value: string) => /^\d+$/.test(value);
const data = (response: HttpResponse): unknown[] => { const value = object(response.json).data; return Array.isArray(value) ? value : []; };
const snapshot = (response: HttpResponse): unknown[] => {
  if (!Array.isArray(object(response.json).data)) throw new TwitchError('service', 'Twitch returned an incomplete snapshot. Refresh before relying on this status.');
  return data(response);
};

/** The only channel-write adapter. No raw Twitch error bodies or credentials are exposed to views. */
export class TwitchApi implements ChatSenderPort, PlayerModerationPort, LivePresencePort {
  constructor(private readonly request: HttpRequest, private readonly accounts: TwitchAccounts, private readonly config: () => IntegrationSettings) {}

  private async call(role: TwitchRole, scopes: readonly string[], method: string, path: string, query: Record<string, string | readonly string[]> = {}, body?: unknown): Promise<HttpResponse> {
    const config = this.config();
    const token = await this.accounts.token(role, scopes);
    if (config.twitchClientId !== this.config().twitchClientId || config.twitchBroadcasterId !== this.config().twitchBroadcasterId)
      throw new TwitchError('authorization', 'The Twitch connection changed. Refresh before trying again.');
    const parameters = Object.entries(query).flatMap(([key, value]) => typeof value === 'string' ? [[key, value]] : value.map(item => [key, item]));
    const invoke = (bearer: string) => this.request({ url: HELIX + path + (parameters.length ? `?${new URLSearchParams(parameters)}` : ''), method,
      headers: { Authorization: `Bearer ${bearer}`, 'Client-Id': config.twitchClientId, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    let response = await invoke(token);
    if (response.status === 401) {
      const refreshed = await this.accounts.token(role, scopes, token);
      if (config.twitchClientId !== this.config().twitchClientId || config.twitchBroadcasterId !== this.config().twitchBroadcasterId)
        throw new TwitchError('authorization', 'The Twitch connection changed. Refresh before trying again.');
      response = await invoke(refreshed);
    }
    if (method !== 'GET' && response.status >= 500) throw new TwitchError('uncertain', 'Twitch did not confirm this action. Check the channel before trying again.');
    assertResponse(response); return response;
  }

  async channel(): Promise<TwitchChannel> {
    const id = this.config().twitchBroadcasterId;
    if (!numeric(id)) throw new TwitchError('authorization', 'Connect the streamer account to choose a channel.');
    const role = this.accounts.identity('bot') ? 'bot' : 'streamer';
    const response = await this.call(role, [], 'GET', 'channels', { broadcaster_id: id });
    const channel = object(data(response)[0]);
    if (channel.broadcaster_id !== id || typeof channel.broadcaster_login !== 'string' || typeof channel.broadcaster_name !== 'string' || typeof channel.title !== 'string')
      throw new TwitchError('service', 'Twitch did not return the selected channel. Refresh the connection.');
    return { id, login: channel.broadcaster_login, name: channel.broadcaster_name, title: channel.title,
      tags: strings(channel.tags), language: typeof channel.broadcaster_language === 'string' ? channel.broadcaster_language : '',
      categoryId: typeof channel.game_id === 'string' ? channel.game_id : '', categoryName: typeof channel.game_name === 'string' ? channel.game_name : '' };
  }
  async metricStream(): Promise<{ id: string; startedAt: string; viewers: number } | null> {
    const response = await this.call('streamer', [], 'GET', 'streams', { user_id: this.config().twitchBroadcasterId });
    const items = snapshot(response);
    if (!items.length) return null;
    const stream = object(items[0]);
    if (stream.user_id !== this.config().twitchBroadcasterId || typeof stream.id !== 'string' || !stream.id
      || typeof stream.started_at !== 'string' || !Number.isFinite(Date.parse(stream.started_at))
      || typeof stream.viewer_count !== 'number' || !Number.isInteger(stream.viewer_count) || stream.viewer_count < 0)
      throw new TwitchError('service', 'Twitch returned incomplete live metrics.');
    return { id: stream.id, startedAt: stream.started_at, viewers: stream.viewer_count };
  }
  async followerTotal(): Promise<number> {
    const response = await this.call('streamer', [], 'GET', 'channels/followers', { broadcaster_id: this.config().twitchBroadcasterId, first: '1' });
    const total = object(response.json).total;
    if (typeof total !== 'number' || !Number.isInteger(total) || total < 0) throw new TwitchError('service', 'Twitch did not return a follower total.');
    return total;
  }
  async subscriptionTotals(): Promise<{ total: number; points: number }> {
    const response = await this.call('streamer', ['channel:read:subscriptions'], 'GET', 'subscriptions', { broadcaster_id: this.config().twitchBroadcasterId, first: '1' });
    const value = object(response.json);
    if (typeof value.total !== 'number' || !Number.isInteger(value.total) || value.total < 0 || typeof value.points !== 'number' || !Number.isInteger(value.points) || value.points < 0)
      throw new TwitchError('service', 'Twitch did not return subscription totals.');
    return { total: value.total, points: value.points };
  }
  async updateChannel(input: TwitchChannelUpdate): Promise<void> {
    if (!input.title.trim() || [...input.title].length > 140 || (input.categoryId && !numeric(input.categoryId))) throw new TwitchError('validation', 'Enter a title of 1–140 characters and select a Twitch category.');
    const tags = input.tags?.map(tag => tag.normalize('NFKC').trim()); const language = input.language?.trim().toLowerCase();
    if (tags && (tags.length > 10 || tags.some(tag => !/^[\p{L}\p{N}]{1,25}$/u.test(tag)) || new Set(tags.map(tag => tag.toLocaleLowerCase('en-US'))).size !== tags.length)) throw new TwitchError('validation', 'Use up to 10 unique tags, each 1–25 letters or numbers without spaces.');
    if (language && !/^(?:[a-z]{2}|other)$/.test(language)) throw new TwitchError('validation', 'Use a two-letter broadcast language code, or other.');
    const response = await this.call('streamer', ['channel:manage:broadcast'], 'PATCH', 'channels', { broadcaster_id: this.config().twitchBroadcasterId }, { title: input.title.trim(), game_id: input.categoryId || '0', ...(tags ? { tags } : {}), ...(language ? { broadcaster_language: language } : {}) });
    if (response.status !== 204) throw new TwitchError('uncertain', 'Twitch did not confirm the channel update. Refresh channel details before trying again.');
  }
  async categories(query: string): Promise<Array<{ id: string; name: string }>> {
    if (!query.trim() || query.length > 100) throw new TwitchError('validation', 'Enter a category search of 1–100 characters.');
    const response = await this.call(this.accounts.identity('bot') ? 'bot' : 'streamer', [], 'GET', 'search/categories', { query: query.trim(), first: '10' });
    return data(response).flatMap(value => {
      const item = object(value);
      return typeof item.id === 'string' && numeric(item.id) && typeof item.name === 'string' ? [{ id: item.id, name: item.name }] : [];
    });
  }
  async resolveUser(login: string): Promise<{ id: string; login: string }> {
    if (!/^[a-z0-9_]{1,25}$/i.test(login)) throw new TwitchError('validation', 'Enter a Twitch username without @.');
    const response = await this.call('streamer', [], 'GET', 'users', { login: login.toLowerCase() });
    const user = object(data(response)[0]);
    if (typeof user.id !== 'string' || !numeric(user.id) || typeof user.login !== 'string') throw new TwitchError('validation', 'That Twitch user was not found.');
    return { id: user.id, login: user.login };
  }
  async send(text: string, parentMessageId?: string, expectedSender?: string, expectedChannel?: string): Promise<string> {
    if (!text.trim() || [...text].length > 500) throw new TwitchError('validation', 'Chat messages must contain 1–500 characters.');
    await this.accounts.token('bot', BOT_SCOPES);
    const sender = this.accounts.identity('bot');
    if (!sender || (expectedSender && sender.id !== expectedSender) || (expectedChannel && this.config().twitchBroadcasterId !== expectedChannel))
      throw new TwitchError('authorization', 'The bot or channel changed before this reply could be sent.');
    const response = await this.call('bot', BOT_SCOPES, 'POST', 'chat/messages', {}, {
      broadcaster_id: expectedChannel ?? this.config().twitchBroadcasterId, sender_id: sender.id, message: text,
      ...(parentMessageId ? { reply_parent_message_id: parentMessageId } : {}),
    });
    const result = object(data(response)[0]);
    if (result.is_sent === false) {
      const code = object(result.drop_reason).code;
      throw new TwitchError('delivery', `Twitch did not send this message${typeof code === 'string' && /^[a-z_]{1,64}$/.test(code) ? ` (${code})` : ''}.`);
    }
    if (result.is_sent !== true || typeof result.message_id !== 'string' || !result.message_id)
      throw new TwitchError('uncertain', 'Twitch did not confirm message delivery. It will not be resent automatically.');
    return result.message_id;
  }
  async moderate(action: ModerationAction): Promise<ModerationReceipt | void> {
    if (action.type === 'unban') return this.unban(action.userId);
    const owner = this.config().twitchBroadcasterId;
    if (!numeric(owner)) throw new TwitchError('validation', 'Connect the streamer account first.');
    if (action.type === 'delete') {
      if (!/^[a-z0-9-]{1,200}$/i.test(action.messageId)) throw new TwitchError('validation', 'Select one Twitch message ID. Clearing the entire chat is not supported.');
      const response = await this.call('streamer', ['moderator:manage:chat_messages'], 'DELETE', 'moderation/chat', { broadcaster_id: owner, moderator_id: owner, message_id: action.messageId });
      if (response.status !== 204) throw new TwitchError('uncertain', 'Twitch did not confirm the message deletion. Check the channel before trying again.');
      return;
    }
    if (!numeric(action.userId) || action.userId === owner || [...action.reason].length > 500) throw new TwitchError('validation', 'Select a viewer other than the broadcaster and keep the reason under 500 characters.');
    if (action.type === 'timeout' && (!Number.isInteger(action.duration) || !action.duration || action.duration < 1 || action.duration > 1_209_600)) throw new TwitchError('validation', 'Timeouts must last 1–1,209,600 seconds.');
    const response = await this.call('streamer', ['moderator:manage:banned_users'], 'POST', 'moderation/bans', { broadcaster_id: owner, moderator_id: owner },
      { data: { user_id: action.userId, reason: action.reason, ...(action.type === 'timeout' ? { duration: action.duration } : {}) } });
    const result = object(data(response)[0]);
    if (response.status !== 200 || result.user_id !== action.userId || result.broadcaster_id !== owner)
      throw new TwitchError('uncertain', 'Twitch did not confirm the selected moderation target. Refresh the player before another action.');
    if (action.type === 'timeout') {
      if (typeof result.end_time !== 'string' || !Number.isFinite(Date.parse(result.end_time)))
        throw new TwitchError('uncertain', 'Twitch did not confirm when this timeout ends. Refresh the player before another action.');
      return { expiresAt: result.end_time };
    }
    if (result.end_time !== null) throw new TwitchError('uncertain', 'Twitch did not confirm a permanent ban. Refresh the player before another action.');
  }
  async unban(userId: string): Promise<void> {
    const owner = this.config().twitchBroadcasterId;
    if (!numeric(userId) || !numeric(owner) || userId === owner) throw new TwitchError('validation', 'Select a Twitch viewer to unmute or unban.');
    const response = await this.call('streamer', ['moderator:manage:banned_users'], 'DELETE', 'moderation/bans', { broadcaster_id: owner, moderator_id: owner, user_id: userId });
    if (response.status !== 204) throw new TwitchError('uncertain', 'Twitch did not confirm removal of this restriction. Refresh the player before another action.');
  }
  async liveStream(): Promise<{ id: string; startedAt: string } | null> {
    const response = await this.call('streamer', [], 'GET', 'streams', { user_id: this.config().twitchBroadcasterId });
    const streams = snapshot(response); const stream = object(streams[0]);
    if (!streams.length) return null;
    if (typeof stream.id !== 'string' || !stream.id || stream.user_id !== this.config().twitchBroadcasterId || typeof stream.started_at !== 'string' || !Number.isFinite(Date.parse(stream.started_at)))
      throw new TwitchError('service', 'Twitch did not return a valid live-stream snapshot.');
    return { id: stream.id, startedAt: stream.started_at };
  }
  async chatters(): Promise<string[]> {
    return (await this.chattersProfiles()).map(profile => profile.id);
  }
  async chattersProfiles(): Promise<Array<{ id: string; name: string }>> {
    const channel = this.config().twitchBroadcasterId; const users = new Map<string, string>(); let after = '';
    for (let page = 0; page < 20; page++) {
      const response = await this.call('streamer', ['moderator:read:chatters'], 'GET', 'chat/chatters', { broadcaster_id: channel, moderator_id: channel, first: '1000', ...(after ? { after } : {}) });
      for (const value of snapshot(response)) { const row = object(value); const id = row.user_id; if (typeof id !== 'string' || !numeric(id)) throw new TwitchError('service', 'Twitch returned an incomplete chat-presence snapshot.'); users.set(`twitch:${id}`, typeof row.user_name === 'string' ? row.user_name : typeof row.user_login === 'string' ? row.user_login : 'Twitch viewer'); }
      const cursor = object(object(response.json).pagination).cursor;
      if (typeof cursor !== 'string' || !cursor) return [...users].map(([id, name]) => ({ id, name }));
      if (cursor === after) break; after = cursor;
    }
    throw new TwitchError('service', 'Chat-presence snapshot exceeds the supported page limit. No time was credited.');
  }
  async restrictions(userIds: readonly string[]): Promise<Array<{ userId: string; expiresAt?: string }>> {
    if (!userIds.length) return [];
    if (userIds.length > 100 || userIds.some(id => !numeric(id))) throw new TwitchError('validation', 'Select at most 100 Twitch users per restriction lookup.');
    const response = await this.call('streamer', ['moderator:manage:banned_users'], 'GET', 'moderation/banned', { broadcaster_id: this.config().twitchBroadcasterId, user_id: userIds });
    return snapshot(response).map(value => {
      const item = object(value);
      if (typeof item.user_id !== 'string' || !numeric(item.user_id) || !userIds.includes(item.user_id) || (item.expires_at && (typeof item.expires_at !== 'string' || !Number.isFinite(Date.parse(item.expires_at)))))
        throw new TwitchError('service', 'Twitch returned invalid restriction details.');
      return { userId: item.user_id, ...(typeof item.expires_at === 'string' && item.expires_at ? { expiresAt: item.expires_at } : {}) };
    });
  }
}
