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
import { BotDeliveryWorker } from '../../features/coforge/application/bot-delivery';
import { startTwitch, type TwitchSocket } from './twitch';
import { LivePopulationTracker } from '../../features/coforge/application/live-population';
import { PlayerModeration } from '../../features/coforge/application/player-moderation';
import { StreamMessageScheduler } from '../../features/coforge/application/stream-message-scheduler';
import { sendOperatorMessage } from '../../features/coforge/application/send-message';
import type { TwitchChannelUpdate } from '../../features/coforge/domain/twitch';
import { recordOperation } from '../../features/coforge/application/population';
import { readTwitchMetrics, unavailableTwitchMetrics } from './twitch-metrics';

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
  private readonly outbox: BotDeliveryWorker;
  private readonly http: HttpRequest;
  private readonly population: LivePopulationTracker;
  private readonly moderation: PlayerModeration;
  private readonly scheduler: StreamMessageScheduler;
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
    this.outbox = new BotDeliveryWorker(studio, this.api, () => this.state.phase === 'connected' && this.state.canChat && this.config.twitchBotReplies,
      () => this.accounts.identity('bot'), message => this.error(message), timers, () => Boolean(this.population.liveStreamId));
    this.population = new LivePopulationTracker(studio, this.api, timers, () => this.config,
      () => this.config.twitchEnabled && Boolean(this.accounts.identity('streamer')), tracking => { this.state.tracking = tracking; this.publish(); this.scheduler.refresh(); });
    this.scheduler = new StreamMessageScheduler(studio.store, timers, () => this.population.liveStreamId, () => this.state.phase === 'connected' && this.state.canChat && this.config.twitchBotReplies, () => this.error('Stream messages could not be saved. Check vault access.'));
    this.moderation = new PlayerModeration(studio.store, this.api, () => this.config.twitchBroadcasterId);
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
      updateChannel: input => this.perform(() => this.updateChannel(input)),
      send: text => this.perform(async () => {
        if (this.state.phase !== 'connected') throw new Error('Connect Twitch chat before sending.');
        const bot = this.accounts.identity('bot'); if (!bot) throw new Error('Connect the chatbot before sending.');
        await sendOperatorMessage(studio.store, this.api, { text, channelId: this.config.twitchBroadcasterId, senderId: bot.id, senderName: bot.login });
      }),
      moderate: action => this.perform(() => this.moderation.execute(action)), retryReply: id => this.perform(() => this.outbox.retry(id)),
      refreshPopulation: () => this.perform(() => this.population.refresh()),
      refreshPlayer: userId => this.perform(() => this.moderation.refresh(userId)),
    };
  }

  start(): void { this.stopStore = this.studio.subscribe(() => this.outbox.wake()); this.configure(this.studio.integration()); this.population.start(); this.scheduler.start(); }
  async metrics() {
    const generation = this.generation;
    if (this.closed || !this.config.twitchClientId || !this.config.twitchBroadcasterId) return unavailableTwitchMetrics();
    const result = await readTwitchMetrics(this.api);
    return this.closed || generation !== this.generation ? unavailableTwitchMetrics() : result;
  }
  configure(config: IntegrationSettings): void {
    const changed = fingerprint(config) !== fingerprint(this.config);
    this.config = { ...config };
    if (changed) { this.device.cancel(); this.population.reset(); this.scheduler.reset(); void this.reconnect(); } else this.publish();
  }
  async reconnect(): Promise<void> {
    if (this.closed) return;
    const generation = ++this.generation;
    this.population.reset(); this.scheduler.reset();
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
      const previous = this.state.phase;
      this.state.phase = status.phase; this.state.message = status.message; this.identities(); this.publish();
      if (previous === 'connected' && status.phase !== 'connected') { this.population.reset(); this.scheduler.reset(); }
      if (previous !== status.phase && (status.phase === 'connected' || previous === 'connected'))
        void this.studio.store.transaction(state => recordOperation(state, status.phase === 'connected' ? 'connected' : 'disconnected')).catch(() => undefined);
      if (status.phase === 'connected') { void this.population.refresh(); this.outbox.resume(); if (!this.state.channel) void this.refreshChannel().catch(() => undefined); }
    });
  }
  async dispose(): Promise<void> {
    this.closed = true; this.generation++; this.population.stop(); this.scheduler.stop(); this.device.cancel(); this.stopConnection(); this.stopStore(); await this.outbox.stop();
  }
  private async updateChannel(input: TwitchChannelUpdate): Promise<void> {
    const channelId = this.config.twitchBroadcasterId; const id = crypto.randomUUID(); let applied = false;
    await this.studio.store.transaction(state => recordOperation(state, 'twitch-channel-update-requested', 'none', undefined, 1, id));
    try {
      await this.api.updateChannel(input); applied = true;
      const channel = await this.api.channel();
      if (channelId !== this.config.twitchBroadcasterId) throw new TwitchError('uncertain', 'The connected channel changed during the update. Refresh its details.');
      this.state.channel = channel; this.publish();
      const tags = (values: readonly string[]) => values.map(value => value.normalize('NFKC').trim().toLocaleLowerCase('en-US')).sort().join('|');
      if (channel.title !== input.title.trim() || (channel.categoryId || '0') !== (input.categoryId || '0')
        || (input.tags !== undefined && tags(channel.tags ?? []) !== tags(input.tags))
        || (input.language && channel.language !== input.language.trim().toLowerCase()))
        throw new TwitchError('uncertain', 'Twitch did not apply all requested channel fields. Review the refreshed values before saving again.');
      await this.studio.store.transaction(state => recordOperation(state, 'twitch-channel-updated', 'committed', undefined, 1, id));
    } catch (error) {
      const uncertain = applied || (error instanceof TwitchError && error.kind === 'uncertain');
      try { await this.studio.store.transaction(state => recordOperation(state, uncertain ? 'twitch-channel-update-uncertain' : 'twitch-channel-update-failed', uncertain ? 'uncertain' : 'none', undefined, 1, id)); } catch { /* Never repeat the external update because its audit write failed. */ }
      if (applied && !(error instanceof TwitchError && error.kind === 'uncertain')) throw new TwitchError('uncertain', 'Twitch accepted the update but its details could not be verified. Refresh before saving again.');
      throw error;
    }
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
    if (this.state.lastError) { delete this.state.lastError; this.publish(); }
    try { return await work(); } catch (error) {
      this.error(error instanceof TwitchError || error instanceof Error ? error.message : 'The Twitch operation could not be completed.');
      throw error;
    }
  }
}
