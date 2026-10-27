import type { IntegrationSettings } from '../../features/coforge/domain/types';
import type { Timers } from '../../features/coforge/application/ports';
import type { TwitchAuthorization, TwitchIdentity, TwitchRole } from '../../features/coforge/domain/twitch';
import { TwitchAccounts } from './twitch-auth';
import { assertResponse, object, TwitchError, type HttpRequest, type HttpResponse } from './twitch-http';

export class TwitchDeviceAuthorization {
  private generation = 0;
  private timer: number | undefined;
  constructor(private readonly request: HttpRequest, private readonly accounts: TwitchAccounts,
    private readonly config: () => IntegrationSettings, private readonly show: (prompt?: TwitchAuthorization, error?: string) => void,
    private readonly complete: (role: TwitchRole, identity: TwitchIdentity) => Promise<void>, private readonly timers: Timers) {}
  cancel(): void { this.generation++; if (this.timer !== undefined) this.timers.clearTimeout(this.timer); this.timer = undefined; this.show(); }
  async begin(role: TwitchRole): Promise<void> {
    this.cancel();
    const clientId = this.config().twitchClientId;
    if (!clientId) throw new TwitchError('authorization', 'Save your Twitch application Client ID first.');
    const generation = this.generation;
    const scopes = this.accounts.scopes(role);
    const response = await this.request({ url: 'https://id.twitch.tv/oauth2/device', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, scopes: scopes.join(' ') }).toString() });
    assertResponse(response);
    const data = object(response.json);
    if (typeof data.device_code !== 'string' || typeof data.user_code !== 'string' || typeof data.verification_uri !== 'string'
      || typeof data.expires_in !== 'number' || !Number.isFinite(data.expires_in) || data.expires_in <= 0)
      throw new TwitchError('authorization', 'Twitch returned an invalid authorization code. Try connecting again.');
    const uri = new URL(data.verification_uri);
    if (uri.protocol !== 'https:' || !['www.twitch.tv', 'twitch.tv'].includes(uri.hostname) || uri.username || uri.password || !/^\/activate\/?$/.test(uri.pathname))
      throw new TwitchError('authorization', 'Twitch returned an unexpected authorization address.');
    if (generation !== this.generation || clientId !== this.config().twitchClientId) return;
    const expires = Date.now() + Math.min(data.expires_in, 3600) * 1000;
    const deviceCode = data.device_code;
    let interval = Math.max(5, Math.min(60, typeof data.interval === 'number' && Number.isFinite(data.interval) ? data.interval : 5)) * 1000;
    this.show({ role, userCode: data.user_code, verificationUri: uri.href, expiresAt: new Date(expires).toISOString() });
    const poll = async () => {
      if (generation !== this.generation || clientId !== this.config().twitchClientId) return;
      if (Date.now() >= expires) { this.show(undefined, 'The Twitch authorization code expired. Connect again.'); return; }
      try {
        let result: HttpResponse;
        try {
          result = await this.request({ url: 'https://id.twitch.tv/oauth2/token', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ client_id: clientId, device_code: deviceCode, scopes: scopes.join(' '), grant_type: 'urn:ietf:params:oauth:grant-type:device_code' }).toString() });
        } catch {
          if (generation === this.generation) this.timer = this.timers.setTimeout(() => { void poll(); }, interval);
          return;
        }
        if (generation !== this.generation || clientId !== this.config().twitchClientId) return;
        if (result.status >= 500) { this.timer = this.timers.setTimeout(() => { void poll(); }, interval); return; }
        const value = object(result.json);
        if (value.message === 'authorization_pending' || value.error === 'authorization_pending') { this.timer = this.timers.setTimeout(() => { void poll(); }, interval); return; }
        if (value.message === 'slow_down' || value.error === 'slow_down' || result.status === 429) { interval += 5000; this.timer = this.timers.setTimeout(() => { void poll(); }, interval); return; }
        assertResponse(result);
        const identity = await this.accounts.accept(role, result.json);
        if (generation !== this.generation) return;
        await this.complete(role, identity); this.show();
      } catch (error) { if (generation === this.generation) this.show(undefined, error instanceof TwitchError ? error.message : 'Twitch authorization failed. Connect again.'); }
    };
    this.timer = this.timers.setTimeout(() => { void poll(); }, interval);
  }
}
