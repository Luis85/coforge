// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TwitchModule } from '../../../infrastructure/coforge/twitch-module';
import type { TwitchSocket } from '../../../infrastructure/coforge/twitch';
import type { HttpRequest } from '../../../infrastructure/coforge/twitch-http';
import { BOT_SCOPES, STREAMER_SCOPES } from '../../../infrastructure/coforge/twitch-auth';
import { StudioService } from '../../../features/coforge/application/studio';
import { createDemoRunner } from '../../../features/coforge/application/demo-agent';
import { MemoryStorage, nodeTimers, registerTestViewers } from './memory-storage';

class Socket implements TwitchSocket {
  onmessage: ((event: MessageEvent) => unknown) | null = null;
  onclose: ((event: CloseEvent) => unknown) | null = null;
  onerror: ((event: Event) => unknown) | null = null;
  close() { this.onclose?.(new CloseEvent('close')); }
  message(value: unknown) { this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(value) })); }
}
const stops: Array<() => Promise<void>> = [];
afterEach(async () => { for (const stop of stops.splice(0)) await stop(); vi.useRealTimers(); });
async function setup(replies = true) {
  vi.useFakeTimers(); const timers = nodeTimers(); const runner = createDemoRunner(timers, [1, 1]); const storage = new MemoryStorage();
  const studio = new StudioService(storage, { timers, runners: { demo: runner, claude: runner }, probeRuntime: async () => ({ cliAvailable: false, projectPath: null, allowImplementation: false }) });
  await studio.start();
  await registerTestViewers(studio.store, [{ username: 'Viewer', userId: '99', source: 'twitch' }]); await studio.createProject({ projectName: 'Moon', projectBrief: 'Moon garden', projectPath: '/synthetic/moon' });
  await studio.updateIntegration({ twitchEnabled: true, twitchClientId: 'client', twitchBroadcasterId: '123', twitchBotUserId: '123', twitchBotReplies: replies });
  const sockets: Socket[] = []; const sent: unknown[] = [];
  const request: HttpRequest = async input => {
    if (input.url.endsWith('/validate')) return { status: 200, json: { client_id: 'client', user_id: '123', login: 'streamer', scopes: [...BOT_SCOPES, ...STREAMER_SCOPES] } };
    if (input.url.includes('/channels?')) return { status: 200, json: { data: [{ broadcaster_id: '123', broadcaster_login: 'streamer', broadcaster_name: 'Streamer', title: 'Moon garden', game_id: '42', game_name: 'Game' }] } };
    if (input.url.endsWith('/subscriptions')) return { status: 202, json: { data: [{ id: 'subscription', status: 'enabled' }] } };
    if (input.url.endsWith('/chat/messages')) { sent.push(JSON.parse(input.body ?? '{}')); return { status: 200, json: { data: [{ is_sent: true, message_id: 'confirmed' }] } }; }
    throw new Error('Unexpected HTTP call');
  };
  const module = new TwitchModule(studio, { getSecret: () => 'test-token', setSecret: () => undefined }, request, timers, () => { const socket = new Socket(); sockets.push(socket); return socket; });
  const unsubscribe = studio.onIntegrationChange(config => module.configure(config));
  stops.push(async () => { unsubscribe(); await module.dispose(); await studio.stop(); });
  module.start(); await vi.advanceTimersByTimeAsync(0);
  sockets[0]!.message({ metadata: { message_type: 'session_welcome' }, payload: { session: { id: 'session', keepalive_timeout_seconds: 30 } } });
  await vi.advanceTimersByTimeAsync(0);
  const command = { metadata: { message_type: 'notification' }, payload: { subscription: { type: 'channel.chat.message', condition: { user_id: '123' } },
    event: { broadcaster_user_id: '123', chatter_user_id: '99', chatter_user_name: 'Viewer', message_id: 'viewer-message', message: { text: '!bug CFP-001 The lunar gate crashes' } } } };
  return { studio, storage, sockets, sent, command };
}

describe('Twitch milestone integration', () => {
  it('saves one project-parented bug and sends one reply to the original message despite redelivery', async () => {
    const env = await setup(); env.sockets[0]!.message(env.command); env.sockets[0]!.message(env.command); await vi.advanceTimersByTimeAsync(0);
    expect(env.studio.state().ideas).toHaveLength(1);
    expect((await env.storage.load()).notes[0]).toMatchObject({ projectId: 'CFP-001', requestKind: 'bug' });
    expect(env.sent).toEqual([expect.objectContaining({ broadcaster_id: '123', sender_id: '123', reply_parent_message_id: 'viewer-message', message: expect.stringContaining('CF-101') })]);
    expect(env.studio.state().botReplies?.[0]?.status).toBe('sent');
    expect(env.studio.state().runtime.twitch).toMatchObject({ phase: 'connected', channel: { login: 'streamer' } });
    // Chat and broadcaster operations use separate scoped EventSub sessions.
    expect(env.sockets).toHaveLength(2);
    await env.studio.createProject({ projectName: 'Forest', projectBrief: 'Forest garden', projectPath: '/synthetic/forest' });
    expect(env.sockets).toHaveLength(2);
  });
  it('keeps replies local until public chatbot replies are explicitly enabled', async () => {
    const env = await setup(false); env.sockets[0]!.message(env.command); await vi.advanceTimersByTimeAsync(0);
    expect(env.studio.state().ideas).toHaveLength(1); expect(env.sent).toHaveLength(0); expect(env.studio.state().botReplies).toHaveLength(0);
  });
});
