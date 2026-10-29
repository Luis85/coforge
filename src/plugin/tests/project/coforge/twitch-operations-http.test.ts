import { describe, expect, it } from 'vitest';
import { TwitchOperationsHttp } from '../../../infrastructure/coforge/twitch-operations-http';
import { TwitchAccounts } from '../../../infrastructure/coforge/twitch-auth';
import { defaultIntegration } from '../../../features/coforge/domain/seed';
import type { HttpRequest, HttpResponse } from '../../../infrastructure/coforge/twitch-http';

function fixture(respond: (input: Parameters<HttpRequest>[0]) => HttpResponse | Promise<HttpResponse>, scopes: string[] = []) {
  const config = { ...defaultIntegration(), twitchClientId: 'client', twitchBroadcasterId: '123' };
  const calls: Parameters<HttpRequest>[0][] = [];
  const request: HttpRequest = async input => {
    if (input.url.endsWith('/validate')) return { status: 200, json: { client_id: config.twitchClientId, user_id: '123', login: 'streamer', scopes } };
    calls.push(input); return respond(input);
  };
  const accounts = new TwitchAccounts(request, { getSecret: () => 'test-token', setSecret: () => undefined }, () => config);
  return { config, calls, http: new TwitchOperationsHttp(request, accounts, () => config) };
}

describe('Twitch operations HTTP boundary', () => {
  it('binds every read and write to the validated broadcaster and encodes repeated query keys', async () => {
    const env = fixture(() => ({ status: 200, json: { data: [] } }), ['channel:read:subscriptions']);
    await env.http.call({ method: 'GET', path: 'subscriptions', scopes: ['channel:read:subscriptions'], query: { broadcaster_id: '123', user_id: ['45', '67'] } });
    expect(env.calls[0]?.url).toBe('https://api.twitch.tv/helix/subscriptions?broadcaster_id=123&user_id=45&user_id=67');
    expect(env.calls[0]?.headers.Authorization).toBe('Bearer test-token');
  });
  it('rejects missing permission without sending an endpoint request', async () => {
    const env = fixture(() => ({ status: 204, json: null }));
    await expect(env.http.call({ method: 'POST', path: 'raids', scopes: ['channel:manage:raids'] })).rejects.toThrow('grant');
    expect(env.calls).toHaveLength(0);
  });
  it('never returns a stale result after the channel changes in flight', async () => {
    const env = fixture(() => { env.config.twitchBroadcasterId = '456'; return { status: 200, json: { data: [] } }; });
    await expect(env.http.call({ method: 'GET', path: 'channels', scopes: [] })).rejects.toThrow('changed');
  });
  it('classifies unconfirmed writes as uncertain and never retries them', async () => {
    const env = fixture(() => ({ status: 503, json: { message: 'private provider error' } }));
    await expect(env.http.call({ method: 'POST', path: 'raids', scopes: [] })).rejects.toMatchObject({ kind: 'uncertain' });
    expect(env.calls).toHaveLength(1);
  });
  it('honors the rate reset before allowing another request', async () => {
    const env = fixture(() => ({ status: 429, json: {}, headers: { 'Ratelimit-Reset': String(Math.floor(Date.now() / 1000) + 60) } }));
    await expect(env.http.call({ method: 'GET', path: 'channels', scopes: [] })).rejects.toMatchObject({ kind: 'rate' });
    await expect(env.http.call({ method: 'GET', path: 'channels', scopes: [] })).rejects.toMatchObject({ kind: 'rate' });
    expect(env.calls).toHaveLength(1);
  });
  it('rejects an account that is not the selected broadcaster', async () => {
    const env = fixture(() => ({ status: 200, json: { data: [] } })); env.config.twitchBroadcasterId = '456';
    await expect(env.http.call({ method: 'GET', path: 'channels', scopes: [] })).rejects.toThrow('account');
    expect(env.calls).toHaveLength(0);
  });
});
