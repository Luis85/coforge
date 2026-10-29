import { describe, expect, it, vi } from 'vitest';
import { TwitchOperations } from '../../../features/coforge/application/twitch-operations';
import type { TwitchOperationContext, TwitchOperationsPort } from '../../../features/coforge/domain/twitch-operations';
import { StudioStore } from '../../../features/coforge/application/studio-store';
import { IntegrationFailure } from '../../../features/coforge/domain/integration-failure';
import { MemoryStorage } from './memory-storage';
import { parsePersistedStudio } from '../../../features/coforge/domain/persisted';
import { validateTwitchAction } from '../../../features/coforge/domain/twitch-operations-validation';

async function setup() {
  const storage = new MemoryStorage(); const store = new StudioStore(storage); await store.init();
  const context: TwitchOperationContext = { channelId: '123', accountId: '123', clientId: 'client', scopes: ['channel:manage:raids', 'channel:read:ads'] };
  await store.transaction(state => { state.integration.twitchBroadcasterId = '123'; state.integration.twitchClientId = 'client'; });
  const execute = vi.fn<TwitchOperationsPort['execute']>(async () => undefined);
  const read = vi.fn<TwitchOperationsPort['read']>(async () => ({ records: [{ next_ad_at: '2026-10-29T14:00:00Z' }] }));
  const service = new TwitchOperations(store, { execute, read }, () => context);
  return { storage, store, context, execute, read, service };
}

describe('Twitch operations durable review boundary', () => {
  it('persists exact reviewed intent before a single external action and rejects preview replay', async () => {
    const env = await setup();
    env.execute.mockImplementation(async action => {
      expect(env.store.snapshot().twitchOperations?.intents[0]).toMatchObject({ action, channelId: '123', status: 'sending' });
    });
    const preview = env.service.preview({ name: 'raid-start', parameters: { to_broadcaster_id: '456' } });
    await env.service.execute(preview); await expect(env.service.execute(preview)).rejects.toThrow('already');
    expect(env.execute).toHaveBeenCalledTimes(1);
    expect(env.store.snapshot().twitchOperations?.intents[0]?.status).toBe('confirmed');
  });
  it('invalidates previews on channel changes, missing scopes and altered parameters', async () => {
    const env = await setup(); const preview = env.service.preview({ name: 'raid-start', parameters: { to_broadcaster_id: '456' } });
    env.context.channelId = '999'; await expect(env.service.execute(preview)).rejects.toThrow('changed');
    expect(env.execute).not.toHaveBeenCalled(); env.context.channelId = '123'; env.context.scopes = [];
    expect(() => env.service.preview(preview.action)).toThrow('permission');
  });
  it('holds uncertain external outcomes and requires explicit acknowledgement without claiming success', async () => {
    const env = await setup(); env.execute.mockRejectedValueOnce(new IntegrationFailure('uncertain', 'Delivery could not be confirmed.'));
    const preview = env.service.preview({ name: 'raid-start', parameters: { to_broadcaster_id: '456' } });
    await expect(env.service.execute(preview)).rejects.toThrow('confirmed');
    const next = env.service.preview({ name: 'raid-cancel', parameters: {} });
    await expect(env.service.execute(next)).rejects.toThrow('unconfirmed');
    await env.service.reconcile(preview.id, 'I inspected Twitch.');
    expect(env.service.snapshot().intents[0]).toMatchObject({ status: 'uncertain', reviewNote: 'I inspected Twitch.' });
    await env.service.execute(next); expect(env.execute).toHaveBeenCalledTimes(2);
  });
  it('deduplicates current-channel activity and saves acknowledgements and disconnect gaps', async () => {
    const env = await setup(); const activity = { id: 'event-1', channelId: '123', type: 'channel.follow', at: new Date().toISOString(), summary: 'A viewer followed.' };
    await env.service.ingest(activity); await env.service.ingest(activity); await env.service.ingest({ ...activity, id: 'foreign', channelId: '999' });
    await env.service.acknowledgeActivity('event-1'); await env.service.collectionDisconnected('Connection interrupted'); await env.service.collectionConnected();
    expect(env.service.snapshot().activities).toHaveLength(1); expect(env.service.snapshot().activities[0]?.acknowledgedAt).toBeDefined();
    expect(env.service.snapshot().gaps[0]?.endedAt).toBeDefined();
  });
  it('does not mislabel failed reads as empty data and rejects unsolicited action parameters', async () => {
    const env = await setup(); env.read.mockRejectedValueOnce(new Error('sensitive raw provider content'));
    await expect(env.service.refresh('ads')).rejects.toThrow();
    expect(env.service.snapshot().resources.ads).toMatchObject({ status: 'unavailable', error: 'Twitch data could not be refreshed. Try again.' });
    expect(() => env.service.preview({ name: 'raid-start', parameters: { to_broadcaster_id: '456', broadcaster_id: '999' } })).toThrow('not allowed');
  });
  it('does not call Twitch when intent persistence fails and never reuses a tampered review', async () => {
    const env = await setup(); const preview = env.service.preview({ name: 'raid-start', parameters: { to_broadcaster_id: '456' } });
    await expect(env.service.execute({ ...preview, action: { name: 'raid-start', parameters: { to_broadcaster_id: '999' } } })).rejects.toThrow('changed');
    env.storage.failNextSave = true; await expect(env.service.execute(preview)).rejects.toThrow('Disk full');
    expect(env.execute).not.toHaveBeenCalled(); await env.service.execute(preview); expect(env.execute).toHaveBeenCalledTimes(1);
  });
  it('recovers an interrupted durable action as uncertain after reload and preserves unknown recovery status', async () => {
    const env = await setup(); const preview = env.service.preview({ name: 'raid-start', parameters: { to_broadcaster_id: '456' } });
    await env.store.transaction(state => { state.twitchOperations = { activities: [], intents: [{ ...preview, status: 'sending' }], gaps: [], retentionDays: 30 }; });
    const loaded = await env.storage.load(); expect(parsePersistedStudio(loaded.data).twitchOperations?.intents).toHaveLength(1);
    const reloaded = new StudioStore(env.storage); await reloaded.init();
    expect(reloaded.snapshot().twitchOperations?.intents[0]).toMatchObject({ status: 'uncertain' });
    expect(env.execute).not.toHaveBeenCalled();
  });
  it('hides resource caches when permissions are revoked and discards late reads from replaced accounts', async () => {
    const env = await setup(); await env.service.refresh('ads'); expect(env.service.snapshot().resources.ads?.status).toBe('ready');
    env.context.scopes = []; expect(env.service.snapshot().resources.ads).toBeUndefined();
    env.context.scopes = ['channel:read:ads'];
    let complete = (_value: { records: Record<string, unknown>[] }) => {};
    env.read.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
    const read = env.service.refresh('ads'); env.context.channelId = '999'; complete({ records: [{ secretChannelValue: 'not displayed' }] }); await read;
    expect(env.service.snapshot().resources.ads).toBeUndefined();
  });
  it('retains unresolved actions across retention cleanup and saves templates without sending them', async () => {
    const env = await setup(); const action = { name: 'raid-start' as const, parameters: { to_broadcaster_id: '456' } };
    const id = await env.service.saveTemplate('End of show', action);
    expect(env.service.snapshot().templates?.[0]).toMatchObject({ id, action }); expect(env.execute).not.toHaveBeenCalled();
    const preview = env.service.preview(action); await env.store.transaction(state => { state.twitchOperations!.intents.push({ ...preview, createdAt: '2020-01-01T00:00:00Z', status: 'uncertain' }); });
    await env.service.setRetention(1); expect(env.service.snapshot().intents).toHaveLength(1);
    await env.service.removeTemplate(id); expect(env.service.snapshot().templates).toEqual([]);
  });
  it('validates conditional reward limits, poll choices and prediction settlement before review', () => {
    expect(() => validateTwitchAction({ name: 'reward-create', parameters: { title: 'Review', cost: 100, is_global_cooldown_enabled: true } })).toThrow('global_cooldown_seconds');
    expect(() => validateTwitchAction({ name: 'prediction-end', parameters: { id: 'prediction', status: 'RESOLVED' } })).toThrow('winning_outcome_id');
    expect(() => validateTwitchAction({ name: 'poll-create', parameters: { title: 'Next?', choices: ['Only one'], duration: 60 } })).toThrow();
    expect(validateTwitchAction({ name: 'reward-create', parameters: { title: 'Review', cost: 100, is_global_cooldown_enabled: true, global_cooldown_seconds: 60 } }).parameters.global_cooldown_seconds).toBe(60);
  });
  it('drains an in-flight action on unload, rejects queued sends and retains clip acceptance receipts', async () => {
    const env = await setup(); env.context.scopes = [...env.context.scopes, 'clips:edit'];
    let complete = (_value: { records: Record<string, unknown>[] }) => {};
    env.execute.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
    const preview = env.service.preview({ name: 'clip-create', parameters: {} });
    const sending = env.service.execute(preview);
    await vi.waitFor(() => expect(env.execute).toHaveBeenCalledOnce());
    const queued = env.service.execute(env.service.preview({ name: 'raid-cancel', parameters: {} })).catch(error => error);
    let closed = false; const closing = env.service.dispose().then(() => { closed = true; });
    await Promise.resolve(); expect(closed).toBe(false);
    complete({ records: [{ id: 'clip-1', edit_url: 'https://clips.twitch.tv/clip-1/edit' }] });
    await sending; await closing; expect(await queued).toBeInstanceOf(IntegrationFailure); expect(env.execute).toHaveBeenCalledOnce();
    expect(env.store.snapshot().twitchOperations?.intents[0]).toMatchObject({ completion: 'accepted', receipt: { id: 'clip-1' }, status: 'confirmed' });
    expect(() => env.service.subscribe(() => {})).toThrow('closed');
  });
  it('publishes named operation facts only after persistence and isolates failed observers', async () => {
    const env = await setup(); const facts: string[] = [];
    env.store.subscribeEvents(event => { expect(env.store.snapshot().twitchOperations?.intents).toHaveLength(1); facts.push(event.type); throw new Error('observer unavailable'); });
    await env.service.execute(env.service.preview({ name: 'raid-start', parameters: { to_broadcaster_id: '456' } }));
    expect(facts).toEqual(['twitch-operation-requested', 'twitch-operation-confirmed']); expect(env.execute).toHaveBeenCalledOnce();
  });
  it('allows explicit inspection of an old application intent without bypassing another broadcaster', async () => {
    const env = await setup(); env.execute.mockRejectedValueOnce(new IntegrationFailure('uncertain', 'Unconfirmed raid'));
    const preview = env.service.preview({ name: 'raid-start', parameters: { to_broadcaster_id: '456' } });
    await expect(env.service.execute(preview)).rejects.toThrow('Unconfirmed');
    env.context.clientId = 'replacement-client';
    const next = env.service.preview({ name: 'raid-cancel', parameters: {} });
    await expect(env.service.execute(next)).rejects.toThrow('unconfirmed');
    env.context.accountId = '999';
    await expect(env.service.reconcile(preview.id, 'Inspected the original channel.')).rejects.toThrow();
    env.context.accountId = '123';
    await env.service.reconcile(preview.id, 'Inspected the original channel after reconnecting the app.');
    expect(env.service.snapshot().intents[0]).toMatchObject({ clientId: 'client', status: 'uncertain', reviewNote: 'Inspected the original channel after reconnecting the app.' });
    await env.service.execute(next); expect(env.execute).toHaveBeenCalledTimes(2);
  });
  it('updates an already collected moderation queue when resolution events arrive', async () => {
    const env = await setup(); env.context.scopes = ['moderator:manage:automod'];
    const held = { id: 'delivery-held', channelId: '123', type: 'automod.message.hold', at: new Date().toISOString(), summary: 'Held', details: { msg_id: 'message-1', message: 'Review this' } };
    await env.service.ingest(held); await env.service.refresh('automod-queue');
    expect(env.service.snapshot().resources['automod-queue']?.result?.records).toHaveLength(1);
    await env.service.ingest({ ...held, id: 'delivery-reviewed', type: 'automod.message.update', summary: 'Denied', details: { msg_id: 'message-1', status: 'Denied' } });
    expect(env.service.snapshot().resources['automod-queue']?.result?.records).toEqual([]);
    expect(env.read).not.toHaveBeenCalled();
  });
  it('does not label empty account identities as authorized data access', async () => {
    const env = await setup(); env.context.channelId = ''; env.context.accountId = '';
    expect(env.service.snapshot().capabilities.find(item => item.resource === 'chat-settings')?.available).toBe(false);
  });
  it('rechecks action permission after durable intent has been written', async () => {
    const env = await setup(); const save = env.storage.save.bind(env.storage);
    vi.spyOn(env.storage, 'save').mockImplementation(async state => { await save(state); if (state.twitchOperations?.intents.some(intent => intent.status === 'sending')) env.context.scopes = []; });
    const preview = env.service.preview({ name: 'raid-start', parameters: { to_broadcaster_id: '456' } });
    await expect(env.service.execute(preview)).rejects.toThrow('permission');
    expect(env.execute).not.toHaveBeenCalled();
    expect(env.service.snapshot().intents[0]?.status).toBe('failed');
  });
  it('retains the exact selection alongside resource results', async () => {
    const env = await setup(); env.context.scopes = ['channel:read:redemptions'];
    await env.service.refresh('redemptions', { reward_id: 'reward-1', status: 'UNFULFILLED' });
    expect(env.service.snapshot().resources.redemptions?.parameters).toEqual({ reward_id: 'reward-1', status: 'UNFULFILLED' });
  });
  it('accepts opaque Twitch schedule identifiers and rejects incomplete chat mode edits', () => {
    const segment = 'eyJzZWdtZW50SUQiOiJlNGFjYzcyNC0zNzFmLTQwMmMtODFjYS0yM2FkYTc5NzU5ZDQiLCJpc29ZZWFyIjoyMDIxLCJpc29XZWVrIjoyNn0=';
    expect(validateTwitchAction({ name: 'schedule-delete', parameters: { id: segment } }).parameters.id).toBe(segment);
    expect(() => validateTwitchAction({ name: 'chat-settings', parameters: { slow_mode_wait_time: 30 } })).toThrow('slow_mode');
    expect(() => validateTwitchAction({ name: 'chat-settings', parameters: { follower_mode_duration: 15 } })).toThrow('follower_mode');
    expect(() => validateTwitchAction({ name: 'schedule-create', parameters: { title: 'Public title', start_time: '2026-12-01T18:00:00Z', timezone: 'not/a-timezone', duration: 60 } })).toThrow('timezone');
  });
});
