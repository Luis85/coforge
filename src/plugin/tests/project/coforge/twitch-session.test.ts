// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { startTwitch, type TwitchSocket } from '../../../infrastructure/coforge/twitch';
import { nodeTimers } from './memory-storage';
import type { ChatRemoval } from '../../../features/coforge/domain/chat-removal';

class Socket implements TwitchSocket {
  onmessage: ((event: MessageEvent) => unknown) | null = null;
  onclose: ((event: CloseEvent) => unknown) | null = null;
  onerror: ((event: Event) => unknown) | null = null;
  closed = false;
  close() { this.closed = true; this.onclose?.(new CloseEvent('close')); }
  message(value: unknown) { this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(value) })); }
}
const stops: Array<() => void> = [];
afterEach(() => { for (const stop of stops.splice(0)) stop(); vi.useRealTimers(); });
async function setup(confirmed = true) {
  vi.useFakeTimers();
  const sockets: Socket[] = []; const received: string[] = []; const statuses: string[] = []; let subscriptions = 0;
  const bodies: string[] = []; const removals: ChatRemoval[] = [];
  const stop = startTwitch({ clientId: 'client', broadcasterId: '123', botUserId: '456' }, {
    timers: nodeTimers(), random: () => 0, token: () => Promise.resolve('test-token'),
    request: async request => { subscriptions++; bodies.push(request.body ?? ''); return { status: 202, json: { data: confirmed ? [{ id: 'subscription-1', status: 'enabled' }] : [] } }; },
    onRemoval: async removal => { removals.push(removal); },
    socket: () => { const ws = new Socket(); sockets.push(ws); return ws; },
  }, message => { received.push(message.messageId); return Promise.resolve(); }, state => { statuses.push(state.phase); });
  stops.push(stop); await vi.advanceTimersByTimeAsync(0);
  return { sockets, received, statuses, stop, bodies, removals, subscriptions: () => subscriptions };
}
const welcome = { metadata: { message_type: 'session_welcome' }, payload: { session: { id: 'session-1', keepalive_timeout_seconds: 30 } } };
const message = (user = '99', channel = '123') => ({ metadata: { message_type: 'notification' }, payload: {
  subscription: { type: 'channel.chat.message', condition: { user_id: '456' } }, event: { broadcaster_user_id: channel, chatter_user_id: user,
    chatter_user_name: 'Viewer', message_id: 'message-1', message: { text: '!bug CFP-001 The gate crashes' } },
} });

describe('EventSub session lifecycle', () => {
  it('subscribes to all moderation removals and routes only the configured channel', async () => {
    const env = await setup(); const ws = env.sockets[0]!; ws.message(welcome); await vi.advanceTimersByTimeAsync(0);
    for (const type of ['channel.chat.message', 'channel.chat.message_delete', 'channel.chat.clear_user_messages', 'channel.chat.clear']) expect(env.bodies.some(body => body.includes(`"type":"${type}"`))).toBe(true);
    for (const channel of ['123', 'other']) for (const type of ['channel.chat.message_delete', 'channel.chat.clear_user_messages', 'channel.chat.clear'])
      ws.message({ metadata: { message_type: 'notification', message_timestamp: '2026-10-27T10:00:00Z' }, payload: { subscription: { type }, event: { broadcaster_user_id: channel, target_user_id: '99', message_id: 'deleted-message' } } });
    await vi.advanceTimersByTimeAsync(0); expect(env.removals.map(removal => removal.type)).toEqual(['message', 'user', 'all']); expect(env.removals.every(removal => removal.channelId === '123')).toBe(true);
  });
  it('ignores malformed, wrong-channel and own-bot messages without reconnecting', async () => {
    const env = await setup(); const ws = env.sockets[0]!;
    ws.message(welcome); await vi.advanceTimersByTimeAsync(0);
    for (const value of [null, [], 42, { metadata: null }, message('456'), message('99', '999')]) ws.message(value);
    ws.message(message()); await vi.advanceTimersByTimeAsync(0);
    expect(env.received).toEqual(['message-1']); expect(env.sockets).toHaveLength(1); expect(env.subscriptions()).toBe(4);
  });
  it('transfers the subscription even if the old socket closes before replacement welcome', async () => {
    const env = await setup(); const first = env.sockets[0]!;
    first.message(welcome); await vi.advanceTimersByTimeAsync(0);
    first.message({ metadata: { message_type: 'session_reconnect' }, payload: { session: { reconnect_url: 'wss://eventsub.wss.twitch.tv/ws?reconnect=valid' } } });
    const next = env.sockets[1]!; first.close(); next.message(welcome); await vi.advanceTimersByTimeAsync(0);
    expect(env.subscriptions()).toBe(4); expect(next.closed).toBe(false); expect(env.statuses.at(-1)).toBe('connected');
  });
  it('rejects a reconnect address outside Twitch and stops all retry work on unload', async () => {
    const env = await setup(); env.sockets[0]!.message(welcome); await vi.advanceTimersByTimeAsync(0);
    env.sockets[0]!.message({ metadata: { message_type: 'session_reconnect' }, payload: { session: { reconnect_url: 'wss://evil.example/ws' } } });
    env.stop(); await vi.advanceTimersByTimeAsync(120_000);
    expect(env.sockets).toHaveLength(1); expect(env.sockets[0]?.closed).toBe(true);
  });
  it('reconnects a genuinely lost session and creates a new subscription', async () => {
    const env = await setup(); env.sockets[0]!.message(welcome); await vi.advanceTimersByTimeAsync(0);
    env.sockets[0]!.close(); await vi.advanceTimersByTimeAsync(1000);
    env.sockets[1]!.message(welcome); await vi.advanceTimersByTimeAsync(0);
    expect(env.subscriptions()).toBe(8);
  });
  it('does not claim to be connected without a confirmed subscription', async () => {
    const env = await setup(false); env.sockets[0]!.message(welcome); await vi.advanceTimersByTimeAsync(0);
    expect(env.statuses).not.toContain('connected'); expect(env.statuses.at(-1)).toBe('reconnecting');
  });
  it('stops on revocation instead of repeatedly reconnecting with revoked access', async () => {
    const env = await setup(); env.sockets[0]!.message(welcome); await vi.advanceTimersByTimeAsync(0);
    env.sockets[0]!.message({ metadata: { message_type: 'revocation' }, payload: {} }); await vi.advanceTimersByTimeAsync(60_000);
    expect(env.statuses.at(-1)).toBe('error'); expect(env.sockets).toHaveLength(1); expect(env.sockets[0]!.closed).toBe(true);
  });
});
