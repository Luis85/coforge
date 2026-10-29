// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { operationsEventScopes, operationsEventSubscriptions, parseTwitchActivity, startTwitchOperationsEvents } from '../../../infrastructure/coforge/twitch-operations-events';
import type { TwitchSocket } from '../../../infrastructure/coforge/twitch';
import type { TwitchActivity } from '../../../features/coforge/domain/twitch-operations';
import { nodeTimers } from './memory-storage';

class Socket implements TwitchSocket {
  onmessage: ((event: MessageEvent) => unknown) | null = null;
  onclose: ((event: CloseEvent) => unknown) | null = null;
  onerror: ((event: Event) => unknown) | null = null;
  close() { this.onclose?.(new CloseEvent('close')); }
  message(value: unknown) { this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(value) })); }
}
const stops: Array<() => void> = [];
afterEach(() => { stops.splice(0).forEach(stop => { stop(); }); vi.useRealTimers(); });
const notification = (type: string, event: Record<string, unknown>, condition: Record<string, string> = { broadcaster_user_id: '123' }) => ({ metadata: { message_id: 'event-1', message_type: 'notification', message_timestamp: '2026-10-29T17:00:00Z' }, payload: { subscription: { type, condition }, event } });

describe('Twitch operations EventSub projection and permissions', () => {
  it('subscribes only to explicitly selected resources and granted event scopes', () => {
    const basic = operationsEventSubscriptions(['activity'], [], '123');
    expect(basic.map(item => item.type)).toContain('stream.online');
    expect(basic.map(item => item.type)).not.toContain('channel.subscribe');
    const rewards = operationsEventSubscriptions(['redemptions'], ['channel:manage:redemptions'], '123');
    expect(rewards.map(item => item.type)).toContain('channel.channel_points_custom_reward_redemption.add');
    expect(rewards.map(item => item.type)).not.toContain('stream.online');
    expect(operationsEventScopes('activity')).toContain('channel:read:subscriptions');
    expect(operationsEventScopes('activity')).not.toContain('channel:manage:predictions');
  });
  it('uses Twitch follow v2 and correctly binds moderator and incoming raid conditions', () => {
    const subscriptions = operationsEventSubscriptions(['activity'], ['moderator:read:followers'], '123');
    expect(subscriptions.find(item => item.type === 'channel.follow')).toMatchObject({ version: '2', condition: { broadcaster_user_id: '123', moderator_user_id: '123' } });
    expect(subscriptions.find(item => item.type === 'channel.raid')).toMatchObject({ condition: { to_broadcaster_user_id: '123' } });
  });
  it('rejects wrong channels, malformed timestamps, missing delivery IDs and unsusbcribed types', () => {
    const event = { broadcaster_user_id: '123', user_id: '99', user_name: 'Viewer' };
    expect(parseTwitchActivity(notification('channel.follow', { ...event, broadcaster_user_id: '456' }), '123')).toBeNull();
    const invalid = notification('channel.follow', event); invalid.metadata.message_timestamp = 'yesterday';
    expect(parseTwitchActivity(invalid, '123')).toBeNull();
    const missingId = notification('channel.follow', event); missingId.metadata.message_id = '';
    expect(parseTwitchActivity(missingId, '123')).toBeNull();
    expect(parseTwitchActivity(notification('unknown.event', event), '123')).toBeNull();
  });
  it('preserves actionable redemption and AutoMod identifiers without retaining raw payloads', () => {
    const redemption = parseTwitchActivity(notification('channel.channel_points_custom_reward_redemption.add', { broadcaster_user_id: '123', id: 'redemption-1', user_id: '99', user_name: 'Viewer', user_input: 'Review CF-123', reward: { id: 'reward-1', title: 'Review idea', cost: 500 }, unwanted: 'not retained' }), '123');
    expect(redemption?.details).toMatchObject({ redemption_id: 'redemption-1', reward_id: 'reward-1', user_input: 'Review CF-123' });
    expect(redemption?.details).not.toHaveProperty('unwanted');
    const held = parseTwitchActivity(notification('automod.message.hold', { broadcaster_user_id: '123', message_id: 'held-1', user_id: '99', message: { text: 'Held message' } }), '123');
    expect(held?.details).toMatchObject({ msg_id: 'held-1', message: 'Held message' });
  });
  it('identifies incoming raids without treating the source channel as our channel', () => {
    const raid = parseTwitchActivity(notification('channel.raid', { from_broadcaster_user_id: '99', from_broadcaster_user_name: 'Raider', to_broadcaster_user_id: '123', viewers: 42 }, { to_broadcaster_user_id: '123' }), '123');
    expect(raid).toMatchObject({ channelId: '123', actorId: '99', actorName: 'Raider', amount: 42 });
    const outgoing = parseTwitchActivity(notification('channel.raid', { from_broadcaster_user_id: '123', to_broadcaster_user_id: '98', to_broadcaster_user_name: 'Destination', viewers: 20 }, { from_broadcaster_user_id: '123' }), '123');
    expect(outgoing).toMatchObject({ actorId: '98', amount: 20 }); expect(outgoing?.summary).toContain('Outgoing raid');
  });
  it('uses the guarded session lifecycle and does not route out-of-scope event types', async () => {
    vi.useFakeTimers(); const sockets: Socket[] = []; const received: TwitchActivity[] = []; const requests: string[] = []; const statuses: string[] = [];
    const stop = startTwitchOperationsEvents({ clientId: 'client', broadcasterId: '123', resources: ['activity'], scopes: ['moderator:read:followers'] }, {
      timers: nodeTimers(), token: () => Promise.resolve('token'), socket: () => { const socket = new Socket(); sockets.push(socket); return socket; },
      request: request => { requests.push(request.body ?? ''); return Promise.resolve({ status: 202, json: { data: [{ id: 'subscription', status: 'enabled' }] } }); },
    }, event => { received.push(event); return Promise.resolve(); }, status => { statuses.push(status.phase); }); stops.push(stop);
    await vi.advanceTimersByTimeAsync(0);
    sockets[0]!.message({ metadata: { message_type: 'session_welcome' }, payload: { session: { id: 'session-1', keepalive_timeout_seconds: 30 } } });
    await vi.advanceTimersByTimeAsync(0);
    sockets[0]!.message(notification('channel.follow', { broadcaster_user_id: '123', user_id: '99', user_name: 'Viewer' }));
    sockets[0]!.message(notification('channel.subscribe', { broadcaster_user_id: '123', user_id: '99', user_name: 'Viewer' }));
    await vi.advanceTimersByTimeAsync(0);
    expect(received.map(event => event.type)).toEqual(['channel.follow']);
    expect(requests.every(body => !body.includes('channel.chat.message'))).toBe(true);
    expect(statuses.at(-1)).toBe('connected');
    const online = notification('stream.online', { broadcaster_user_id: '123', id: 'stream-42' }); online.metadata.message_id = 'online';
    sockets[0]!.message(online);
    await vi.advanceTimersByTimeAsync(0);
    const liveFollow = notification('channel.follow', { broadcaster_user_id: '123', user_id: '99' }); liveFollow.metadata.message_id = 'live-follow';
    sockets[0]!.message(liveFollow);
    await vi.advanceTimersByTimeAsync(0);
    expect(received.at(-1)?.streamId).toBe('stream-42');
    const offline = notification('stream.offline', { broadcaster_user_id: '123' }); offline.metadata.message_id = 'offline';
    sockets[0]!.message(offline);
    await vi.advanceTimersByTimeAsync(0);
    expect(received.at(-1)?.streamId).toBe('stream-42');
    sockets[0]!.message(liveFollow);
    await vi.advanceTimersByTimeAsync(0);
    expect(received.at(-1)?.streamId).toBeUndefined();
  });
});
