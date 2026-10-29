import { afterEach, describe, expect, it, vi } from 'vitest';
import { TwitchAccounts, BOT_SCOPES, STREAMER_SCOPES } from '../../../infrastructure/coforge/twitch-auth';
import { TwitchDeviceAuthorization } from '../../../infrastructure/coforge/twitch-device';
import type { HttpRequest } from '../../../infrastructure/coforge/twitch-http';
import { defaultIntegration } from '../../../features/coforge/domain/seed';
import { nodeTimers } from './memory-storage';

afterEach(() => { vi.useRealTimers(); });
describe('progressive Twitch permissions', () => {
  it('keeps existing grants, requests only the selected additional permission and verifies consent', async () => {
    vi.useFakeTimers();
    const config = { ...defaultIntegration(), twitchClientId: 'client', twitchBroadcasterId: '123' };
    let scopes = [...STREAMER_SCOPES, ...BOT_SCOPES, 'channel:read:ads']; const deviceScopes: string[] = []; const saved: string[] = [];
    const request: HttpRequest = async input => {
      if (input.url.endsWith('/validate')) return { status: 200, json: { client_id: 'client', user_id: '123', login: 'streamer', scopes } };
      if (input.url.endsWith('/device')) {
        deviceScopes.push(new URLSearchParams(input.body).get('scopes') ?? '');
        return { status: 200, json: { device_code: 'private', user_code: 'VISIBLE', verification_uri: 'https://www.twitch.tv/activate', expires_in: 600 } };
      }
      scopes = [...scopes, 'channel:manage:polls'];
      return { status: 200, json: { access_token: 'new-token', refresh_token: 'new-refresh', expires_in: 3600 } };
    };
    const accounts = new TwitchAccounts(request, { getSecret: () => 'old-token', setSecret: (_key, value) => { saved.push(value); } }, () => config);
    await accounts.token('streamer', []);
    const complete = vi.fn();
    const device = new TwitchDeviceAuthorization(request, accounts, () => config, () => {}, complete, nodeTimers());
    await device.begin('streamer', ['channel:manage:polls']);
    expect(deviceScopes[0]?.split(' ')).toContain('channel:read:ads');
    expect(deviceScopes[0]?.split(' ')).toContain('channel:manage:polls');
    expect(deviceScopes[0]?.split(' ')).not.toContain('channel:manage:redemptions');
    await vi.advanceTimersByTimeAsync(5000);
    expect(complete).toHaveBeenCalledOnce(); expect(saved).toHaveLength(1); device.cancel();
  });
  it('does not replace existing credentials when requested feature permission was not granted', async () => {
    const config = { ...defaultIntegration(), twitchClientId: 'client', twitchBroadcasterId: '123' }; const saved: string[] = [];
    const request: HttpRequest = async () => ({ status: 200, json: { client_id: 'client', user_id: '123', login: 'streamer', scopes: [...STREAMER_SCOPES, ...BOT_SCOPES] } });
    const accounts = new TwitchAccounts(request, { getSecret: () => 'old-token', setSecret: (_key, value) => { saved.push(value); } }, () => config);
    await expect(accounts.accept('streamer', { access_token: 'new', refresh_token: 'refresh', expires_in: 3600 }, () => true, ['channel:manage:polls'])).rejects.toThrow('permissions');
    expect(saved).toHaveLength(0);
  });
});
