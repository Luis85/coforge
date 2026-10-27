import { describe, expect, it } from 'vitest';
import { TwitchAccounts, BOT_SCOPES, STREAMER_SCOPES } from '../../../infrastructure/coforge/twitch-auth';
import { TwitchApi } from '../../../infrastructure/coforge/twitch-api';
import type { HttpRequest } from '../../../infrastructure/coforge/twitch-http';
import { defaultIntegration } from '../../../features/coforge/domain/seed';

describe('Twitch authorization and channel writes', () => {
  it('does not save a cancelled authorization or let an older login replace a newer one', async () => {
    const config = { ...defaultIntegration(), twitchClientId: 'client', twitchBroadcasterId: '123' };
    const secrets = new Map<string, string>();
    let finish!: (value: { status: number; json: unknown }) => void;
    const waiting = new Promise<{ status: number; json: unknown }>(resolve => { finish = resolve; });
    const identity = { status: 200, json: { client_id: 'client', user_id: '123', login: 'streamer', scopes: [...BOT_SCOPES, ...STREAMER_SCOPES] } };
    const request: HttpRequest = async input => input.headers.Authorization === 'OAuth older-login' ? waiting : identity;
    const accounts = new TwitchAccounts(request, { getSecret: key => secrets.get(key) ?? null, setSecret: (key, value) => { secrets.set(key, value); } }, () => config);
    const old = accounts.accept('streamer', { access_token: 'older-login', refresh_token: 'older-refresh', expires_in: 3600 });
    const rejected = expect(old).rejects.toThrow('cancelled or replaced');
    await accounts.accept('streamer', { access_token: 'newer-login', refresh_token: 'newer-refresh', expires_in: 3600 });
    finish(identity); await rejected;
    await expect(accounts.accept('streamer', { access_token: 'cancelled-login', refresh_token: 'cancelled-refresh', expires_in: 3600 }, () => false)).rejects.toThrow('cancelled');
    expect(JSON.parse(secrets.get(config.twitchStreamerSecret)!)).toMatchObject({ accessToken: 'newer-login', refreshToken: 'newer-refresh' });
  });
  it('does not let a slow old refresh overwrite a newly authorized token pair', async () => {
    const config = { ...defaultIntegration(), twitchClientId: 'client', twitchBroadcasterId: '123' };
    const secrets = new Map([[config.twitchStreamerSecret, JSON.stringify({ accessToken: 'old', refreshToken: 'old-refresh', expiresAt: 1 })]]);
    let finish!: (value: { status: number; json: unknown }) => void;
    const waiting = new Promise<{ status: number; json: unknown }>(resolve => { finish = resolve; });
    const request: HttpRequest = async input => input.url.endsWith('/token') ? waiting : { status: 200, json: { client_id: 'client', user_id: '123', login: 'streamer', scopes: [...BOT_SCOPES, ...STREAMER_SCOPES] } };
    const accounts = new TwitchAccounts(request, { getSecret: key => secrets.get(key) ?? null, setSecret: (key, value) => { secrets.set(key, value); } }, () => config);
    const pending = accounts.token('streamer');
    await accounts.accept('streamer', { access_token: 'new-grant', refresh_token: 'new-refresh', expires_in: 3600 });
    finish({ status: 200, json: { access_token: 'old-rotated', refresh_token: 'old-next', expires_in: 3600 } });
    expect(await pending).toBe('new-grant');
    expect(JSON.parse(secrets.get(config.twitchStreamerSecret)!)).toMatchObject({ accessToken: 'new-grant', refreshToken: 'new-refresh' });
  });
  it('serializes rotating refresh tokens and stores the access/refresh pair together', async () => {
    const config = { ...defaultIntegration(), twitchClientId: 'client', twitchBroadcasterId: '123' };
    const secrets = new Map([[config.twitchStreamerSecret, JSON.stringify({ accessToken: 'old', refreshToken: 'once', expiresAt: 1 })]]);
    let refreshes = 0;
    const request: HttpRequest = async input => input.url.endsWith('/token')
      ? (refreshes++, { status: 200, json: { access_token: 'new', refresh_token: 'next', expires_in: 3600 } })
      : { status: 200, json: { client_id: 'client', user_id: '123', login: 'streamer', scopes: [...BOT_SCOPES, ...STREAMER_SCOPES] } };
    const accounts = new TwitchAccounts(request, { getSecret: key => secrets.get(key) ?? null, setSecret: (key, value) => { secrets.set(key, value); } }, () => config);
    expect(await Promise.all([accounts.token('bot'), accounts.token('streamer')])).toEqual(['new', 'new']);
    expect(refreshes).toBe(1);
    expect(JSON.parse(secrets.get(config.twitchStreamerSecret)!)).toMatchObject({ accessToken: 'new', refreshToken: 'next' });
  });

  it('does not call a channel write when the account lacks permission', async () => {
    const config = { ...defaultIntegration(), twitchClientId: 'client', twitchBroadcasterId: '123' };
    const calls: string[] = [];
    const request: HttpRequest = async input => { calls.push(input.method ?? 'GET'); return { status: 200, json: { client_id: 'client', user_id: '123', login: 'streamer', scopes: BOT_SCOPES } }; };
    const accounts = new TwitchAccounts(request, { getSecret: () => 'test-token', setSecret: () => undefined }, () => config);
    const api = new TwitchApi(request, accounts, () => config);
    await expect(api.updateChannel({ title: 'Updated', categoryId: '42' })).rejects.toThrow('grant');
    expect(calls).toEqual(['GET']);
  });

  it('checks is_sent rather than accepting HTTP 200, and replies to the original message', async () => {
    const config = { ...defaultIntegration(), twitchClientId: 'client', twitchBroadcasterId: '123' };
    let sent: unknown;
    const request: HttpRequest = async input => {
      if (input.url.endsWith('/validate')) return { status: 200, json: { client_id: 'client', user_id: '123', login: 'streamer', scopes: BOT_SCOPES } };
      sent = JSON.parse(input.body ?? '{}'); return { status: 200, json: { data: [{ is_sent: false, message_id: '', drop_reason: { code: 'automod_held' } }] } };
    };
    const accounts = new TwitchAccounts(request, { getSecret: () => 'test-token', setSecret: () => undefined }, () => config);
    const api = new TwitchApi(request, accounts, () => config);
    await expect(api.send('Saved CF-001', 'original-message')).rejects.toThrow('automod_held');
    expect(sent).toMatchObject({ reply_parent_message_id: 'original-message', broadcaster_id: '123', sender_id: '123' });
  });

  it('never translates an empty deletion target into clearing the chat', async () => {
    const config = defaultIntegration();
    const request: HttpRequest = async () => { throw new Error('No request expected'); };
    const accounts = new TwitchAccounts(request, { getSecret: () => null, setSecret: () => undefined }, () => config);
    const api = new TwitchApi(request, accounts, () => ({ ...config, twitchBroadcasterId: '123' }));
    await expect(api.moderate({ type: 'delete', messageId: '' })).rejects.toThrow('one Twitch message');
  });
  it('requires a moderation confirmation for the exact selected broadcaster and viewer', async () => {
    const config = { ...defaultIntegration(), twitchClientId: 'client', twitchBroadcasterId: '123' };
    const request: HttpRequest = async input => input.url.endsWith('/validate')
      ? { status: 200, json: { client_id: 'client', user_id: '123', login: 'streamer', scopes: STREAMER_SCOPES } }
      : { status: 200, json: { data: [{ broadcaster_id: '123', user_id: 'different-user' }] } };
    const accounts = new TwitchAccounts(request, { getSecret: () => 'test-token', setSecret: () => undefined }, () => config);
    await expect(new TwitchApi(request, accounts, () => config).moderate({ type: 'ban', userId: '99', reason: '' })).rejects.toThrow('did not confirm');
  });
});
