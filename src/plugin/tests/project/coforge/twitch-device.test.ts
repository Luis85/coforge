import { afterEach, describe, expect, it, vi } from 'vitest';
import { TwitchAccounts, BOT_SCOPES, STREAMER_SCOPES } from '../../../infrastructure/coforge/twitch-auth';
import { TwitchDeviceAuthorization } from '../../../infrastructure/coforge/twitch-device';
import type { HttpRequest } from '../../../infrastructure/coforge/twitch-http';
import type { TwitchAuthorization } from '../../../features/coforge/domain/twitch';
import { defaultIntegration } from '../../../features/coforge/domain/seed';
import { nodeTimers } from './memory-storage';

afterEach(() => { vi.useRealTimers(); });
function setup(results: Array<unknown | Error> = []) {
  vi.useFakeTimers();
  const config = { ...defaultIntegration(), twitchClientId: 'client' };
  const secrets = new Map<string, string>(); const completed = vi.fn(); const calls: string[] = [];
  let prompt: TwitchAuthorization | undefined; let error: string | undefined;
  const request: HttpRequest = async input => {
    calls.push(input.url);
    if (input.url.endsWith('/device')) return { status: 200, json: { device_code: 'private-device-code', user_code: 'VISIBLE', verification_uri: 'https://www.twitch.tv/activate', expires_in: 600, interval: 5 } };
    if (input.url.endsWith('/validate')) return { status: 200, json: { client_id: 'client', user_id: '123', login: 'streamer', scopes: [...BOT_SCOPES, ...STREAMER_SCOPES] } };
    const result = results.shift();
    if (result instanceof Error) throw result;
    return { status: result && typeof result === 'object' && 'access_token' in result ? 200 : 400, json: result ?? { message: 'authorization_pending' } };
  };
  const accounts = new TwitchAccounts(request, { getSecret: key => secrets.get(key) ?? null, setSecret: (key, value) => { secrets.set(key, value); } }, () => config);
  const device = new TwitchDeviceAuthorization(request, accounts, () => config, (next, problem) => { prompt = next; error = problem; }, completed, nodeTimers());
  return { device, secrets, completed, calls, prompt: () => prompt, error: () => error };
}

describe('public-client Twitch authorization', () => {
  it('keeps private codes and credentials out of public state, polls pending, and saves both rotating credentials', async () => {
    const env = setup([{ message: 'authorization_pending' }, { access_token: 'private-access', refresh_token: 'private-refresh', expires_in: 3600 }]);
    await env.device.begin('streamer');
    expect(env.prompt()).toMatchObject({ role: 'streamer', userCode: 'VISIBLE' });
    expect(JSON.stringify(env.prompt())).not.toContain('private');
    await vi.advanceTimersByTimeAsync(10_000);
    expect(env.completed).toHaveBeenCalledWith('streamer', expect.objectContaining({ id: '123' }));
    expect(JSON.parse(env.secrets.get('coforge-twitch-streamer')!)).toMatchObject({ accessToken: 'private-access', refreshToken: 'private-refresh' });
    expect(env.prompt()).toBeUndefined(); env.device.cancel();
  });
  it('cancels pending polling without writing credentials', async () => {
    const env = setup(); await env.device.begin('streamer'); env.device.cancel();
    await vi.advanceTimersByTimeAsync(600_000);
    expect(env.calls).toHaveLength(1); expect(env.secrets.size).toBe(0); expect(env.completed).not.toHaveBeenCalled();
  });
  it('backs off for slow_down and expires instead of polling indefinitely', async () => {
    const env = setup([{ message: 'slow_down' }]); await env.device.begin('streamer');
    await vi.advanceTimersByTimeAsync(10_000);
    expect(env.calls.filter(url => url.endsWith('/token'))).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(600_000);
    expect(env.error()).toContain('expired'); expect(env.completed).not.toHaveBeenCalled(); env.device.cancel();
  });
  it('recovers from a transient network failure while the device code is valid', async () => {
    const env = setup([new Error('network'), { access_token: 'private-access', refresh_token: 'private-refresh', expires_in: 3600 }]);
    await env.device.begin('streamer'); await vi.advanceTimersByTimeAsync(20_000);
    expect(env.completed).toHaveBeenCalledOnce(); env.device.cancel();
  });
});
