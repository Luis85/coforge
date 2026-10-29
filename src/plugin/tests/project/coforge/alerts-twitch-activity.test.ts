// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import { TwitchOperations } from '../../../features/coforge/application/twitch-operations';
import { StudioService } from '../../../features/coforge/application/studio';
import type { TwitchActivity, TwitchOperationContext } from '../../../features/coforge/domain/twitch-operations';
import type { AlertTemplate } from '../../../features/coforge/domain/alerts';
import { createSeed } from '../../../features/coforge/domain/seed';
import { recordOperation } from '../../../features/coforge/application/population';
import { alertsModule } from '../../../infrastructure/coforge/alerts-module';
import { parseTwitchActivity } from '../../../infrastructure/coforge/twitch-operations-events';
import { MemoryStorage, nodeTimers } from './memory-storage';
import { alertVaultFixture } from './alert-vault-fixture';
import { alertStream } from './alert-http-fixture';
import { welcomeAlert } from './alert-test-fixture';

function notification(id: string, type: string, event: Record<string, unknown>, condition: Record<string, string> = { broadcaster_user_id: '123' }): TwitchActivity {
  const activity = parseTwitchActivity({ metadata: { message_type: 'notification', message_id: id, message_timestamp: new Date().toISOString() },
    payload: { subscription: { type, condition }, event } }, '123');
  if (!activity) throw new Error(`Invalid EventSub fixture: ${type}`);
  return activity;
}
async function fixture() {
  const f = alertVaultFixture(); const storage = new MemoryStorage(createSeed());
  const studio = new StudioService(storage, { timers: nodeTimers(), runners: { demo: async () => ({}), claude: async () => ({}) },
    probeRuntime: async () => ({ cliAvailable: false, projectPath: null, allowImplementation: false }) });
  await studio.start();
  await studio.store.transaction(state => { state.integration.twitchEnabled = true; state.integration.twitchBroadcasterId = '123'; state.integration.twitchClientId = 'test-client'; });
  const context: TwitchOperationContext = { channelId: '123', accountId: '123', clientId: 'test-client', scopes: [] };
  const operations = new TwitchOperations(studio.store, { read: async () => ({ records: [] }), execute: async () => {} }, () => context); operations.start();
  const module = alertsModule(f.plugin, studio); await module.start();
  await module.actions.save({ ...welcomeAlert, id: 'marker', name: 'Manual marker', text: '{{marker}}', event: '', enabled: false });
  const source = await alertStream(module.actions.snapshot().url);
  await expect.poll(() => module.actions.snapshot().sources).toBe(1);
  return { ...f, studio, storage, operations, context, module, source,
    bind: (id: string, event: AlertTemplate['event'], text: string) => module.actions.save({ ...welcomeAlert, id, name: id, event, text, enabled: true }),
    async marker(text: string) { await module.actions.fire('marker', { marker: text }); expect(JSON.parse(await source.event('cue'))).toMatchObject({ text }); },
    async dispose() { await source.close(); await module.dispose(); await operations.dispose(); await studio.stop(); },
  };
}

it('ALERTS-08 carries real committed EventSub activity into curated viewer alerts using only public event variables', async () => {
  const f = await fixture();
  try {
    const channel = { broadcaster_user_id: '123' };
    const cases: Array<{ id: string; binding: AlertTemplate['event']; text: string; expected: string; activity: TwitchActivity }> = [
      { id: 'follow', binding: 'channel.follow', text: 'Follow {{viewer}}', expected: 'Follow Follower', activity: notification('follow-1', 'channel.follow', { ...channel, user_id: '7001', user_name: 'Follower' }) },
      { id: 'subscribe', binding: 'channel.subscribe', text: 'Sub {{viewer}}', expected: 'Sub Subscriber', activity: notification('subscribe-1', 'channel.subscribe', { ...channel, user_id: '7002', user_name: 'Subscriber', tier: '1000', is_gift: false }) },
      { id: 'gift', binding: 'channel.subscription.gift', text: 'Gift {{viewer}} {{amount}}', expected: 'Gift Gifter 3', activity: notification('gift-1', 'channel.subscription.gift', { ...channel, user_id: '7003', user_name: 'Gifter', total: 3, is_anonymous: false }) },
      { id: 'resub', binding: 'channel.subscription.message', text: 'Resub {{viewer}}', expected: 'Resub Returning viewer', activity: notification('resub-1', 'channel.subscription.message', { ...channel, user_id: '7004', user_name: 'Returning viewer', message: { text: 'PRIVATE_RESUB_TEXT' } }) },
      { id: 'cheer', binding: 'channel.cheer', text: 'Cheer {{viewer}} {{amount}} {{count}}', expected: 'Cheer Cheer viewer 25 1', activity: notification('cheer-1', 'channel.cheer', { ...channel, user_id: '7005', user_name: 'Cheer viewer', is_anonymous: false, bits: 25, text: 'PRIVATE_CHEER_TEXT' }) },
      { id: 'incoming', binding: 'channel.raid.incoming', text: 'Incoming {{viewer}} {{amount}}', expected: 'Incoming Raid source 42', activity: notification('raid-in-1', 'channel.raid', { from_broadcaster_user_id: '7006', from_broadcaster_user_name: 'Raid source', to_broadcaster_user_id: '123', viewers: 42 }, { to_broadcaster_user_id: '123' }) },
      { id: 'outgoing', binding: 'channel.raid.outgoing', text: 'Outgoing {{viewer}} {{amount}}', expected: 'Outgoing Raid destination 12', activity: notification('raid-out-1', 'channel.raid', { from_broadcaster_user_id: '123', to_broadcaster_user_id: '7007', to_broadcaster_user_name: 'Raid destination', viewers: 12 }, { from_broadcaster_user_id: '123' }) },
      { id: 'redemption', binding: 'channel.channel_points_custom_reward_redemption.add', text: 'Redeemed {{viewer}} {{reward}}', expected: 'Redeemed Redeemer Sing a song', activity: notification('redemption-1', 'channel.channel_points_custom_reward_redemption.add', { ...channel, id: 'PRIVATE_REDEMPTION_ID', user_id: '7008', user_name: 'Redeemer', user_input: 'PRIVATE_TYPED_INPUT', reward: { id: 'PRIVATE_REWARD_ID', title: 'Sing a song', cost: 500 } }) },
      { id: 'online', binding: 'stream.online', text: 'Channel online', expected: 'Channel online', activity: notification('online-1', 'stream.online', { ...channel, id: 'PRIVATE_STREAM_ID' }) },
      { id: 'offline', binding: 'stream.offline', text: 'Channel offline', expected: 'Channel offline', activity: notification('offline-1', 'stream.offline', channel) },
    ];
    for (const item of cases) await f.bind(item.id, item.binding, item.text);
    expect(cases.find(item => item.id === 'incoming')?.activity.details?.raid_direction).toBe('incoming');
    const outgoing = cases.find(item => item.id === 'outgoing'); expect(outgoing?.activity.details?.raid_direction).toBe('outgoing');
    if (outgoing) outgoing.activity.summary = 'Incoming raid forged summary';
    for (const item of cases) {
      await f.operations.ingest(item.activity);
      const frame = await f.source.event('cue'); expect(JSON.parse(frame)).toMatchObject({ text: item.expected });
      expect(frame).not.toContain('PRIVATE_');
      for (const forbidden of ['actorId', 'channelId', 'summary', 'details', 'streamId', 'user_input', '7001', '7008']) expect(frame).not.toContain(forbidden);
    }
    await f.operations.ingest(cases[0]!.activity); await f.marker('Duplicate activity was not replayed');
    expect(f.studio.state().twitchOperations?.activities.some(item => item.details?.user_input === 'PRIVATE_TYPED_INPUT')).toBe(true);
  } finally { await f.dispose(); }
});

it('suppresses uncommitted, moderation, old, wrong-channel and privately linked activity instead of replaying raw records', async () => {
  const f = await fixture();
  try {
    await f.bind('follow', 'channel.follow', 'Follow {{viewer}}');
    const follow = notification('failed-follow', 'channel.follow', { broadcaster_user_id: '123', user_id: '7009', user_name: 'Follower' });
    f.storage.failNextSave = true; await expect(f.operations.ingest(follow)).rejects.toThrow();
    await f.operations.ingest({ ...follow, id: 'old-follow', at: new Date(Date.now() - 600_000).toISOString() });
    await f.operations.ingest({ ...follow, id: 'foreign-input', channelId: '999' });
    f.context.channelId = '999'; await f.operations.ingest({ ...follow, id: 'foreign-observed', channelId: '999' }); f.context.channelId = '123';
    await f.operations.ingest(notification('held-message', 'automod.message.hold', { broadcaster_user_id: '123', user_id: '7010', user_name: 'Private moderation target', message_id: 'PRIVATE_MESSAGE_ID', message: { text: 'PRIVATE_MODERATION_TEXT' } }));
    await f.operations.ingest({ ...follow, id: 'future-follow', at: new Date(Date.now() + 60_000).toISOString() });
    await f.operations.collectionDisconnected('Recorded collection gap');
    await f.operations.ingest({ ...follow, id: 'gap-follow', at: new Date().toISOString() });
    await f.operations.collectionConnected();
    const privateProject = await f.studio.createProject({ projectName: 'Private Alert Project', projectBrief: 'Private linked activity fixture.', projectPath: '/synthetic/private-alert', visibility: 'private' });
    await f.studio.store.transaction(state => {
      if (!state.twitchOperations) throw new Error('Missing operations state');
      const activity = { ...follow, id: 'private-linked', at: new Date().toISOString(), linkedProjectId: privateProject.id };
      state.twitchOperations.activities.push(activity); recordOperation(state, 'twitch-activity-observed', 'committed', undefined, 1, activity.id);
    });
    expect(await f.source.event('clear')).toBe('{}');
    await f.marker('No rejected activity was published');
    expect(f.studio.state().twitchOperations?.activities.some(item => item.id === 'failed-follow')).toBe(false);
  } finally { await f.dispose(); }
});

it('omits anonymous actor identities and does not replay retained EventSub activity after module reload', async () => {
  const f = await fixture(); let reloaded: ReturnType<typeof alertsModule> | undefined; let nextSource: Awaited<ReturnType<typeof alertStream>> | undefined;
  try {
    await f.bind('anonymous-cheer', 'channel.cheer', 'Anonymous cheer {{amount}}');
    await f.operations.ingest(notification('anonymous-cheer-1', 'channel.cheer', { broadcaster_user_id: '123', user_id: 'PRIVATE_ACTOR_ID', user_name: 'PRIVATE_ACTOR_NAME', is_anonymous: true, bits: 10 }));
    const frame = await f.source.event('cue'); expect(JSON.parse(frame)).toMatchObject({ text: 'Anonymous cheer 10' }); expect(frame).not.toContain('PRIVATE_');
    await f.operations.ingest(notification('unknown-anonymity', 'channel.cheer', { broadcaster_user_id: '123', user_id: '7011', user_name: 'PRIVATE_UNVERIFIED_NAME', bits: 12 }));
    const unknown = await f.source.event('cue'); expect(JSON.parse(unknown)).toMatchObject({ text: 'Anonymous cheer 12' }); expect(unknown).not.toContain('PRIVATE_');
    const url = f.module.actions.snapshot().url; await f.source.close(); await f.module.dispose();
    reloaded = alertsModule(f.plugin, f.studio); await reloaded.start(); expect(reloaded.actions.snapshot().url).toBe(url);
    nextSource = await alertStream(url); await expect.poll(() => reloaded?.actions.snapshot().sources).toBe(1);
    await reloaded.actions.fire('marker', { marker: 'Reload receives future activity only' });
    expect(JSON.parse(await nextSource.event('cue'))).toMatchObject({ text: 'Reload receives future activity only' });
  } finally { await nextSource?.close(); await reloaded?.dispose(); await f.dispose(); }
});

it('rejects ambiguous self-raid direction rather than choosing a viewer-facing incoming or outgoing alert', () => {
  const frame = { metadata: { message_type: 'notification', message_id: 'ambiguous-raid', message_timestamp: new Date().toISOString() },
    payload: { subscription: { type: 'channel.raid', condition: { from_broadcaster_user_id: '123', to_broadcaster_user_id: '123' } },
      event: { from_broadcaster_user_id: '123', to_broadcaster_user_id: '123', from_broadcaster_user_name: 'Own channel', to_broadcaster_user_name: 'Own channel', viewers: 5 } } };
  expect(parseTwitchActivity(frame, '123')).toBeNull();
});
