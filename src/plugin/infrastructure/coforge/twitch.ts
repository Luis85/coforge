import type { Timers } from '../../features/coforge/application/ports';
import { object, assertResponse, TwitchError, type HttpRequest } from './twitch-http';
import type { ChatRemoval } from '../../features/coforge/domain/chat-removal';
export type { HttpRequest } from './twitch-http';
export interface TwitchChatInput { username: string; userId: string; text: string; source: 'twitch'; messageId: string; sentAt?: string }
export interface TwitchConfig { clientId: string; botUserId: string; broadcasterId: string }
export interface TwitchSocket {
  onmessage: ((event: MessageEvent) => unknown) | null;
  onclose: ((event: CloseEvent) => unknown) | null;
  onerror: ((event: Event) => unknown) | null;
  close(): void;
}
export interface TwitchEventSubscription { type: string; version: string; condition: Record<string, string> }
export interface TwitchTransport {
  request: HttpRequest; socket: (url: string) => TwitchSocket; token: () => Promise<string>; timers: Timers; random?: () => number;
  onIntakeError?: () => void; onRemoval?(input: ChatRemoval): Promise<void>; onOwnMessage?(input: TwitchChatInput): Promise<void>;
  subscriptions?: readonly TwitchEventSubscription[]; onNotification?(frame: unknown): Promise<void>;
}
export interface TwitchConnectionStatus { phase: 'connecting' | 'connected' | 'reconnecting' | 'error'; message: string; transferred?: boolean }
const EVENTSUB = 'wss://eventsub.wss.twitch.tv/ws?keepalive_timeout_seconds=30';
const CHAT_SUBSCRIPTIONS = ['channel.chat.message', 'channel.chat.message_delete', 'channel.chat.clear_user_messages', 'channel.chat.clear'] as const;

export function parseTwitchNotification(value: unknown): TwitchChatInput | null {
  const frame = object(value); const payload = object(frame.payload); const event = object(payload.event); const message = object(event.message);
  if (object(frame.metadata).message_type !== 'notification' || object(payload.subscription).type !== 'channel.chat.message'
    || typeof event.chatter_user_id !== 'string' || !/^\d+$/.test(event.chatter_user_id) || typeof event.chatter_user_name !== 'string'
    || typeof event.message_id !== 'string' || !event.message_id || typeof message.text !== 'string') return null;
  const sentAt = object(frame.metadata).message_timestamp;
  return { userId: 'twitch:' + event.chatter_user_id, username: event.chatter_user_name.slice(0, 80), text: message.text.slice(0, 4000), source: 'twitch', messageId: event.message_id.slice(0, 200), ...(typeof sentAt === 'string' && Number.isFinite(Date.parse(sentAt)) ? { sentAt } : {}) };
}
function reconnectUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  try { const url = new URL(raw); return url.protocol === 'wss:' && url.hostname === 'eventsub.wss.twitch.tv' && !url.username && !url.password && !url.port ? url.href : null; }
  catch { return null; }
}
interface Connection { ws: TwitchSocket; timer?: number; welcomed: boolean }

/** One EventSub session, guarded reconnect handoff and no duplicate subscriptions on server transfer. */
export function startTwitch(config: TwitchConfig, transport: TwitchTransport, onMessage: (input: TwitchChatInput) => Promise<unknown>, onStatus: (state: TwitchConnectionStatus) => void): () => void {
  let stopped = false; let active: Connection | undefined; let replacement: Connection | undefined;
  let retryTimer: number | undefined; let healthTimer: number | undefined; let attempts = 0; let generation = 0;
  const closing = new WeakSet<TwitchSocket>();
  const clear = (connection?: Connection) => { if (connection?.timer !== undefined) transport.timers.clearTimeout(connection.timer); };
  const close = (connection?: Connection) => { if (!connection) return; clear(connection); closing.add(connection.ws); try { connection.ws.close(); } catch { /* Already closed. */ } };
  const status = (phase: TwitchConnectionStatus['phase'], message: string, transferred?: boolean) => { if (!stopped) onStatus({ phase, message, ...(transferred ? { transferred } : {}) }); };
  function stop() {
    stopped = true; generation++;
    if (retryTimer !== undefined) transport.timers.clearTimeout(retryTimer);
    if (healthTimer !== undefined) transport.timers.clearTimeout(healthTimer);
    close(active); close(replacement); active = undefined; replacement = undefined;
  }
  function fail(error: unknown) {
    if (stopped) return;
    if (error instanceof TwitchError && (error.kind === 'authorization' || error.kind === 'permission')) { status('error', error.message); stop(); }
    else retry();
  }
  function retry() {
    if (stopped || retryTimer !== undefined) return;
    generation++; close(active); close(replacement); active = undefined; replacement = undefined;
    const delay = Math.min(30_000, 1000 * 2 ** Math.min(attempts++, 5)) + Math.floor((transport.random?.() ?? Math.random()) * 250);
    status('reconnecting', 'Twitch connection lost. Reconnecting; messages missed while offline cannot be replayed.');
    retryTimer = transport.timers.setTimeout(() => { retryTimer = undefined; void boot(); }, delay);
  }
  function health() {
    if (stopped) return;
    healthTimer = transport.timers.setTimeout(() => {
      void transport.token().then(health, error => { if (!stopped) { fail(error); if (!stopped) health(); } });
    }, 55 * 60_000);
  }
  function connect(url: string, transferred: boolean, token: string) {
    if (stopped) return;
    let ws: TwitchSocket;
    try { ws = transport.socket(url); } catch { retry(); return; }
    const connection: Connection = { ws, welcomed: false };
    if (transferred) { replacement = connection; clear(active); } else active = connection;
    const current = () => !stopped && !closing.has(ws) && (connection === active || connection === replacement);
    const arm = (delay: number) => {
      clear(connection);
      connection.timer = transport.timers.setTimeout(() => { if (current() && !(connection === active && replacement)) retry(); }, delay);
    };
    arm(10_000);
    ws.onmessage = event => { if (current()) void receive(event.data).catch(fail); };
    ws.onerror = () => { if (!current()) return; if (connection === active && replacement) { close(active); active = undefined; } else retry(); };
    ws.onclose = () => {
      clear(connection);
      if (!current()) return;
      if (connection === active && replacement) { active = undefined; return; }
      retry();
    };
    let keepalive = 30_000;
    async function receive(raw: unknown) {
      if (!current() || typeof raw !== 'string' || raw.length > 256_000) return;
      let parsed: unknown; try { parsed = JSON.parse(raw); } catch { return; }
      const frame = object(parsed); const payload = object(frame.payload); const session = object(payload.session);
      const kind = object(frame.metadata).message_type;
      if (kind === 'session_welcome') {
        if (connection.welcomed) return;
        if (typeof session.id !== 'string' || !session.id) throw new TwitchError('service', 'Twitch sent an invalid welcome message.');
        connection.welcomed = true;
        keepalive = Math.max(10, Math.min(600, typeof session.keepalive_timeout_seconds === 'number' ? session.keepalive_timeout_seconds : 30)) * 1000;
        arm(keepalive + 1500);
        if (!transferred) {
          const subscriptions = transport.subscriptions ?? CHAT_SUBSCRIPTIONS.map(type => ({ type, version: '1', condition: { broadcaster_user_id: config.broadcasterId, user_id: config.botUserId } }));
          for (const subscriptionInput of subscriptions) {
          const response = await transport.request({ url: 'https://api.twitch.tv/helix/eventsub/subscriptions', method: 'POST',
            headers: { Authorization: 'Bearer ' + token, 'Client-Id': config.clientId, 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...subscriptionInput, transport: { method: 'websocket', session_id: session.id } }) });
          assertResponse(response);
          if (!current()) return;
          const subscriptions = object(response.json).data;
          const subscription = object(Array.isArray(subscriptions) ? subscriptions[0] : undefined);
          if (typeof subscription.id !== 'string' || !subscription.id || subscription.status !== 'enabled')
            throw new TwitchError('service', 'Twitch did not confirm the chat subscription.');
          }
        } else { const old = active; active = connection; replacement = undefined; close(old); }
        attempts = 0; status('connected', 'Twitch chat connected', transferred);
      } else if (kind === 'session_keepalive') { if (connection.welcomed) arm(keepalive + 1500); }
      else if (kind === 'notification' && connection.welcomed) {
        arm(keepalive + 1500);
        await transport.onNotification?.(parsed);
        const input = parseTwitchNotification(parsed);
        const condition = object(object(payload.subscription).condition);
        const event = object(payload.event); const type = object(payload.subscription).type;
        if (event.broadcaster_user_id === config.broadcasterId && (!condition.user_id || condition.user_id === config.botUserId) && transport.onRemoval && type !== 'channel.chat.message') {
          const messageId = typeof event.message_id === 'string' && /^[a-z0-9-]{1,200}$/i.test(event.message_id) ? event.message_id : undefined;
          const userId = typeof event.target_user_id === 'string' && /^\d+$/.test(event.target_user_id) ? event.target_user_id : undefined;
          if (type === 'channel.chat.clear' || type === 'channel.chat.message_delete' && messageId || type === 'channel.chat.clear_user_messages' && userId)
            await transport.onRemoval({ channelId: config.broadcasterId, type: type === 'channel.chat.clear' ? 'all' : type === 'channel.chat.message_delete' ? 'message' : 'user', ...(messageId ? { messageId } : {}), ...(userId ? { userId } : {}), ...(typeof object(frame.metadata).message_timestamp === 'string' ? { at: String(object(frame.metadata).message_timestamp) } : {}) }).catch(() => { transport.onIntakeError?.(); throw new TwitchError('service', 'Chat moderation could not be saved. Public chat is paused until the connection recovers.'); });
        }
        if (input && object(payload.event).broadcaster_user_id === config.broadcasterId && (!condition.user_id || condition.user_id === config.botUserId)) {
          if (input.userId === 'twitch:' + config.botUserId) await transport.onOwnMessage?.(input).catch(() => transport.onIntakeError?.());
          else await onMessage(input).catch(() => transport.onIntakeError?.());
        }
      } else if (kind === 'session_reconnect' && connection === active && !replacement) {
        const next = reconnectUrl(session.reconnect_url);
        if (!next) { retry(); return; }
        status('reconnecting', 'Twitch is transferring the chat connection'); connect(next, true, token);
      } else if (kind === 'revocation') { status('error', 'Twitch revoked the chat subscription. Reconnect the chatbot account.'); stop(); }
    }
  }
  async function boot() {
    if (stopped) return;
    const ticket = generation;
    status('connecting', 'Connecting to Twitch chat');
    try { const token = await transport.token(); if (!stopped && ticket === generation) connect(EVENTSUB, false, token); } catch (error) { fail(error); }
  }
  health(); void boot(); return stop;
}
