import { expect, it, vi } from 'vitest';
import { TwitchApi } from '../../../infrastructure/coforge/twitch-api';
import { TwitchAccounts, STREAMER_SCOPES } from '../../../infrastructure/coforge/twitch-auth';
import { defaultIntegration } from '../../../features/coforge/domain/seed';
import type { HttpResponse } from '../../../infrastructure/coforge/twitch-http';

function fixture(answer: () => Promise<HttpResponse>) {
  const config = { ...defaultIntegration(), twitchClientId: 'client', twitchBroadcasterId: '123' };
  const queries: URL[] = [];
  const request = async (input: { url: string }) => {
    if (input.url.endsWith('/validate')) return { status: 200, json: { client_id: 'client', user_id: '123', login: 'streamer', scopes: STREAMER_SCOPES } };
    queries.push(new URL(input.url)); return answer();
  };
  const accounts = new TwitchAccounts(request, { getSecret: () => 'test-token', setSecret: () => undefined }, () => config);
  return { api: new TwitchApi(request, accounts, () => config), config, queries };
}
it('requests all 100 filtered restriction rows instead of relying on the default page size', async () => {
  const ids = Array.from({ length: 26 }, (_, index) => String(index + 1));
  const f = fixture(async () => ({ status: 200, json: { data: ids.map(user_id => ({ user_id, expires_at: '' })), pagination: {} } }));
  expect(await f.api.restrictions(ids)).toHaveLength(26);
  expect(f.queries[0]!.searchParams.get('first')).toBe('100');
  expect(f.queries[0]!.searchParams.getAll('user_id')).toEqual(ids);
});
it.each([
  { data: [], pagination: { cursor: 'more-bans' } },
  { data: [] },
  { data: [{ user_id: '91' }, { user_id: '91', expires_at: '' }], pagination: {} },
  { data: [{ user_id: '91', expires_at: '' }, { user_id: '91', expires_at: '' }], pagination: {} },
])('does not turn incomplete restriction evidence into an authoritative unban: %j', async payload => {
  const f = fixture(async () => ({ status: 200, json: payload }));
  await expect(f.api.restrictions(['91'])).rejects.toThrow();
});
it('rejects a restriction read that completes after the channel changes', async () => {
  let complete!: (response: HttpResponse) => void;
  const f = fixture(() => new Promise(done => { complete = done; }));
  const pending = f.api.restrictions(['91']);
  const rejected = expect(pending).rejects.toThrow('connection changed');
  await vi.waitFor(() => expect(f.queries).toHaveLength(1)); f.config.twitchBroadcasterId = '456';
  complete({ status: 200, json: { data: [], pagination: {} } }); await rejected;
});
