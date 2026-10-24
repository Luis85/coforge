/** Receive-only Twitch EventSub transport. Credentials never reach the views. Ported from the prototype's server/twitch.ts. */
export interface TwitchChatInput { username: string; userId: string; text: string; source: 'twitch'; messageId: string }
export interface TwitchConfig { clientId: string; token: string; botUserId: string; broadcasterId: string }
export interface HttpResponse { status: number; json: unknown }
/** Obsidian's `requestUrl` in production: it is not subject to browser CORS rules. */
export type HttpRequest = (request: { url: string; method?: string; headers: Record<string, string>; body?: string }) => Promise<HttpResponse>;
interface Transport { request: HttpRequest; socket: (url: string) => WebSocket }
type Frame = { metadata?: { message_type?: unknown }; payload?: { subscription?: { type?: unknown }; session?: Record<string, unknown>; event?: Record<string, unknown> } };

const EVENTSUB = 'wss://eventsub.wss.twitch.tv/ws';

export function parseTwitchNotification(value: unknown): TwitchChatInput | null {
  if (!value || typeof value !== 'object') return null;
  const frame = value as Frame;
  if (frame.metadata?.message_type !== 'notification' || frame.payload?.subscription?.type !== 'channel.chat.message') return null;
  const event = frame.payload.event;
  const message = event?.message as { text?: unknown } | undefined;
  if (!event || !/^\d+$/.test(String(event.chatter_user_id ?? '')) || typeof event.chatter_user_name !== 'string'
    || typeof message?.text !== 'string' || typeof event.message_id !== 'string') return null;
  return {
    userId: `twitch:${String(event.chatter_user_id)}`, username: event.chatter_user_name.slice(0, 80),
    text: message.text.slice(0, 4000), source: 'twitch', messageId: event.message_id.slice(0, 200),
  };
}

function reconnectUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'wss:' && url.hostname === 'eventsub.wss.twitch.tv' && !url.username && !url.password ? raw : null;
  } catch { return null; }
}

/** Starts asynchronously and returns a stop function. Token refresh stays a host operation. */
export function startTwitch(config: TwitchConfig, transport: Transport, onMessage: (message: TwitchChatInput) => Promise<unknown>, onStatus: (status: string) => void): () => void {
  const { clientId, token, botUserId, broadcasterId } = config;
  let stopped = false; let socket: WebSocket | undefined; let replacement: WebSocket | undefined;
  let retryTimer: number | undefined; let validationTimer: number | undefined; let attempts = 0;
  const closing = new WeakSet<WebSocket>(); const timers = new Map<WebSocket, number>();

  function close(ws: WebSocket) {
    closing.add(ws);
    const timer = timers.get(ws); if (timer) window.clearTimeout(timer); timers.delete(ws);
    try { ws.close(); } catch { /* Already closed. */ }
  }
  function stop() {
    stopped = true;
    if (retryTimer) window.clearTimeout(retryTimer);
    if (validationTimer) window.clearTimeout(validationTimer);
    for (const timer of timers.values()) window.clearTimeout(timer);
    timers.clear();
    if (socket) close(socket);
    if (replacement) close(replacement);
  }
  async function validateToken(): Promise<boolean> {
    const response = await transport.request({ url: 'https://id.twitch.tv/oauth2/validate', headers: { Authorization: `OAuth ${token}` } });
    if (stopped) return false;
    if (response.status === 401) { onStatus('Twitch token expired or revoked. Update the token secret and reconnect.'); stop(); return false; }
    if (response.status < 200 || response.status >= 300) throw new Error('Twitch token validation is temporarily unavailable.');
    const value = (response.json ?? {}) as { client_id?: string; user_id?: string; scopes?: string[] };
    if (value.client_id !== clientId || value.user_id !== botUserId || !value.scopes?.includes('user:read:chat')) {
      onStatus('Twitch configuration mismatch. Use a user token for the bot and Client ID with user:read:chat.'); stop(); return false;
    }
    scheduleValidation(55 * 60_000);
    return true;
  }
  function scheduleValidation(delay: number) {
    if (stopped) return;
    if (validationTimer) window.clearTimeout(validationTimer);
    validationTimer = window.setTimeout(() => {
      void validateToken().catch(() => { if (!stopped) { onStatus('Twitch token revalidation temporarily unavailable · retrying'); scheduleValidation(60_000); } });
    }, delay);
  }
  function retry() {
    if (stopped || retryTimer) return;
    if (socket) close(socket);
    if (replacement) close(replacement);
    socket = undefined; replacement = undefined;
    const wait = Math.min(30_000, 1000 * 2 ** Math.min(attempts++, 5));
    onStatus(`Twitch disconnected · reconnecting in ${Math.ceil(wait / 1000)}s`);
    retryTimer = window.setTimeout(() => { retryTimer = undefined; void boot(); }, wait);
  }
  async function subscribe(sessionId: string): Promise<boolean> {
    const response = await transport.request({
      url: 'https://api.twitch.tv/helix/eventsub/subscriptions', method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Client-Id': clientId, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'channel.chat.message', version: '1', condition: { broadcaster_user_id: broadcasterId, user_id: botUserId }, transport: { method: 'websocket', session_id: sessionId } }),
    });
    if (stopped) return false;
    if (response.status === 401 || response.status === 403) { onStatus('Twitch authorization rejected. Check the user token, chat scope and channel permissions; then reconnect.'); stop(); return false; }
    if (response.status < 200 || response.status >= 300) throw new Error('Twitch subscription failed.');
    return true;
  }
  function connect(url: string, transfersSubscription: boolean) {
    if (stopped) return;
    const previous = socket;
    let ws: WebSocket;
    try { ws = transport.socket(url); } catch { retry(); return; }
    if (transfersSubscription) replacement = ws; else socket = ws;
    let keepaliveMs = 15_000;
    const armKeepalive = () => {
      const old = timers.get(ws); if (old) window.clearTimeout(old);
      timers.set(ws, window.setTimeout(() => { if (!stopped && !closing.has(ws)) retry(); }, keepaliveMs + 1500));
    };
    armKeepalive();
    ws.addEventListener('message', event => { void receive(event).catch(() => { if (!stopped) retry(); }); });
    ws.addEventListener('close', () => {
      const timer = timers.get(ws); if (timer) window.clearTimeout(timer); timers.delete(ws);
      if (!stopped && !closing.has(ws)) retry();
    });
    ws.addEventListener('error', () => { if (!stopped && !closing.has(ws)) retry(); });
    async function receive(event: MessageEvent) {
      if (stopped || closing.has(ws) || typeof event.data !== 'string' || event.data.length > 256_000) return;
      let frame: Frame;
      try { frame = JSON.parse(event.data) as Frame; } catch { return; }
      const kind = frame.metadata?.message_type;
      if (kind === 'session_welcome') {
        const session = frame.payload?.session;
        if (typeof session?.id !== 'string') throw new Error('Missing session id.');
        keepaliveMs = Math.max(10, Math.min(600, Number(session.keepalive_timeout_seconds) || 10)) * 1000;
        armKeepalive();
        if (!transfersSubscription) { if (!(await subscribe(session.id))) return; }
        else { socket = ws; replacement = undefined; if (previous && previous !== ws) close(previous); }
        attempts = 0;
        onStatus('Twitch connected · receiving chat');
      } else if (kind === 'session_keepalive') armKeepalive();
      else if (kind === 'notification') {
        armKeepalive();
        const message = parseTwitchNotification(frame);
        if (message && String(frame.payload?.event?.broadcaster_user_id) === broadcasterId)
          await onMessage(message).catch(() => onStatus('Twitch connected · one chat event was rejected by intake'));
      } else if (kind === 'session_reconnect') {
        const next = reconnectUrl(frame.payload?.session?.reconnect_url);
        if (!next) { retry(); return; }
        if (replacement) return;
        onStatus('Twitch moving to a new connection');
        connect(next, true);
      } else if (kind === 'revocation') { onStatus('Twitch chat subscription revoked. Reauthorize the bot and reconnect.'); stop(); }
    }
  }
  async function boot() {
    if (stopped) return;
    onStatus('Connecting to Twitch');
    try { if ((await validateToken()) && !stopped) connect(EVENTSUB, false); } catch { retry(); }
  }
  void boot();
  return stop;
}
