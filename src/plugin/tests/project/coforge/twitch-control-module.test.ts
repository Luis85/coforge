// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StudioService } from '../../../features/coforge/application/studio';
import { createDemoRunner } from '../../../features/coforge/application/demo-agent';
import { TwitchModule } from '../../../infrastructure/coforge/twitch-module';
import { BOT_SCOPES, STREAMER_SCOPES } from '../../../infrastructure/coforge/twitch-auth';
import type { HttpRequest, HttpResponse } from '../../../infrastructure/coforge/twitch-http';
import type { TwitchSocket } from '../../../infrastructure/coforge/twitch';
import { MemoryStorage, nodeTimers } from './memory-storage';

class Socket implements TwitchSocket {
  onmessage: ((event: MessageEvent) => unknown) | null = null;
  onclose: ((event: CloseEvent) => unknown) | null = null;
  onerror: ((event: Event) => unknown) | null = null;
  close() { this.onclose?.(new CloseEvent('close')); }
  message(value: unknown) { this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(value) })); }
}
const stops: Array<() => Promise<void>> = [];
afterEach(async () => { for (const stop of stops.splice(0)) await stop(); vi.useRealTimers(); });

async function setup(pollRead?: () => Promise<HttpResponse> | HttpResponse) {
  vi.useFakeTimers(); const timers = nodeTimers(); const runner = createDemoRunner(timers, [1, 1]);
  const storage = new MemoryStorage(); const studio = new StudioService(storage, { timers, runners: { demo: runner, claude: runner }, probeRuntime: async () => ({ cliAvailable: false, projectPath: null, allowImplementation: false }) });
  await studio.start(); await studio.updateIntegration({ twitchEnabled: true, twitchClientId: 'client', twitchBroadcasterId: '123', twitchBotUserId: '123' });
  const requests: Parameters<HttpRequest>[0][] = []; const sockets: Socket[] = [];
  const request: HttpRequest = async input => {
    requests.push(input);
    if (input.url.endsWith('/validate')) return { status: 200, json: { client_id: 'client', user_id: '123', login: 'streamer', scopes: [...BOT_SCOPES, ...STREAMER_SCOPES, 'channel:manage:polls'] } };
    if (input.url.includes('/channels?')) return { status: 200, json: { data: [{ broadcaster_id: '123', broadcaster_login: 'streamer', broadcaster_name: 'Streamer', title: 'Test channel', game_id: '42', game_name: 'Test' }] } };
    if (input.url.includes('/eventsub/subscriptions')) return { status: 202, json: { data: [{ id: 'sub', status: 'enabled' }] } };
    if (input.url.endsWith('/oauth2/device')) return { status: 200, json: { device_code: 'device', user_code: 'ABC', verification_uri: 'https://www.twitch.tv/activate', expires_in: 300, interval: 5 } };
    if (input.url.endsWith('/polls') && input.method === 'POST') return { status: 200, json: { data: [{ id: 'poll-1', broadcaster_id: '123', title: 'Next build?', choices: [], status: 'ACTIVE' }] } };
    if (input.url.includes('/polls?')) return pollRead ? pollRead() : { status: 200, json: { data: [{ id: 'poll-1', broadcaster_id: '123', title: 'Next build?', choices: [], status: 'ACTIVE' }], pagination: {} } };
    throw new Error('Unexpected test request');
  };
  const module = new TwitchModule(studio, { getSecret: () => 'test-token', setSecret: () => undefined }, request, timers, () => { const socket = new Socket(); sockets.push(socket); return socket; });
  const stopConfig = studio.onIntegrationChange(config => module.configure(config));
  stops.push(async () => { stopConfig(); await module.dispose(); await studio.stop(); });
  module.start(); await vi.advanceTimersByTimeAsync(0);
  for (const [index, socket] of sockets.entries()) socket.message({ metadata: { message_type: 'session_welcome' }, payload: { session: { id: `session-${index}`, keepalive_timeout_seconds: 30 } } });
  await vi.advanceTimersByTimeAsync(0);
  return { module, studio, storage, requests, sockets };
}
function pollProgress(env: Awaited<ReturnType<typeof setup>>, id: string): void {
  const subscription = env.requests.find(input => input.url.includes('/eventsub/subscriptions') && JSON.parse(input.body ?? '{}').type === 'channel.poll.progress');
  const session = String(JSON.parse(subscription!.body!).transport.session_id);
  env.sockets[Number(session.replace('session-', ''))]!.message({ metadata: { message_type: 'notification', message_id: id, message_timestamp: '2026-10-29T14:00:00Z' }, payload: { subscription: { type: 'channel.poll.progress', condition: { broadcaster_user_id: '123' } }, event: { broadcaster_user_id: '123', id: 'poll-1', title: 'Next build?' } } });
}

describe('Twitch operations runtime composition', () => {
  it('preserves the newer EventSub stream identity when the sampled live state is still stale', async () => {
    const env = await setup(); const twitch = env.studio.state().runtime.twitch;
    if (!twitch) throw new Error('Expected a connected Twitch fixture');
    await env.studio.store.updateRuntime({ twitch: { ...twitch, tracking: { phase: 'live', message: 'Previous sampled broadcast', streamId: '111' } } });
    const subscription = env.requests.find(input => input.url.includes('/eventsub/subscriptions') && JSON.parse(input.body ?? '{}').type === 'stream.online');
    const session = String(JSON.parse(subscription!.body!).transport.session_id);
    const socket = env.sockets[Number(session.replace('session-', ''))]!;
    const emit = (id: string, type: string, event: Record<string, string>) => socket.message({ metadata: { message_type: 'notification', message_id: id, message_timestamp: new Date().toISOString() }, payload: { subscription: { type, condition: { broadcaster_user_id: '123' } }, event: { broadcaster_user_id: '123', ...event } } });
    emit('new-live', 'stream.online', { id: '222', type: 'live' });
    await vi.advanceTimersByTimeAsync(0);
    emit('new-subscriber', 'channel.subscribe', { user_id: '99', user_name: 'Viewer' });
    await vi.advanceTimersByTimeAsync(0);
    expect(env.module.operations.snapshot().activities.filter(item => ['new-live', 'new-subscriber'].includes(item.id))).toEqual([
      expect.objectContaining({ id: 'new-live', streamId: '222' }),
      expect.objectContaining({ id: 'new-subscriber', streamId: '222' }),
    ]);
  });
  it('persists one reviewed channel-bound poll operation and reads it through the authenticated adapter', async () => {
    const env = await setup();
    const preview = env.module.operations.preview({ name: 'poll-create', parameters: { title: 'Next build?', choices: ['Garden', 'Castle'], duration: 60 } });
    await env.module.operations.execute(preview);
    expect(env.studio.state().twitchOperations?.intents).toEqual([expect.objectContaining({ id: preview.id, channelId: '123', status: 'confirmed' })]);
    const sent = env.requests.filter(input => input.url.endsWith('/polls') && input.method === 'POST');
    expect(sent).toHaveLength(1);
    expect(JSON.parse(sent[0]!.body!)).toMatchObject({ broadcaster_id: '123', title: 'Next build?', choices: [{ title: 'Garden' }, { title: 'Castle' }] });
    await env.module.operations.refresh('polls');
    expect(env.module.operations.snapshot().resources.polls).toMatchObject({ status: 'ready', result: { records: [expect.objectContaining({ id: 'poll-1' })] } });
    await expect(env.module.operations.execute(preview)).rejects.toThrow();
    expect(env.requests.filter(input => input.url.endsWith('/polls') && input.method === 'POST')).toHaveLength(1);
  });

  it('requests the chosen capability while preserving grants without asking for unrelated management permissions', async () => {
    const env = await setup(); await env.module.operations.authorize?.('ad-snooze');
    const prompt = env.requests.find(input => input.url.endsWith('/oauth2/device'));
    expect(prompt).toBeDefined();
    const scopes = new URLSearchParams(prompt!.body).get('scopes')!.split(' ');
    expect(scopes).toEqual(expect.arrayContaining(['channel:manage:ads', 'channel:manage:polls', ...STREAMER_SCOPES]));
    expect(scopes).not.toContain('channel:manage:moderators');
    expect(scopes).not.toContain('channel:manage:predictions');
    expect(env.requests.filter(input => input.url.includes('/helix/') && !input.url.includes('/eventsub/') && input.method !== 'GET')).toEqual([]);
  });
  it('keeps data-access authorization read-only when a resource shares an action name', async () => {
    const env = await setup(); await env.module.operations.authorize?.('resource:shield');
    const prompt = env.requests.find(input => input.url.endsWith('/oauth2/device'));
    const scopes = new URLSearchParams(prompt!.body).get('scopes')!.split(' ');
    expect(scopes).toContain('moderator:read:shield_mode');
    expect(scopes).not.toContain('moderator:manage:shield_mode');
  });
  it('does not add AutoMod management permission just to read blocked terms', async () => {
    const env = await setup(); await env.module.operations.authorize?.('resource:blocked-terms');
    const prompt = env.requests.find(input => input.url.endsWith('/oauth2/device'));
    const scopes = new URLSearchParams(prompt!.body).get('scopes')!.split(' ');
    expect(scopes).toContain('moderator:read:blocked_terms');
    expect(scopes).not.toContain('moderator:manage:automod');
  });
  it('coalesces incoming poll progress into one refresh of the already-selected poll page', async () => {
    const env = await setup(); await env.module.operations.refresh('polls', { id: 'poll-1', after: 'saved-page' });
    const before = env.requests.filter(input => input.url.includes('/polls?')).length;
    pollProgress(env, 'progress-1'); pollProgress(env, 'progress-2'); pollProgress(env, 'progress-3');
    await vi.advanceTimersByTimeAsync(249); expect(env.requests.filter(input => input.url.includes('/polls?'))).toHaveLength(before);
    await vi.advanceTimersByTimeAsync(1); const reads = env.requests.filter(input => input.url.includes('/polls?'));
    expect(reads).toHaveLength(before + 1); expect(new URL(reads.at(-1)!.url).searchParams.get('after')).toBe('saved-page');
    expect(new URL(reads.at(-1)!.url).searchParams.get('id')).toBe('poll-1');
    expect(env.requests.filter(input => input.url.includes('/predictions?'))).toHaveLength(0);
  });
  it('keeps a failed progress refresh unavailable without disconnecting the event collection', async () => {
    let failed = false;
    const env = await setup(() => failed ? { status: 503, json: {} } : { status: 200, json: { data: [], pagination: {} } });
    await env.module.operations.refresh('polls'); failed = true; pollProgress(env, 'progress-error'); await vi.advanceTimersByTimeAsync(250);
    expect(env.module.operations.snapshot().resources.polls?.status).toBe('unavailable');
    expect(env.module.operations.snapshot().gaps.filter(gap => !gap.endedAt)).toHaveLength(0);
  });
  it('cancels scheduled progress refreshes on unload', async () => {
    const env = await setup(); await env.module.operations.refresh('polls'); const before = env.requests.filter(input => input.url.includes('/polls?')).length;
    pollProgress(env, 'progress-unload'); await vi.advanceTimersByTimeAsync(0); await env.module.dispose(); await vi.advanceTimersByTimeAsync(1000);
    expect(env.requests.filter(input => input.url.includes('/polls?'))).toHaveLength(before);
  });
  it('drains an active progress read before finishing unload', async () => {
    let calls = 0; let complete = (_response: HttpResponse) => {};
    const env = await setup(() => ++calls === 1 ? { status: 200, json: { data: [], pagination: {} } } : new Promise(resolve => { complete = resolve; }));
    await env.module.operations.refresh('polls'); pollProgress(env, 'progress-drain'); await vi.advanceTimersByTimeAsync(250);
    expect(calls).toBe(2); let disposed = false; const closing = env.module.dispose().then(() => { disposed = true; });
    await Promise.resolve(); expect(disposed).toBe(false);
    complete({ status: 200, json: { data: [], pagination: {} } }); await closing; expect(disposed).toBe(true);
  });
  it('drops scheduled progress work when the selected channel changes', async () => {
    const env = await setup(); await env.module.operations.refresh('polls'); const before = env.requests.filter(input => input.url.includes('/polls?')).length;
    pollProgress(env, 'progress-switch'); await vi.advanceTimersByTimeAsync(0); await env.studio.updateIntegration({ twitchBroadcasterId: '456' }); await vi.advanceTimersByTimeAsync(250);
    expect(env.requests.filter(input => input.url.includes('/polls?'))).toHaveLength(before);
  });
});
