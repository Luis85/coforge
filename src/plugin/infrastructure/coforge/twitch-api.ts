import type { IntegrationSettings } from '../../features/coforge/domain/types';
import type { ModerationAction, TwitchChannel, TwitchRole } from '../../features/coforge/domain/twitch';
import { TwitchAccounts, BOT_SCOPES } from './twitch-auth';
import { assertResponse, object, TwitchError, type HttpRequest, type HttpResponse } from './twitch-http';

const HELIX = 'https://api.twitch.tv/helix/';
const numeric = (value: string) => /^\d+$/.test(value);
const data = (response: HttpResponse): unknown[] => { const value = object(response.json).data; return Array.isArray(value) ? value : []; };

/** The only channel-write adapter. No raw Twitch error bodies or credentials are exposed to views. */
export class TwitchApi {
  constructor(private readonly request: HttpRequest, private readonly accounts: TwitchAccounts, private readonly config: () => IntegrationSettings) {}

  async call(role: TwitchRole, scopes: readonly string[], method: string, path: string, query: Record<string, string> = {}, body?: unknown): Promise<HttpResponse> {
    const config = this.config();
    const token = await this.accounts.token(role, scopes);
    if (config.twitchClientId !== this.config().twitchClientId || config.twitchBroadcasterId !== this.config().twitchBroadcasterId)
      throw new TwitchError('authorization', 'The Twitch connection changed. Refresh before trying again.');
    const invoke = (bearer: string) => this.request({ url: HELIX + path + (Object.keys(query).length ? `?${new URLSearchParams(query)}` : ''), method,
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
      categoryId: typeof channel.game_id === 'string' ? channel.game_id : '', categoryName: typeof channel.game_name === 'string' ? channel.game_name : '' };
  }
  async updateChannel(input: { title: string; categoryId: string }): Promise<void> {
    if (!input.title.trim() || [...input.title].length > 140 || (input.categoryId && !numeric(input.categoryId))) throw new Error('Enter a title of 1–140 characters and select a Twitch category.');
    await this.call('streamer', ['channel:manage:broadcast'], 'PATCH', 'channels', { broadcaster_id: this.config().twitchBroadcasterId }, { title: input.title.trim(), game_id: input.categoryId || '0' });
  }
  async categories(query: string): Promise<Array<{ id: string; name: string }>> {
    if (!query.trim() || query.length > 100) throw new Error('Enter a category search of 1–100 characters.');
    const response = await this.call(this.accounts.identity('bot') ? 'bot' : 'streamer', [], 'GET', 'search/categories', { query: query.trim(), first: '10' });
    return data(response).flatMap(value => {
      const item = object(value);
      return typeof item.id === 'string' && numeric(item.id) && typeof item.name === 'string' ? [{ id: item.id, name: item.name }] : [];
    });
  }
  async resolveUser(login: string): Promise<{ id: string; login: string }> {
    if (!/^[a-z0-9_]{1,25}$/i.test(login)) throw new Error('Enter a Twitch username without @.');
    const response = await this.call('streamer', [], 'GET', 'users', { login: login.toLowerCase() });
    const user = object(data(response)[0]);
    if (typeof user.id !== 'string' || !numeric(user.id) || typeof user.login !== 'string') throw new Error('That Twitch user was not found.');
    return { id: user.id, login: user.login };
  }
  async send(text: string, parentMessageId?: string, expectedSender?: string, expectedChannel?: string): Promise<string> {
    if (!text.trim() || [...text].length > 500) throw new Error('Chat messages must contain 1–500 characters.');
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
  async moderate(action: ModerationAction): Promise<void> {
    const owner = this.config().twitchBroadcasterId;
    if (!numeric(owner)) throw new Error('Connect the streamer account first.');
    if (action.type === 'delete') {
      if (!/^[a-z0-9-]{1,200}$/i.test(action.messageId)) throw new Error('Select one Twitch message ID. Clearing the entire chat is not supported.');
      await this.call('streamer', ['moderator:manage:chat_messages'], 'DELETE', 'moderation/chat', { broadcaster_id: owner, moderator_id: owner, message_id: action.messageId });
      return;
    }
    if (!numeric(action.userId) || action.userId === owner || [...action.reason].length > 500) throw new Error('Select a viewer other than the broadcaster and keep the reason under 500 characters.');
    if (action.type === 'timeout' && (!Number.isInteger(action.duration) || !action.duration || action.duration < 1 || action.duration > 1_209_600)) throw new Error('Timeouts must last 1–1,209,600 seconds.');
    await this.call('streamer', ['moderator:manage:banned_users'], 'POST', 'moderation/bans', { broadcaster_id: owner, moderator_id: owner },
      { data: { user_id: action.userId, reason: action.reason, ...(action.type === 'timeout' ? { duration: action.duration } : {}) } });
  }
}
