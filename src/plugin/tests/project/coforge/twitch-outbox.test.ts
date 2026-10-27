import { afterEach, describe, expect, it, vi } from 'vitest';
import { BotDeliveryWorker } from '../../../features/coforge/application/bot-delivery';
import { TwitchAccounts, BOT_SCOPES } from '../../../infrastructure/coforge/twitch-auth';
import { TwitchApi } from '../../../infrastructure/coforge/twitch-api';
import { TwitchError, type HttpRequest } from '../../../infrastructure/coforge/twitch-http';
import { StudioService } from '../../../features/coforge/application/studio';
import { StudioStore } from '../../../features/coforge/application/studio-store';
import { createDemoRunner } from '../../../features/coforge/application/demo-agent';
import { defaultIntegration } from '../../../features/coforge/domain/seed';
import { MemoryStorage, nodeTimers } from './memory-storage';

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => { for (const stop of cleanup.splice(0)) await stop(); vi.useRealTimers(); });
async function setup(send: () => Promise<{ status: number; json: unknown }>) {
  vi.useFakeTimers();
  const timers = nodeTimers(); const runner = createDemoRunner(timers, [1, 1]); const storage = new MemoryStorage();
  const studio = new StudioService(storage, { timers, runners: { demo: runner, claude: runner }, probeRuntime: async () => ({ cliAvailable: false, projectPath: null, allowImplementation: false }) });
  await studio.start();
  await studio.store.transaction(state => { state.botReplies.push({ id: 'reply-1', parentMessageId: 'viewer-1', channelId: '123', senderId: '123', text: 'Saved CF-001', createdAt: new Date().toISOString(), status: 'pending' }); });
  const config = { ...defaultIntegration(), twitchClientId: 'client', twitchBroadcasterId: '123' };
  const request: HttpRequest = async input => input.url.endsWith('/validate')
    ? { status: 200, json: { client_id: 'client', user_id: '123', login: 'streamer', scopes: BOT_SCOPES } } : send();
  const accounts = new TwitchAccounts(request, { getSecret: () => 'test-token', setSecret: () => undefined }, () => config);
  const api = new TwitchApi(request, accounts, () => config); const reports = vi.fn();
  const outbox = new BotDeliveryWorker(studio, api, () => true, () => ({ id: '123', login: 'streamer', scopes: BOT_SCOPES }), reports, timers);
  cleanup.push(async () => { await outbox.stop(); await studio.stop(); });
  return { outbox, studio, storage, reports };
}
const confirmed = { status: 200, json: { data: [{ is_sent: true, message_id: 'sent-1' }] } };

describe('durable Twitch reply delivery', () => {
  it('commits sending intent before HTTP and records success only after Twitch confirms it', async () => {
    let intent = ''; const env = await setup(async () => { intent = (await env.storage.load()).data?.botReplies?.[0]?.status ?? ''; return confirmed; });
    env.outbox.wake(); await vi.advanceTimersByTimeAsync(0);
    expect(intent).toBe('sending');
    expect(env.studio.state().botReplies?.[0]).toMatchObject({ status: 'sent', messageId: 'sent-1' });
    expect(env.studio.state().chat[0]).toMatchObject({ externalId: 'sent-1', twitchChannelId: '123', text: 'Saved CF-001' });
  });
  it('holds an ambiguous send across reconnect and restart instead of replaying it', async () => {
    const send = vi.fn(async () => { throw new TwitchError('uncertain', 'No confirmation'); }); const env = await setup(send);
    env.outbox.wake(); await vi.advanceTimersByTimeAsync(0); env.outbox.resume(); await vi.advanceTimersByTimeAsync(5000);
    expect(send).toHaveBeenCalledOnce(); expect(env.studio.state().chat).toHaveLength(0);
    expect(env.studio.state().botReplies?.[0]?.status).toBe('uncertain');
    await expect(env.outbox.retry('reply-1')).rejects.toThrow('confirmed failed');
    await env.studio.store.transaction(state => { state.botReplies[0]!.status = 'sending'; });
    const restarted = new StudioStore(env.storage); await restarted.init();
    expect(restarted.snapshot().botReplies?.[0]?.status).toBe('uncertain');
  });
  it('backs off on rate limiting, then sends exactly one confirmed reply', async () => {
    let attempts = 0; const env = await setup(async () => ++attempts === 1 ? { status: 429, json: {} } : confirmed);
    env.outbox.wake(); await vi.advanceTimersByTimeAsync(9999); expect(attempts).toBe(1);
    await vi.advanceTimersByTimeAsync(1); expect(attempts).toBe(2);
    expect(env.studio.state().botReplies?.[0]?.status).toBe('sent'); expect(env.studio.state().chat).toHaveLength(1);
  });
  it('does not send when the intent cannot be persisted', async () => {
    const send = vi.fn(async () => confirmed); const env = await setup(send); env.storage.failNextSave = true;
    env.outbox.wake(); await vi.advanceTimersByTimeAsync(0);
    expect(send).not.toHaveBeenCalled(); expect(env.reports).toHaveBeenCalledOnce();
    expect(env.studio.state().botReplies?.[0]?.status).toBe('pending');
  });
});
