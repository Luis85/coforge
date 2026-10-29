import { describe, expect, it, vi } from 'vitest';
import { TwitchOperationsApi } from '../../../infrastructure/coforge/twitch-operations-api';
import { TwitchAccounts, STREAMER_SCOPES } from '../../../infrastructure/coforge/twitch-auth';
import { defaultIntegration } from '../../../features/coforge/domain/seed';
import type { TwitchAction } from '../../../features/coforge/domain/twitch-operations';
import type { HttpRequest, HttpResponse } from '../../../infrastructure/coforge/twitch-http';

function setup(reply: (input: Parameters<HttpRequest>[0]) => HttpResponse = () => ({ status: 200, json: { data: [] } }), scopes: string[] = []) {
  const config = { ...defaultIntegration(), twitchClientId: 'client', twitchBroadcasterId: '123' }; const calls: Parameters<HttpRequest>[0][] = [];
  const request: HttpRequest = async input => {
    if (input.url.endsWith('/validate')) return { status: 200, json: { client_id: config.twitchClientId, user_id: config.twitchBroadcasterId, login: 'streamer', scopes: [...STREAMER_SCOPES, ...scopes] } };
    calls.push(input); return reply(input);
  };
  const accounts = new TwitchAccounts(request, { getSecret: () => 'test-token', setSecret: () => undefined }, () => config);
  return { calls, config, accounts, api: new TwitchOperationsApi(request, accounts, () => config) };
}

describe('Twitch operation endpoint contracts', () => {
  it('translates poll choices and commercial length to Twitch wire types', async () => {
    const env = setup(input => ({ status: 200, json: { data: input.url.includes('/commercial') ? [{ length: 60, retry_after: 480, message: '' }] : [{ broadcaster_id: '123', id: 'created', status: 'ACTIVE' }] } }), ['channel:manage:polls', 'channel:edit:commercial']);
    await env.api.execute({ name: 'poll-create', parameters: { title: 'What next?', choices: ['Lantern', 'Bridge'], duration: 60 } });
    await env.api.execute({ name: 'commercial', parameters: { length: '60' } });
    expect(JSON.parse(env.calls[0]?.body ?? '{}')).toEqual({ broadcaster_id: '123', title: 'What next?', choices: [{ title: 'Lantern' }, { title: 'Bridge' }], duration: 60 });
    expect(JSON.parse(env.calls[1]?.body ?? '{}')).toEqual({ broadcaster_id: '123', length: 60 });
  });
  it('puts AutoMod identity in body and unban decision in query', async () => {
    const env = setup(input => ({ status: input.url.includes('automod/message') ? 204 : 200, json: { data: [{ id: 'request-1', broadcaster_id: '123', status: 'denied' }] } }), ['moderator:manage:automod', 'moderator:manage:unban_requests']);
    await env.api.execute({ name: 'automod-resolve', parameters: { msg_id: 'held-1', action: 'DENY' } });
    await env.api.execute({ name: 'unban-request-resolve', parameters: { unban_request_id: 'request-1', status: 'denied', resolution_text: 'Keep restriction' } });
    expect(JSON.parse(env.calls[0]?.body ?? '{}')).toEqual({ user_id: '123', msg_id: 'held-1', action: 'DENY' });
    expect(new URL(env.calls[1]!.url).searchParams.get('status')).toBe('denied');
    expect(env.calls[1]?.body).toBeUndefined();
  });
  it('does not mutate rewards belonging to a different application', async () => {
    const env = setup(() => ({ status: 200, json: { data: [] } }), ['channel:manage:redemptions']);
    await expect(env.api.execute({ name: 'reward-delete', parameters: { id: 'foreign-reward' } })).rejects.toThrow('application');
    expect(env.calls).toHaveLength(1); expect(env.calls[0]?.method).toBe('GET');
    expect(new URL(env.calls[0]!.url).searchParams.get('only_manageable_rewards')).toBe('true');
  });
  it('resolves app-owned redemptions using exact reward and redemption IDs', async () => {
    const env = setup(input => ({ status: 200, json: { data: input.method === 'GET' ? [{ id: 'reward-1', broadcaster_id: '123' }] : [{ id: 'redemption-1', broadcaster_id: '123', status: 'CANCELED' }] } }), ['channel:manage:redemptions']);
    await env.api.execute({ name: 'redemption-update', parameters: { reward_id: 'reward-1', id: 'redemption-1', status: 'CANCELED' } });
    expect(new URL(env.calls[1]!.url).searchParams.get('reward_id')).toBe('reward-1');
    expect(new URL(env.calls[1]!.url).searchParams.get('id')).toBe('redemption-1');
    expect(JSON.parse(env.calls[1]?.body ?? '{}')).toEqual({ status: 'CANCELED' });
  });
  it('accepts granted management scopes for read resources and retains continuation', async () => {
    const env = setup(() => ({ status: 200, json: { data: [{ id: 'poll-1', broadcaster_id: '123' }], pagination: { cursor: 'next' } } }), ['channel:manage:polls']);
    expect(await env.api.read('polls', { after: 'page-1' })).toEqual({ records: [{ id: 'poll-1', broadcaster_id: '123' }], cursor: 'next' });
    expect(new URL(env.calls[0]!.url).searchParams.get('after')).toBe('page-1');
  });
  it('flattens schedule segments without losing channel identity', async () => {
    const env = setup(() => ({ status: 200, json: { data: { broadcaster_id: '123', segments: [{ id: 'segment-1', title: 'Build stream' }] } } }));
    expect((await env.api.read('schedule')).records).toEqual([{ id: 'segment-1', title: 'Build stream' }]);
  });
  it('rejects attempts to smuggle a different broadcaster into read parameters', async () => {
    const env = setup(); await expect(env.api.read('followers', { broadcaster_id: '456' })).rejects.toThrow('parameter'); expect(env.calls).toHaveLength(0);
  });
  it('rejects filters a dataset cannot honor and enforces its actual page limit', async () => {
    const env = setup(undefined, ['channel:read:polls']);
    await expect(env.api.read('polls', { user_id: '456' })).rejects.toThrow('parameter');
    await expect(env.api.read('polls', { first: 21 })).rejects.toThrow('20');
    await expect(env.api.read('schedule', { first: 26 })).rejects.toThrow('25');
    expect(env.calls).toHaveLength(0);
  });
  it('sends schedule start and segment filters instead of silently discarding them', async () => {
    const env = setup(() => ({ status: 200, json: { data: { broadcaster_id: '123', segments: [] }, pagination: { cursor: 'next' } } }));
    await env.api.read('schedule', { id: 'opaque-segment', start_time: '2026-10-29T14:00:00Z' });
    const query = new URL(env.calls[0]!.url).searchParams;
    expect(query.get('id')).toBe('opaque-segment'); expect(query.get('start_time')).toBe('2026-10-29T14:00:00Z');
  });
  it('does not claim a malformed or cross-channel response is a successful snapshot', async () => {
    const env = setup(() => ({ status: 200, json: { data: [{ broadcaster_id: '456' }] } }));
    await expect(env.api.read('clips')).rejects.toThrow('another channel');
  });
  it('previews the exact raid target through read-only channel and live-state requests', async () => {
    const env = setup(input => ({ status: 200, json: { data: input.url.includes('/channels?')
      ? [{ broadcaster_id: '456', broadcaster_login: 'target', broadcaster_name: 'Target channel', title: 'Building a bridge', game_id: '42', game_name: 'Game' }]
      : [{ id: 'stream-1', user_id: '456', viewer_count: 42, started_at: '2026-10-29T14:00:00Z' }] } }));
    expect(await env.api.previewRaid('456')).toMatchObject({ id: '456', name: 'Target channel', isLive: true, viewers: 42, categoryName: 'Game' });
    expect(env.calls).toHaveLength(2); expect(env.calls.every(call => call.method === 'GET')).toBe(true);
    await expect(env.api.previewRaid('123')).rejects.toThrow('another');
  });
  it('keeps offline raid targets distinct from unavailable or mismatched target data', async () => {
    const env = setup(input => ({ status: 200, json: { data: input.url.includes('/channels?')
      ? [{ broadcaster_id: '456', broadcaster_login: 'target', broadcaster_name: 'Target', title: 'Offline', game_id: '42', game_name: 'Game' }] : [] } }));
    expect(await env.api.previewRaid('456')).toMatchObject({ isLive: false, viewers: null });
    await expect(env.api.previewRaid('789')).rejects.toThrow('target');
  });
  it('rejects an unresolved prediction winner before sending', async () => {
    const env = setup(undefined, ['channel:manage:predictions']);
    await expect(env.api.execute({ name: 'prediction-end', parameters: { id: 'prediction-1', status: 'RESOLVED' } })).rejects.toThrow('outcome');
    expect(env.calls).toHaveLength(0);
  });
  it('keeps live clip creation asynchronous and uses the current channel', async () => {
    const env = setup(() => ({ status: 202, json: { data: [{ id: 'clip-1', edit_url: 'https://clips.twitch.tv/clip-1/edit' }] } }), ['clips:edit']);
    expect(await env.api.execute({ name: 'clip-create', parameters: { has_delay: true } })).toMatchObject({ records: [{ id: 'clip-1' }] });
    expect(new URL(env.calls[0]!.url).searchParams.get('broadcaster_id')).toBe('123');
    expect(new URL(env.calls[0]!.url).searchParams.get('has_delay')).toBe('true');
  });
  it('rejects a channel switch during scope preflight before sending a stale endpoint', async () => {
    const env = setup(); const token = env.accounts.token.bind(env.accounts); let changed = false;
    vi.spyOn(env.accounts, 'token').mockImplementation(async (role, scopes, rejected) => {
      const result = await token(role, scopes, rejected);
      if (!changed) { changed = true; env.config.twitchBroadcasterId = '456'; env.accounts.reset(); }
      return result;
    });
    await expect(env.api.read('clips')).rejects.toThrow('changed');
    expect(env.calls).toHaveLength(0);
  });
  it('does not confirm an unban decision for a different request or opposite outcome', async () => {
    const env = setup(() => ({ status: 200, json: { data: [{ id: 'another-request', broadcaster_id: '123', status: 'approved' }] } }), ['moderator:manage:unban_requests']);
    await expect(env.api.execute({ name: 'unban-request-resolve', parameters: { unban_request_id: 'reviewed-request', status: 'denied' } })).rejects.toMatchObject({ kind: 'uncertain' });
    expect(env.calls).toHaveLength(1);
  });
  it.each<TwitchAction>([
    { name: 'clip-create', parameters: {} },
    { name: 'marker-create', parameters: {} },
    { name: 'raid-start', parameters: { to_broadcaster_id: '99' } },
    { name: 'commercial', parameters: { length: '60' } },
  ])('holds a malformed successful $name receipt as uncertain', async action => {
    const env = setup(() => ({ status: action.name === 'clip-create' ? 202 : 200, json: { data: [{}] } }), ['clips:edit', 'channel:manage:raids', 'channel:edit:commercial']);
    await expect(env.api.execute(action)).rejects.toMatchObject({ kind: 'uncertain' });
    expect(env.calls).toHaveLength(1);
  });
  it.each<TwitchAction>([
    { name: 'raid-start', parameters: { to_broadcaster_id: '99' } },
    { name: 'raid-cancel', parameters: {} },
    { name: 'marker-create', parameters: { description: 'Feature shipped' } },
    { name: 'shield', parameters: { is_active: true } },
  ])('binds $name mutations to the authenticated broadcaster', async action => {
    const env = setup(input => ({ status: input.url.includes('raids') && input.method === 'DELETE' ? 204 : 200, json: { data: [{ id: 'result-1', broadcaster_id: '123', is_active: true, created_at: '2026-10-29T14:00:00Z', position_seconds: 100 }] } }), ['channel:manage:raids', 'moderator:manage:shield_mode']);
    await env.api.execute(action); const call = env.calls[0]!;
    expect(call.url + (call.body ?? '')).toContain('123');
  });
});
