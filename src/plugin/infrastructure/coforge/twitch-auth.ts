import type { IntegrationSettings } from '../../features/coforge/domain/types';
import type { TwitchIdentity, TwitchRole } from '../../features/coforge/domain/twitch';
import { assertResponse, object, strings, TwitchError, type HttpRequest } from './twitch-http';

export const BOT_SCOPES = ['user:read:chat', 'user:write:chat'];
export const STREAMER_SCOPES = ['channel:manage:broadcast', 'moderator:manage:chat_messages', 'moderator:manage:banned_users', 'moderator:read:chatters'];
export interface TwitchSecrets { getSecret(name: string): string | null; setSecret(name: string, value: string): void }
interface Credentials { accessToken: string; refreshToken?: string; expiresAt?: number }
interface Account { credentials: Credentials; identity: TwitchIdentity; checkedAt: number; clientId: string; secretName: string }

/** Credentials never leave this host adapter. Each role has one serialized refresh operation. */
export class TwitchAccounts {
  private readonly accounts = new Map<TwitchRole, Account>();
  private readonly pending = new Map<TwitchRole, Promise<Account>>();
  private readonly authorizationSequence = new Map<TwitchRole, number>();
  constructor(private readonly request: HttpRequest, private readonly secrets: TwitchSecrets,
    private readonly config: () => IntegrationSettings) {}

  role(role: TwitchRole): TwitchRole { return role === 'bot' && this.config().twitchBotUsesStreamer ? 'streamer' : role; }
  scopes(role: TwitchRole): string[] {
    return this.role(role) === 'streamer' ? [...STREAMER_SCOPES, ...(this.config().twitchBotUsesStreamer ? BOT_SCOPES : [])] : [...BOT_SCOPES];
  }
  secretName(role: TwitchRole): string { return this.role(role) === 'streamer' ? this.config().twitchStreamerSecret : this.config().twitchTokenSecret; }
  identity(role: TwitchRole): TwitchIdentity | undefined { const account = this.accounts.get(this.role(role)); return account && this.current(account, role) ? account.identity : undefined; }
  reset(): void { this.accounts.clear(); }

  async token(role: TwitchRole, required: readonly string[] = this.scopes(role), rejectedToken: boolean | string = false): Promise<string> {
    const actual = this.role(role);
    const cached = this.accounts.get(actual);
    const forceRefresh = rejectedToken === true || (typeof rejectedToken === 'string' && cached?.credentials.accessToken === rejectedToken);
    let account: Account;
    if (!forceRefresh && cached && this.current(cached, role) && Date.now() - cached.checkedAt < 55 * 60_000
      && (!cached.credentials.expiresAt || cached.credentials.expiresAt > Date.now() + 60_000)) account = cached;
    else {
      let pending = this.pending.get(actual);
      if (!pending) {
        pending = this.load(actual, forceRefresh).finally(() => { this.pending.delete(actual); });
        this.pending.set(actual, pending);
      }
      try { account = await pending; } catch (error) {
        const latest = this.accounts.get(actual);
        if (latest && latest !== cached && this.current(latest, role)) account = latest;
        else { if (error instanceof TwitchError && error.kind === 'authorization' && latest === cached) this.accounts.delete(actual); throw error; }
      }
    }
    if (!this.current(account, role)) throw new TwitchError('authorization', 'The Twitch account configuration changed. Reconnect before continuing.');
    const missing = required.filter(scope => !account.identity.scopes.includes(scope));
    if (missing.length) throw new TwitchError('authorization', `Reconnect the ${actual} account to grant: ${missing.join(', ')}.`);
    return account.credentials.accessToken;
  }

  async accept(role: TwitchRole, response: unknown, valid: () => boolean = () => true): Promise<TwitchIdentity> {
    const clientId = this.config().twitchClientId; const secretName = this.secretName(role); const actual = this.role(role);
    const sequence = (this.authorizationSequence.get(actual) ?? 0) + 1; this.authorizationSequence.set(actual, sequence);
    const credentials = this.credentials(response);
    const identity = await this.validate(credentials.accessToken);
    if (!valid() || this.authorizationSequence.get(actual) !== sequence) throw new TwitchError('authorization', 'This authorization was cancelled or replaced by a newer connection.');
    if (clientId !== this.config().twitchClientId || secretName !== this.secretName(role) || actual !== this.role(role)) throw new TwitchError('authorization', 'The Twitch configuration changed during authorization. Connect again.');
    const missing = this.scopes(role).filter(scope => !identity.scopes.includes(scope));
    if (missing.length) throw new TwitchError('authorization', 'Twitch did not grant all required permissions. Reconnect and accept the requested permissions.');
    this.save(role, credentials);
    this.accounts.set(actual, { credentials, identity, checkedAt: Date.now(), clientId, secretName });
    return identity;
  }

  private read(role: TwitchRole): Credentials {
    const raw = this.secrets.getSecret(this.secretName(role));
    if (!raw) throw new TwitchError('authorization', `Connect the ${role} account in Twitch settings.`);
    if (!raw.trim().startsWith('{')) return { accessToken: raw.trim() }; // Existing manual user tokens remain supported.
    let value: unknown;
    try { value = JSON.parse(raw); } catch { throw new TwitchError('authorization', 'The stored Twitch credentials are invalid. Reconnect the account.'); }
    const data = object(value);
    if (typeof data.accessToken !== 'string' || !data.accessToken) throw new TwitchError('authorization', 'Reconnect the Twitch account.');
    return { accessToken: data.accessToken, ...(typeof data.refreshToken === 'string' ? { refreshToken: data.refreshToken } : {}),
      ...(typeof data.expiresAt === 'number' ? { expiresAt: data.expiresAt } : {}) };
  }
  private save(role: TwitchRole, value: Credentials): void {
    try { this.secrets.setSecret(this.secretName(role), JSON.stringify(value)); }
    catch { throw new TwitchError('authorization', 'Twitch credentials could not be saved securely. Reconnect after fixing secret storage.'); }
  }
  private credentials(value: unknown): Credentials {
    const data = object(value);
    if (typeof data.access_token !== 'string' || !data.access_token || typeof data.refresh_token !== 'string' || !data.refresh_token
      || typeof data.expires_in !== 'number' || !Number.isFinite(data.expires_in) || data.expires_in <= 0)
      throw new TwitchError('authorization', 'Twitch returned incomplete credentials. Reconnect the account.');
    return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: Date.now() + data.expires_in * 1000 };
  }
  private async load(role: TwitchRole, force: boolean): Promise<Account> {
    const clientId = this.config().twitchClientId; const secretName = this.secretName(role);
    let secretLease = this.secrets.getSecret(secretName);
    let credentials = this.read(role);
    if (force || (credentials.expiresAt && credentials.expiresAt <= Date.now() + 60_000)) { credentials = await this.refresh(role, credentials); secretLease = JSON.stringify(credentials); }
    let identity: TwitchIdentity;
    try { identity = await this.validate(credentials.accessToken); }
    catch (error) {
      if (!(error instanceof TwitchError) || error.kind !== 'authorization' || force || !credentials.refreshToken) throw error;
      credentials = await this.refresh(role, credentials); secretLease = JSON.stringify(credentials); identity = await this.validate(credentials.accessToken);
    }
    const expected = role === 'streamer' ? this.config().twitchBroadcasterId : this.config().twitchBotUserId;
    if (expected && expected !== identity.id) throw new TwitchError('authorization', `The stored ${role} token belongs to a different Twitch user. Reconnect the intended account.`);
    if (secretLease !== this.secrets.getSecret(secretName) || clientId !== this.config().twitchClientId || secretName !== this.secretName(role))
      throw new TwitchError('authorization', 'Twitch credentials changed while authorization was checked. Use the newly connected account.');
    const account = { credentials, identity, checkedAt: Date.now(), clientId, secretName };
    this.accounts.set(role, account); return account;
  }
  private async refresh(role: TwitchRole, previous: Credentials): Promise<Credentials> {
    const clientId = this.config().twitchClientId; const secretName = this.secretName(role);
    const secretLease = this.secrets.getSecret(secretName);
    if (!previous.refreshToken) throw new TwitchError('authorization', 'This manual token cannot refresh automatically. Connect the account with Twitch authorization.');
    const response = await this.request({ url: 'https://id.twitch.tv/oauth2/token', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: previous.refreshToken, client_id: this.config().twitchClientId }).toString() });
    if (response.status === 400 || response.status === 401) throw new TwitchError('authorization', 'Twitch authorization expired or was revoked. Reconnect this account.');
    assertResponse(response);
    if (clientId !== this.config().twitchClientId || secretName !== this.secretName(role) || secretLease !== this.secrets.getSecret(secretName))
      throw new TwitchError('authorization', 'Twitch credentials changed while refreshing. Use the newly connected account.');
    const next = this.credentials(response.json);
    this.save(role, next); // Public-client refresh tokens rotate: save the pair atomically before further use.
    return next;
  }
  private async validate(token: string): Promise<TwitchIdentity> {
    const response = await this.request({ url: 'https://id.twitch.tv/oauth2/validate', headers: { Authorization: `OAuth ${token}` } });
    assertResponse(response);
    const data = object(response.json);
    if (data.client_id !== this.config().twitchClientId || typeof data.user_id !== 'string' || !/^\d+$/.test(data.user_id)
      || typeof data.login !== 'string' || !/^[a-z0-9_]{1,25}$/i.test(data.login))
      throw new TwitchError('authorization', 'The Twitch token does not match this application or a valid user account.');
    return { id: data.user_id, login: data.login, scopes: strings(data.scopes) };
  }
  private current(account: Account, role: TwitchRole): boolean {
    const expected = this.role(role) === 'streamer' ? this.config().twitchBroadcasterId : this.config().twitchBotUserId;
    return account.clientId === this.config().twitchClientId && account.secretName === this.secretName(role) && (!expected || expected === account.identity.id);
  }
}
