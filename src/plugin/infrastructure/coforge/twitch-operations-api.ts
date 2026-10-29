import type { IntegrationSettings } from '../../features/coforge/domain/types';
import type { TwitchAction, TwitchOperationsPort, TwitchParameters, TwitchRaidTarget, TwitchReadResult, TwitchResource } from '../../features/coforge/domain/twitch-operations';
import { TWITCH_ACTIONS, TWITCH_RESOURCES } from '../../features/coforge/domain/twitch-operations-catalogue';
import { TWITCH_READ_SCOPE_ALTERNATIVES, validateTwitchAction } from '../../features/coforge/domain/twitch-operations-validation';
import { TwitchAccounts } from './twitch-auth';
import { object, TwitchError, type HttpRequest, type HttpResponse } from './twitch-http';
import { TwitchOperationsHttp, twitchResult, type TwitchEndpointRequest } from './twitch-operations-http';
import { twitchReadEndpoint, twitchWriteEndpoint } from './twitch-operations-endpoints';

const NO_CONTENT = new Set(['automod-resolve', 'blocked-term-remove', 'raid-cancel', 'reward-delete', 'schedule-delete', 'schedule-vacation', 'announcement', 'shoutout', 'moderator-add', 'moderator-remove', 'vip-add', 'vip-remove']);

/** Private typed channel operations using only declared, validated Helix endpoints. */
export class TwitchOperationsApi implements TwitchOperationsPort {
  private readonly http: TwitchOperationsHttp;
  constructor(request: HttpRequest, private readonly accounts: TwitchAccounts, private readonly config: () => IntegrationSettings) {
    this.http = new TwitchOperationsHttp(request, accounts, config);
  }
  async previewRaid(id: string): Promise<TwitchRaidTarget> {
    const context = { channelId: this.config().twitchBroadcasterId, clientId: this.config().twitchClientId };
    if (!/^\d{1,40}$/.test(id) || id === context.channelId) throw new TwitchError('validation', 'Choose another numeric Twitch channel ID for the raid target.');
    const [channelResponse, streamResponse] = await Promise.all([
      this.http.call({ method: 'GET', path: 'channels', scopes: [], query: { broadcaster_id: id }, context }),
      this.http.call({ method: 'GET', path: 'streams', scopes: [], query: { user_id: id }, context }),
    ]);
    const channels = object(channelResponse.json).data; const streams = object(streamResponse.json).data;
    if (!Array.isArray(channels) || channels.length !== 1 || !Array.isArray(streams) || streams.length > 1) throw new TwitchError('service', 'Twitch did not return the selected raid target.');
    const channel = object(channels[0]); const stream = object(streams[0]);
    if (channel.broadcaster_id !== id || typeof channel.broadcaster_login !== 'string' || typeof channel.broadcaster_name !== 'string' || typeof channel.title !== 'string' || typeof channel.game_id !== 'string' || typeof channel.game_name !== 'string') throw new TwitchError('service', 'Twitch returned incomplete information for the selected raid target.');
    if (streams.length && (stream.user_id !== id || typeof stream.viewer_count !== 'number' || !Number.isInteger(stream.viewer_count) || stream.viewer_count < 0 || typeof stream.started_at !== 'string' || !Number.isFinite(Date.parse(stream.started_at)))) throw new TwitchError('service', 'The raid target live state could not be verified. Refresh before continuing.');
    return { id, login: channel.broadcaster_login, name: channel.broadcaster_name, title: channel.title, categoryId: channel.game_id, categoryName: channel.game_name, isLive: streams.length === 1, viewers: streams.length && typeof stream.viewer_count === 'number' ? stream.viewer_count : null, ...(typeof stream.started_at === 'string' ? { startedAt: stream.started_at } : {}), checkedAt: new Date().toISOString() };
  }

  async read(resource: TwitchResource, parameters: TwitchParameters = {}): Promise<TwitchReadResult> {
    const channel = this.config().twitchBroadcasterId;
    const context = { channelId: channel, clientId: this.config().twitchClientId };
    const input = twitchReadEndpoint(resource, channel, parameters);
    const descriptor = TWITCH_RESOURCES.find(item => item.name === resource);
    if (!descriptor) throw new TwitchError('validation', 'Choose a supported Twitch resource.');
    const scopes = await this.readScopes(descriptor.scopes);
    if (resource === 'redemptions') await this.assertManagedReward(String(parameters.reward_id), scopes, context);
    const response = await this.http.call({ ...input, scopes, context });
    const result = twitchResult(response, channel, resource === 'schedule');
    if (resource === 'markers') return { ...result, records: markerRecords(result, channel) };
    return result;
  }

  async execute(action: TwitchAction): Promise<TwitchReadResult | void> {
    const validated = validateTwitchAction(action);
    const descriptor = TWITCH_ACTIONS.find(item => item.name === validated.name);
    if (!descriptor) throw new TwitchError('validation', 'Choose a supported Twitch action.');
    const channel = this.config().twitchBroadcasterId;
    const context = { channelId: channel, clientId: this.config().twitchClientId };
    const input: TwitchEndpointRequest = { ...twitchWriteEndpoint(validated, channel), scopes: descriptor.scopes, context };
    if (['reward-update', 'reward-delete', 'redemption-update'].includes(validated.name))
      await this.assertManagedReward(String(validated.parameters.reward_id ?? validated.parameters.id), descriptor.scopes, context);
    const response = await this.http.call(input);
    const expectedStatus = NO_CONTENT.has(validated.name) ? 204 : validated.name === 'clip-create' ? 202 : 200;
    if (response.status !== expectedStatus) throw new TwitchError('uncertain', 'Twitch did not confirm the expected operation result. Inspect the channel before another action.');
    if (response.status === 204) return;
    return this.confirmResult(validated, response, channel);
  }

  private confirmResult(action: TwitchAction, response: HttpResponse, channel: string): TwitchReadResult {
    let result: TwitchReadResult;
    try { result = twitchResult(response, channel, action.name === 'schedule-create' || action.name === 'schedule-update'); }
    catch { throw new TwitchError('uncertain', 'Twitch accepted the action but its result could not be verified. Inspect its current status.'); }
    const row = result.records[0];
    if (!row) throw new TwitchError('uncertain', 'Twitch accepted the action without confirming its result. Inspect its current status.');
    assertReceipt(action, row);
    const expectedId = action.parameters.id ?? action.parameters.unban_request_id;
    const expectedUser = action.name === 'warn' ? action.parameters.user_id : undefined;
    if (expectedId !== undefined && row.id !== expectedId || expectedUser !== undefined && row.user_id !== expectedUser
      || ['redemption-update', 'unban-request-resolve', 'poll-end', 'prediction-end'].includes(action.name) && row.status !== action.parameters.status
      || action.name === 'shield' && row.is_active !== action.parameters.is_active)
      throw new TwitchError('uncertain', 'Twitch returned a different operation target or outcome. Refresh before sending another action.');
    return result;
  }

  private async readScopes(required: readonly string[]): Promise<string[]> {
    await this.accounts.token('streamer', []);
    const granted = this.accounts.identity('streamer')?.scopes ?? [];
    return required.map(scope => granted.includes(scope) ? scope : granted.includes(TWITCH_READ_SCOPE_ALTERNATIVES[scope] ?? '') ? TWITCH_READ_SCOPE_ALTERNATIVES[scope]! : scope);
  }

  private async assertManagedReward(id: string, scopes: readonly string[], context: { channelId: string; clientId: string }): Promise<void> {
    const response = await this.http.call({ method: 'GET', path: 'channel_points/custom_rewards', scopes,
      context, query: { broadcaster_id: context.channelId, id, only_manageable_rewards: 'true' } });
    const result = twitchResult(response, context.channelId);
    if (!result.records.some(row => row.id === id)) throw new TwitchError('permission', 'This reward was not created by the connected Twitch application. Manage it in its original application.');
  }
}

function assertReceipt(action: TwitchAction, row: Record<string, unknown>): void {
  const hasId = typeof row.id === 'string' && row.id.length > 0;
  const dated = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value));
  const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0;
  let valid = true;
  if (['reward-create', 'blocked-term-add', 'schedule-create', 'poll-create', 'prediction-create'].includes(action.name)) valid = hasId;
  if (action.name === 'poll-create' || action.name === 'prediction-create') valid = valid && row.status === 'ACTIVE';
  if (action.name === 'marker-create') valid = hasId && finite(row.position_seconds);
  if (action.name === 'raid-start') valid = dated(row.created_at);
  if (action.name === 'commercial') valid = finite(row.length) && finite(row.retry_after) && typeof row.message === 'string';
  if (action.name === 'ad-snooze') valid = dated(row.next_ad_at) && finite(row.snooze_count);
  if (action.name === 'clip-create') {
    valid = false;
    if (hasId && typeof row.edit_url === 'string') {
      try { const url = new URL(row.edit_url); valid = url.protocol === 'https:' && url.hostname === 'clips.twitch.tv' && !url.username && !url.password; } catch { /* An invalid editor URL is not a confirmed clip receipt. */ }
    }
  }
  if (!valid) throw new TwitchError('uncertain', 'Twitch accepted the action but its receipt is incomplete. Inspect its current status before continuing.');
}

function markerRecords(result: TwitchReadResult, channel: string): Record<string, unknown>[] {
  return result.records.flatMap(row => {
    if (row.user_id !== channel || !Array.isArray(row.videos)) throw new TwitchError('service', 'Twitch returned invalid stream-marker ownership.');
    return row.videos.flatMap(value => {
      const video = object(value);
      if (!Array.isArray(video.markers) || typeof video.video_id !== 'string') throw new TwitchError('service', 'Twitch returned incomplete stream markers.');
      return video.markers.map(marker => ({ ...object(marker), video_id: video.video_id }));
    });
  });
}
