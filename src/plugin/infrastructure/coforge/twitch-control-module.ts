import type { StudioStore } from '../../features/coforge/application/studio-store';
import type { Timers } from '../../features/coforge/application/ports';
import { TwitchOperations } from '../../features/coforge/application/twitch-operations';
import { TWITCH_ACTIONS, TWITCH_RESOURCES } from '../../features/coforge/domain/twitch-operations-catalogue';
import type { TwitchOperationsActions, TwitchResource } from '../../features/coforge/domain/twitch-operations';
import type { IntegrationSettings } from '../../features/coforge/domain/types';
import { TwitchOperationsApi } from './twitch-operations-api';
import { operationsEventResources, operationsEventScopes, startTwitchOperationsEvents } from './twitch-operations-events';
import type { TwitchAccounts } from './twitch-auth';
import type { TwitchDeviceAuthorization } from './twitch-device';
import { TwitchError, type HttpRequest } from './twitch-http';
import type { TwitchSocket } from './twitch';

/** Private operations share the validated broadcaster account, with their own event lifecycle. */
export class TwitchControlModule {
  readonly actions: TwitchOperationsActions;
  private readonly service: TwitchOperations;
  private stopEvents = () => {};
  private generation = 0;
  private closed = false;
  private readonly refreshTimers = new Map<TwitchResource, number>();
  private readonly refreshing = new Set<TwitchResource>();
  private readonly refreshAgain = new Set<TwitchResource>();
  private readonly refreshReads = new Set<Promise<void>>();
  constructor(private readonly store: StudioStore, private readonly accounts: TwitchAccounts,
    private readonly device: TwitchDeviceAuthorization, private readonly config: () => IntegrationSettings,
    private readonly request: HttpRequest, private readonly timers: Timers,
    private readonly socket: (url: string) => TwitchSocket, private readonly report: (message: string) => void) {
    const api = new TwitchOperationsApi(request, accounts, config);
    this.service = new TwitchOperations(store, api, () => ({
      channelId: config().twitchBroadcasterId, clientId: config().twitchClientId,
      accountId: accounts.identity('streamer')?.id ?? '', scopes: accounts.identity('streamer')?.scopes ?? [],
    }));
    this.actions = {
      snapshot: () => this.service.snapshot(), preview: action => this.service.preview(action),
      execute: preview => this.service.execute(preview), refresh: (resource, parameters) => this.service.refresh(resource, parameters),
      acknowledgeActivity: id => this.service.acknowledgeActivity(id), reconcile: (id, note) => this.service.reconcile(id, note),
      setRetention: days => this.service.setRetention(days), subscribe: listener => this.service.subscribe(listener),
      authorize: feature => this.authorize(feature),
      report: streamId => this.service.report(streamId),
      saveTemplate: (name, action, id) => this.service.saveTemplate(name, action, id),
      removeTemplate: id => this.service.removeTemplate(id), linkActivity: (id, ideaId) => this.service.linkActivity(id, ideaId),
      previewRaid: async id => {
        if (this.closed) throw new TwitchError('validation', 'Reopen CoForge before inspecting a raid target.');
        const target = await api.previewRaid(id);
        if (this.closed) throw new TwitchError('validation', 'CoForge closed before the raid target could be inspected.');
        return target;
      },
    };
  }
  start(): void { this.service.start(); }
  disconnect(reason = 'Twitch activity collection is disconnected. Missed events cannot be replayed.'): Promise<void> {
    this.generation++; this.stopEvents(); this.stopEvents = () => {};
    this.cancelRefreshes();
    this.service.invalidateResources();
    return this.service.collectionDisconnected(reason);
  }
  async reconnect(): Promise<void> {
    const generation = ++this.generation;
    this.stopEvents(); this.stopEvents = () => {};
    this.cancelRefreshes();
    if (this.closed) return;
    await this.service.collectionDisconnected('Twitch activity collection is disconnected. Missed events cannot be replayed.');
    const config = this.config();
    if (!config.twitchEnabled || !config.twitchClientId || !config.twitchBroadcasterId) return;
    try { await this.accounts.token('streamer', []); }
    catch { return; }
    if (this.closed || generation !== this.generation) return;
    const identity = this.accounts.identity('streamer');
    if (!identity || identity.id !== config.twitchBroadcasterId) return;
    this.stopEvents = startTwitchOperationsEvents({ clientId: config.twitchClientId,
      broadcasterId: config.twitchBroadcasterId, scopes: identity.scopes,
      resources: TWITCH_RESOURCES.map(item => item.name) }, {
      request: this.request, timers: this.timers, socket: this.socket,
      token: () => this.accounts.token('streamer', []),
      onIntakeError: () => this.report('Twitch activity could not be saved. Check vault access before relying on the activity feed.'),
    }, activity => {
      if (this.closed || generation !== this.generation) return Promise.resolve();
      const streamId = this.store.snapshot().runtime.twitch?.tracking?.streamId;
      return this.service.ingest({ ...activity, ...(streamId && !activity.streamId ? { streamId } : {}) }).then(() => {
        for (const resource of operationsEventResources(activity.type)) this.queueRefresh(resource, generation);
      });
    }, status => {
      if (this.closed || generation !== this.generation) return;
      const recording = status.phase === 'connected' ? this.service.collectionConnected()
        : this.service.collectionDisconnected(status.message);
      void recording.catch(() => this.report('Twitch activity connection evidence could not be saved. Check vault access.'));
    });
  }
  async dispose(): Promise<void> {
    if (this.closed) return;
    this.closed = true; this.generation++; this.stopEvents();
    this.cancelRefreshes(); await Promise.all(this.refreshReads);
    await this.service.collectionDisconnected('CoForge closed. Twitch activity collection resumes only while Obsidian is open.')
      .catch(() => this.report('Twitch collection closure could not be saved.'));
    await this.service.dispose();
  }
  private queueRefresh(resource: TwitchResource, generation: number): void {
    if (this.closed || generation !== this.generation || resource === 'activity' || resource === 'automod-queue' || !this.service.snapshot().resources[resource]) return;
    if (this.refreshing.has(resource)) { this.refreshAgain.add(resource); return; }
    if (this.refreshTimers.has(resource)) return;
    const channel = this.config().twitchBroadcasterId; const client = this.config().twitchClientId;
    this.refreshTimers.set(resource, this.timers.setTimeout(() => {
      this.refreshTimers.delete(resource);
      if (this.closed || generation !== this.generation || channel !== this.config().twitchBroadcasterId || client !== this.config().twitchClientId) return;
      const snapshot = this.service.snapshot().resources[resource]; if (!snapshot) return;
      this.refreshing.add(resource);
      const read = this.service.refresh(resource, snapshot.parameters ?? {}).catch(() => undefined).finally(() => {
        this.refreshing.delete(resource); this.refreshReads.delete(read);
        if (this.refreshAgain.delete(resource)) this.queueRefresh(resource, this.generation);
      });
      this.refreshReads.add(read);
    }, 250));
  }
  private cancelRefreshes(): void {
    for (const timer of this.refreshTimers.values()) this.timers.clearTimeout(timer);
    this.refreshTimers.clear(); this.refreshAgain.clear();
  }
  private async authorize(feature: string): Promise<void> {
    if (this.closed) throw new TwitchError('validation', 'Reopen CoForge before enabling Twitch features.');
    const resourceOnly = feature.startsWith('resource:'); const actionOnly = feature.startsWith('action:');
    const name = resourceOnly || actionOnly ? feature.slice(feature.indexOf(':') + 1) : feature;
    const action = resourceOnly ? undefined : TWITCH_ACTIONS.find(item => item.name === name);
    const resource = actionOnly ? undefined : TWITCH_RESOURCES.find(item => item.name === name);
    if (!action && !resource) throw new TwitchError('validation', 'Choose a supported Twitch capability.');
    const scopes = action ? action.scopes : resource ? [...resource.scopes, ...(resource.name === 'activity' ? operationsEventScopes(resource.name) : [])] : [];
    await this.device.begin('streamer', scopes);
  }
}
