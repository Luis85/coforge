import { expect, it, vi } from 'vitest';
import { TwitchApi } from '../../../infrastructure/coforge/twitch-api';
import { TwitchAccounts, STREAMER_SCOPES } from '../../../infrastructure/coforge/twitch-auth';
import { defaultIntegration } from '../../../features/coforge/domain/seed';
import type { HttpRequest, HttpResponse } from '../../../infrastructure/coforge/twitch-http';

function fixture(response: () => Promise<HttpResponse> = async () => ({ status: 200, json: { data: [{ broadcaster_id: '123', user_id: '91' }], pagination: {} } }), scopes: readonly string[] = STREAMER_SCOPES) {
  const config = { ...defaultIntegration(), twitchClientId: 'client', twitchBroadcasterId: '123' };
  const queries: URL[] = [];
  const request: HttpRequest = async input => {
    if (input.url.endsWith('/validate')) return { status: 200, json: { client_id: 'client', user_id: '123', login: 'streamer', scopes } };
    queries.push(new URL(input.url)); return response();
  };
  const accounts = new TwitchAccounts(request, { getSecret: () => 'test-token', setSecret: () => undefined }, () => config);
  return { api: new TwitchApi(request, accounts, () => config), config, queries };
}

it('verifies only requested current-channel subscriber IDs with the existing broadcaster scope', async () => {
  const f = fixture();
  expect(await f.api.subscriptions(['92', '91'])).toEqual(['91']);
  expect(f.queries).toHaveLength(1);
  expect(f.queries[0]!.pathname).toBe('/helix/subscriptions');
  expect(f.queries[0]!.searchParams.get('broadcaster_id')).toBe('123');
  expect(f.queries[0]!.searchParams.getAll('user_id')).toEqual(['92', '91']);
  expect(f.queries[0]!.searchParams.get('first')).toBe('100');
  expect(f.queries[0]!.searchParams.has('after')).toBe(false);
});

it('does not turn an empty or invalid selection into an unrestricted subscriber listing', async () => {
  const f = fixture();
  expect(await f.api.subscriptions([])).toEqual([]);
  await expect(f.api.subscriptions(['twitch:91'])).rejects.toThrow('100');
  await expect(f.api.subscriptions(Array.from({ length: 101 }, (_, index) => String(index + 1)))).rejects.toThrow('100');
  expect(f.queries).toHaveLength(0);
});

it.each([
  { data: [{ broadcaster_id: '456', user_id: '91' }], pagination: {} },
  { data: [{ broadcaster_id: '123', user_id: '99' }], pagination: {} },
  { data: [{ broadcaster_id: '123', user_id: '91' }, { broadcaster_id: '123', user_id: '91' }], pagination: {} },
  { data: [], pagination: { cursor: 'unexpected-page' } },
  { data: [] },
  { pagination: {} },
])('rejects incomplete or unrelated subscriber evidence instead of implying verification: %j', async payload => {
  const f = fixture(async () => ({ status: 200, json: payload }));
  await expect(f.api.subscriptions(['91'])).rejects.toThrow('subscription');
});

it('rejects a slow response after the selected channel changes', async () => {
  let complete!: (response: HttpResponse) => void;
  const pending = new Promise<HttpResponse>(resolve => { complete = resolve; });
  const f = fixture(() => pending);
  const lookup = f.api.subscriptions(['91']);
  const rejected = expect(lookup).rejects.toThrow('connection changed');
  await vi.waitFor(() => expect(f.queries).toHaveLength(1));
  f.config.twitchBroadcasterId = '456';
  complete({ status: 200, json: { data: [{ broadcaster_id: '123', user_id: '91' }], pagination: {} } });
  await rejected;
});

it('requires the subscription permission before querying and accepts complete empty evidence', async () => {
  const denied = fixture(undefined, []);
  await expect(denied.api.subscriptions(['91'])).rejects.toThrow('grant');
  expect(denied.queries).toHaveLength(0);
  const empty = fixture(async () => ({ status: 200, json: { data: [], pagination: {} } }));
  expect(await empty.api.subscriptions(['91'])).toEqual([]);
});
