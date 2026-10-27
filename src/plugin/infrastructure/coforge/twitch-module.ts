import type { StudioService } from '../../features/coforge/application/studio';
import type { Timers } from '../../features/coforge/application/ports';
import type { IntegrationSettings } from '../../features/coforge/domain/types';
import { defaultIntegration } from '../../features/coforge/domain/seed';
import { disconnectedTwitch, type TwitchActions, type TwitchState } from '../../features/coforge/domain/twitch';
import { TwitchAccounts, BOT_SCOPES } from './twitch-auth';
import { TwitchDeviceAuthorization } from './twitch-device';
import { TwitchApi } from './twitch-api';
import { requestWithDeadline, TwitchError, type HttpRequest } from './twitch-http';
import type { TwitchSecrets } from './twitch-auth';
import { TwitchOutbox } from './twitch-outbox';
import { startTwitch, type TwitchSocket } from './twitch';

const fingerprint = (config: IntegrationSettings) => JSON.stringify([
  config.twitchEnabled, config.twitchClientId, config.twitchBroadcasterId, config.twitchBotUserId,
  config.twitchBotUsesStreamer, config.twitchTokenSecret, config.twitchStreamerSecret, config.twitchBotReplies,
]);

/** One plugin-owned Twitch coordinator. Views receive public state and actions, never tokens. */
export class TwitchModule {
  private config = defaultIntegration();
  private state: TwitchState = disconnectedTwitch();
  private readonly accounts: TwitchAccounts;
  private readonly device: TwitchDeviceAuthorization;
  private readonly api: TwitchApi;
  private readonly outbox: TwitchOutbox;
  private readonly http: HttpRequest;
  private stopConnection = () => {};
  private stopStore = () => {};
  private generation = 0;
  private closed = false;
  readonly actions: TwitchActions;

  constructor(private readonly studio: StudioService, secrets: TwitchSecrets, request: HttpRequest,
    private readonly timers: Timers, private readonly socket: (url: string) => TwitchSocket) {
    const http = requestWithDeadline(request, timers);
    this.http = http;
    this.accounts = new TwitchAccounts(http, secrets, () => this.config);
    this.api = new TwitchApi(http, this.accounts, () => this.config);
    this.outbox = new TwitchOutbox(studio, this.api, () => this.state.phase === 'connected' && this.state.canChat && this.config.twitchBotReplies,
      () => this.accounts.identity('bot'), message => this.error(message), timers);
    this.device = new TwitchDeviceAuthorization(http, this.accounts, () => this.config, (authorization, error) => {
      this.state.authorization = authorization;
      if (error) this.state.lastError = error;
      this.publish();
    }, async (role, identity) => {
      await studio.updateIntegration({ twitchEnabled: true,
        ...(role === 'streamer' ? { twitchBroadcasterId: identity.id, ...(this.config.twitchBotUsesStreamer ? { twitchBotUserId: identity.id } : {}) }
          : { twitchBotUserId: identity.id }) });
      await this.reconnect();
    }, timers);
    this.actions = {
      authorize: role => this.perform(() => this.device.begin(role)), cancelAuthorization: () => this.device.cancel(),
      reconnect: () => this.reconnect(), refreshChannel: () => this.perform(() => this.refreshChannel()),
      searchCategories: query => this.perform(() => this.api.categories(query)),
      resolveUser: login => this.perform(() => this.api.resolveUser(login)),
      updateChannel: input => this.perform(async () => {
        await this.api.updateChannel(input);
        if (this.state.channel) this.state.channel = { ...this.state.channel, title: input.title.trim(), categoryId: input.categoryId };
        this.publish();
        try { await this.refreshChannel(); } catch { this.error('Channel changes were saved, but Twitch details could not be refreshed.'); }
      }),
      send: text => this.perform(async () => {
        if (this.state.phase !== 'connected') throw new Error('Connect Twitch chat before sending.');
        const channelId = this.config.twitchBroadcasterId;
        const messageId = await this.api.send(text, undefined, undefined, channelId);
        await studio.store.transaction(state => { state.chat.push({ id: crypto.randomUUID(), userId: 'system:coforge', username: this.accounts.identity('bot')?.login ?? 'CoForge',
          text, kind: 'system', source: 'twitch', externalId: messageId, twitchChannelId: channelId, createdAt: new Date().toISOString() }); });
      }),
      moderate: action => this.perform(() => this.api.moderate(action)), retryReply: id => this.perform(() => this.outbox.retry(id)),
    };
  }

  start(): void { this.stopStore = this.studio.subscribe(() => this.outbox.wake()); this.configure(this.studio.integration()); }
  configure(config: IntegrationSettings): void {
    const changed = fingerprint(config) !== fingerprint(this.config);
    this.config = { ...config };
    if (changed) { this.device.cancel(); void this.reconnect(); } else this.publish();
  }
  async reconnect(): Promise<void> {
    if (this.closed) return;
    const generation = ++this.generation;
    this.stopConnection(); this.stopConnection = () => {}; this.accounts.reset();
    this.state = { ...disconnectedTwitch(), ...(this.state.channel?.id === this.config.twitchBroadcasterId ? { channel: this.state.channel } : {}) };
    if (!this.config.twitchEnabled) { this.publish(); return; }
    this.state.phase = 'connecting'; this.state.message = 'Checking Twitch accounts'; this.publish();
    if (!this.config.twitchClientId || !this.config.twitchBroadcasterId) { this.state.phase = 'setup'; this.state.message = 'Connect the streamer account in Twitch settings'; this.publish(); return; }
    try { await this.accounts.token('streamer', []); } catch { /* Chat can use an independently authorized bot. */ }
    if (generation !== this.generation || this.closed) return;
    this.identities();
    if (this.accounts.identity('streamer')) {
      try { await this.refreshChannel(); } catch { /* A failed read does not turn a real channel into simulated data. */ }
    }
    if (generation !== this.generation || this.closed) return;
    const botId = this.config.twitchBotUsesStreamer ? this.config.twitchBroadcasterId : this.config.twitchBotUserId;
    if (!botId) { this.state.phase = 'setup'; this.state.message = 'Connect the chatbot account to receive chat'; this.publish(); return; }
    const channelId = this.config.twitchBroadcasterId;
    const config = { clientId: this.config.twitchClientId, broadcasterId: channelId, botUserId: botId };
    this.stopConnection = startTwitch(config, {
      request: this.http, socket: this.socket, timers: this.timers,
      token: async () => { const value = await this.accounts.token('bot', this.config.twitchBotReplies ? BOT_SCOPES : ['user:read:chat']); this.identities(); return value; },
    }, async input => {
      if (generation !== this.generation || this.closed) return;
      try { await this.studio.ingest({ ...input, channelId }); this.outbox.wake(); }
      catch { this.error('A Twitch command could not be saved. Check vault access; no success reply was sent.'); }
    }, status => {
      if (generation !== this.generation || this.closed) return;
      this.state.phase = status.phase; this.state.message = status.message; this.identities(); this.publish();
      if (status.phase === 'connected') { this.outbox.resume(); if (!this.state.channel) void this.refreshChannel().catch(() => undefined); }
    });
  }
  async dispose(): Promise<void> {
    this.closed = true; this.generation++; this.device.cancel(); this.stopConnection(); this.stopStore(); await this.outbox.stop();
  }
  private identities(): void {
    this.state.streamer = this.accounts.identity('streamer'); this.state.bot = this.accounts.identity('bot');
    this.state.canChat = BOT_SCOPES.every(scope => this.state.bot?.scopes.includes(scope));
    this.state.canManage = Boolean(this.state.streamer?.scopes.includes('channel:manage:broadcast'));
    this.state.canModerate = ['moderator:manage:chat_messages', 'moderator:manage:banned_users'].every(scope => this.state.streamer?.scopes.includes(scope));
  }
  private async refreshChannel(): Promise<void> {
    const generation = this.generation;
    const channel = await this.api.channel();
    if (!this.closed && generation === this.generation) { this.state.channel = channel; this.publish(); }
  }
  private error(message: string): void { this.state.lastError = message; this.identities(); this.publish(); }
  private publish(): void {
    if (this.closed || !this.studio.store.ready) return;
    void this.studio.store.updateRuntime({ twitch: structuredClone(this.state), chatSource: this.config.twitchEnabled ? 'twitch' : 'simulator', chatStatus: this.state.message }).catch(() => undefined);
  }
  private async perform<T>(work: () => Promise<T>): Promise<T> {
    if (this.closed) throw new Error('The Twitch session has closed. Reopen CoForge before continuing.');
    try { return await work(); } catch (error) {
      this.error(error instanceof TwitchError || error instanceof Error ? error.message : 'The Twitch operation could not be completed.');
      throw error;
    }
  }
}
