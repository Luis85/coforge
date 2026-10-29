import type { IntegrationSettings } from '../../features/coforge/domain/types';
import type { TwitchReadResult } from '../../features/coforge/domain/twitch-operations';
import { TwitchAccounts } from './twitch-auth';
import { assertResponse, object, TwitchError, type HttpRequest, type HttpResponse } from './twitch-http';

export type TwitchQuery = Record<string, string | readonly string[]>;
export interface TwitchEndpointRequest {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'; path: string;
  scopes: readonly string[]; query?: TwitchQuery; body?: unknown;
  context?: { channelId: string; clientId: string };
}

/** Validated broadcaster-only requests; no unconfirmed external mutation is replayed. */
export class TwitchOperationsHttp {
  private blockedUntil = 0;
  constructor(private readonly request: HttpRequest, private readonly accounts: TwitchAccounts,
    private readonly config: () => IntegrationSettings) {}

  async call(input: TwitchEndpointRequest): Promise<HttpResponse> {
    if (Date.now() < this.blockedUntil) throw new TwitchError('rate', 'Twitch is rate limiting this account. Wait until its request budget resets.');
    if (!/^[a-z][a-z0-9_/]*$/.test(input.path)) throw new TwitchError('validation', 'Choose a supported Twitch operation.');
    const captured = this.config();
    const channel = captured.twitchBroadcasterId; const client = captured.twitchClientId;
    if (input.context && (input.context.channelId !== channel || input.context.clientId !== client)) throw new TwitchError('authorization', 'The Twitch account or channel changed during preparation. Refresh before trying again.');
    if (!/^\d+$/.test(channel) || !client) throw new TwitchError('authorization', 'Connect the broadcaster account before using Twitch operations.');
    const current = () => channel === this.config().twitchBroadcasterId && client === this.config().twitchClientId
      && this.accounts.identity('streamer')?.id === channel;
    const token = await this.accounts.token('streamer', input.scopes);
    if (!current()) throw new TwitchError('authorization', 'The Twitch account or channel changed. Refresh before trying again.');
    const parameters = Object.entries(input.query ?? {}).flatMap(([key, value]) => typeof value === 'string' ? [[key, value]] : value.map(item => [key, item]));
    const query = new URLSearchParams(parameters).toString();
    const invoke = (bearer: string) => this.request({ url: `https://api.twitch.tv/helix/${input.path}${query ? '?' + query : ''}`,
      method: input.method, headers: { Authorization: `Bearer ${bearer}`, 'Client-Id': client, 'Content-Type': 'application/json' },
      ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) }) });
    let response: HttpResponse;
    try {
      response = await invoke(token);
      if (response.status === 401) {
        const refreshed = await this.accounts.token('streamer', input.scopes, token);
        if (!current()) throw new TwitchError('authorization', 'The Twitch account or channel changed. Refresh before trying again.');
        response = await invoke(refreshed);
      }
    } catch (error) {
      if (error instanceof TwitchError) throw error;
      throw new TwitchError(input.method === 'GET' ? 'service' : 'uncertain', 'The connection ended before Twitch confirmed the operation.');
    }
    if (!current()) throw new TwitchError(input.method === 'GET' ? 'authorization' : 'uncertain', 'The Twitch account or channel changed during the operation. Refresh its status.');
    const reset = Object.entries(response.headers ?? {}).find(([name]) => name.toLowerCase() === 'ratelimit-reset')?.[1];
    if (response.status === 429) this.blockedUntil = Math.max(Date.now() + 1000, Math.min(Date.now() + 3_600_000, Number(reset) * 1000 || Date.now() + 60_000));
    if (input.method !== 'GET' && response.status >= 500) throw new TwitchError('uncertain', 'Twitch did not confirm the action. Inspect the channel before sending another action.');
    assertResponse(response);
    return response;
  }
}

export function twitchResult(response: HttpResponse, channelId: string, schedule = false): TwitchReadResult {
  const payload = object(response.json);
  const raw = schedule ? object(payload.data).segments : payload.data;
  if (!Array.isArray(raw) || raw.length > 1000) throw new TwitchError('service', 'Twitch returned an incomplete operation result. Refresh before relying on it.');
  if (schedule && object(payload.data).broadcaster_id !== channelId) throw new TwitchError('service', 'Twitch returned a schedule for another channel.');
  const records = raw.map(value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TwitchError('service', 'Twitch returned an invalid operation record.');
    const row = object(value);
    if (row.broadcaster_id !== undefined && row.broadcaster_id !== channelId) throw new TwitchError('service', 'Twitch returned data for another channel.');
    return row;
  });
  const cursor = object(payload.pagination).cursor;
  if (cursor !== undefined && (typeof cursor !== 'string' || cursor.length > 4096)) throw new TwitchError('service', 'Twitch returned an invalid continuation cursor.');
  const total = payload.total;
  if (total !== undefined && (typeof total !== 'number' || !Number.isFinite(total) || total < 0)) throw new TwitchError('service', 'Twitch returned an invalid total.');
  return { records, ...(typeof cursor === 'string' && cursor ? { cursor } : {}), ...(typeof total === 'number' ? { total } : {}) };
}
