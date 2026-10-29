// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, disposePinia, type Pinia } from 'pinia';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StudioService } from '../../../features/coforge/application/studio';
import { createDemoRunner } from '../../../features/coforge/application/demo-agent';
import { emptyTwitchOperations, type TwitchActionPreview, type TwitchOperationsActions, type TwitchOperationsSnapshot } from '../../../features/coforge/domain/twitch-operations';
import { TWITCH_ACTIONS } from '../../../features/coforge/domain/twitch-operations-catalogue';
import TwitchOperationsView from '../../../presentation/components/coforge/TwitchOperationsView.vue';
import { coforgeKey, type CoforgeContext } from '../../../presentation/context/coforge-context';
import { useStudioStore } from '../../../presentation/stores/coforge-studio';
import { MemoryStorage, nodeTimers } from './memory-storage';
import { scheduleDraft } from '../../../presentation/stores/coforge-schedule';
import { twitchPublicPlanDraft } from '../../../presentation/composables/coforge/twitch-operations-display';
import { useTwitchOperationsStore } from '../../../presentation/stores/coforge-twitch-operations';

const mounted: Array<{ wrapper: VueWrapper; pinia: Pinia; studio: StudioService }> = [];
afterEach(async () => {
  for (const { wrapper, pinia, studio } of mounted.splice(0)) {
    wrapper.unmount(); useStudioStore(pinia).dispose(); disposePinia(pinia); await studio.stop();
  }
});

async function render(connected = true) {
  const timers = nodeTimers(); const runner = createDemoRunner(timers, [1, 1]);
  const studio = new StudioService(new MemoryStorage(), { timers, runners: { demo: runner, claude: runner }, probeRuntime: async () => ({ cliAvailable: false, projectPath: null, allowImplementation: false }) });
  await studio.start();
  const snapshot: TwitchOperationsSnapshot = { ...emptyTwitchOperations(), resources: {}, capabilities: [] };
  const execute = vi.fn<TwitchOperationsActions['execute']>(async () => 'intent-id');
  const refresh = vi.fn<TwitchOperationsActions['refresh']>(async () => undefined);
  const preview = vi.fn<TwitchOperationsActions['preview']>((action) => ({ id: 'review-1', channelId: '123', accountId: '123', clientId: 'client', action: structuredClone(action), createdAt: new Date().toISOString() }));
  const authorize = vi.fn(async (_feature: string) => undefined);
  const exportJson = vi.fn(async (_json: string) => 'private-export.json');
  let listener: (() => void) | undefined;
  const actions: TwitchOperationsActions = { snapshot: () => snapshot, preview, execute, refresh,
    authorize, report: () => '# Private Twitch activity report\nObserved events only.',
    saveTemplate: async () => 'template-id',
    acknowledgeActivity: async () => undefined, reconcile: async () => undefined, setRetention: async () => undefined,
    subscribe: (callback) => { listener = callback; return () => { listener = undefined; }; } };
  const context: CoforgeContext = { studio, startupError: () => null, onNotice: () => () => undefined,
    host: { ...(connected ? { twitchOperations: actions } : {}), setSecret: () => false, hasSecret: () => false, openIdeaNote: async () => true, saveExport: exportJson,
      publishBoard: async () => ({ folder: 'CoForge/Public', changed: false }), installPagesWorkflow: async () => ({ workflow: '', folder: '', created: false }) } };
  const pinia = createPinia(); const store = useStudioStore(pinia); store.state = studio.state();
  store.state.runtime.twitch = { phase: 'connected', message: 'Connected', canChat: true, canManage: true, canModerate: true, streamer: { id: '123', login: 'streamer', scopes: [...new Set(TWITCH_ACTIONS.flatMap(action => action.scopes))] } };
  const wrapper = mount(TwitchOperationsView, { global: { plugins: [pinia], provide: { [coforgeKey as symbol]: context } } });
  mounted.push({ wrapper, pinia, studio }); await flushPromises();
  return { wrapper, store, application: studio, operationStore: useTwitchOperationsStore(pinia), snapshot, preview, execute, refresh, authorize, exportJson, publish: () => listener?.() };
}

describe('Twitch operations workspace', () => {
  it('opens without issuing an external action and explains unavailable host controls', async () => {
    const env = await render(false);
    expect(env.wrapper.get('h1').text()).toBe('Twitch operations');
    expect(env.wrapper.text()).toContain('available in Obsidian');
    expect(env.wrapper.get('[aria-label="Twitch operation tools"]').text()).toContain('Engagement');
  });

  it('requires a captured review before a mutation and preserves a failed draft', async () => {
    const env = await render();
    await env.wrapper.get('[data-twitch-page="broadcast"]').trigger('click');
    await env.wrapper.get('[aria-label="Action"]').setValue('commercial');
    await env.wrapper.get('[data-twitch-field="length"]').setValue('60');
    await env.wrapper.get('[aria-label="Twitch action editor"]').trigger('submit'); await flushPromises();
    expect(env.execute).not.toHaveBeenCalled();
    const captured: TwitchActionPreview = env.preview.mock.results[0]!.value;
    expect(captured.action).toEqual({ name: 'commercial', parameters: { length: '60' } });
    expect(env.wrapper.get('[aria-label="Review Twitch action"]').text()).toContain('123');
    env.execute.mockRejectedValueOnce(new Error('Twitch did not confirm this action.'));
    await env.wrapper.get('[data-twitch-confirm]').trigger('click'); await flushPromises();
    expect(env.execute).toHaveBeenCalledExactlyOnceWith(captured);
    expect(env.wrapper.get<HTMLSelectElement>('[data-twitch-field="length"]').element.value).toBe('60');
    expect(env.wrapper.text()).toContain('Twitch did not confirm');
  });

  it('shows event provenance and acknowledged state without inventing audience totals', async () => {
    const env = await render();
    env.snapshot.activities.push({ id: 'event-1', channelId: '123', type: 'channel.follow', at: '2026-10-29T12:00:00Z', summary: 'Ada followed', actorName: 'Ada', acknowledgedAt: '2026-10-29T12:01:00Z' });
    env.snapshot.gaps.push({ channelId: '123', startedAt: '2026-10-29T11:00:00Z', reason: 'Disconnected' });
    env.publish(); await flushPromises();
    expect(env.wrapper.text()).toContain('Ada followed');
    expect(env.wrapper.text()).toContain('Acknowledged');
    expect(env.wrapper.text()).toContain('collection gap');
    expect(env.refresh).not.toHaveBeenCalled();
  });

  it('invalidates a reviewed action when the draft changes', async () => {
    const env = await render();
    await env.wrapper.get('[data-twitch-page="broadcast"]').trigger('click');
    await env.wrapper.get('[aria-label="Action"]').setValue('commercial');
    await env.wrapper.get('[aria-label="Twitch action editor"]').trigger('submit'); await flushPromises();
    expect(env.wrapper.find('[aria-label="Review Twitch action"]').exists()).toBe(true);
    await env.wrapper.get('[data-twitch-field="length"]').setValue('90'); await flushPromises();
    expect(env.wrapper.find('[aria-label="Review Twitch action"]').exists()).toBe(false);
    expect(env.execute).not.toHaveBeenCalled();
  });

  it('requests only the selected action capability when its write scope is missing', async () => {
    const env = await render();
    env.store.state!.runtime.twitch!.streamer!.scopes = [];
    await env.wrapper.get('[data-twitch-page="broadcast"]').trigger('click');
    await env.wrapper.get('[aria-label="Action"]').setValue('commercial');
    const authorize = env.wrapper.findAll('button').find(button => button.text() === 'Authorize this action')!;
    await authorize.trigger('click'); await flushPromises();
    expect(env.authorize).toHaveBeenCalledExactlyOnceWith('action:commercial');
    expect(env.execute).not.toHaveBeenCalled();
  });

  it('exports a private report with explicit coverage and no Twitch mutation', async () => {
    const env = await render();
    await env.wrapper.get('[data-twitch-page="content"]').trigger('click');
    const exportButton = env.wrapper.findAll('button').find(button => button.text() === 'Export private report')!;
    await exportButton.trigger('click'); await flushPromises();
    expect(env.exportJson).toHaveBeenCalledOnce();
    expect(JSON.parse(env.exportJson.mock.calls[0]![0])).toMatchObject({ schema: 'coforge-private-twitch-report/v1', report: '# Private Twitch activity report\nObserved events only.', recordedStream: null });
    expect(env.execute).not.toHaveBeenCalled();
  });

  it('keeps reward limits in a disclosure while retaining them in the reviewed draft', async () => {
    const env = await render();
    await env.wrapper.get('[data-twitch-page="engagement"]').trigger('click');
    await env.wrapper.get('[data-twitch-field="title"]').setValue('Community spotlight');
    await env.wrapper.get('[data-twitch-field="cost"]').setValue('500');
    const advanced = env.wrapper.get<HTMLDetailsElement>('[aria-label="Limits and redemption options"]');
    expect(advanced.element.open).toBe(false);
    expect(advanced.find('[data-twitch-field="global_cooldown_seconds"]').exists()).toBe(true);
    expect(advanced.find('[data-twitch-field="title"]').exists()).toBe(false);
    advanced.element.open = true;
    await env.wrapper.get('[data-twitch-field="is_global_cooldown_enabled"]').setValue('true');
    await env.wrapper.get('[data-twitch-field="global_cooldown_seconds"]').setValue('45');
    await env.wrapper.get('[aria-label="Twitch action editor"]').trigger('submit'); await flushPromises();
    expect(env.preview.mock.calls[0]![0]).toEqual({ name: 'reward-create', parameters: { title: 'Community spotlight', cost: 500, is_global_cooldown_enabled: true, global_cooldown_seconds: 45 } });
    expect(env.execute).not.toHaveBeenCalled();
  });
  it('maps an observed held message into the exact moderation target', async () => {
    const env = await render();
    env.snapshot.resources['automod-queue'] = { status: 'ready', result: { records: [{ id: 'event-delivery', msg_id: 'held-message-42', message: 'Held text' }] } }; env.publish();
    await env.wrapper.get('[data-twitch-page="moderation"]').trigger('click');
    await env.wrapper.get('[aria-label="Twitch dataset"]').setValue('automod-queue');
    await env.wrapper.get('[aria-label="Action"]').setValue('automod-resolve');
    await env.wrapper.findAll('button').find(button => button.text() === 'Use record in action')!.trigger('click');
    expect(env.wrapper.get<HTMLInputElement>('[data-twitch-field="msg_id"]').element.value).toBe('held-message-42');
    expect(env.execute).not.toHaveBeenCalled();
  });
  it('keeps redemption ownership and an explicit valid outcome when using a record', async () => {
    const env = await render();
    env.snapshot.resources.redemptions = { status: 'ready', parameters: { reward_id: 'reward-42', status: 'UNFULFILLED' }, result: { records: [{ id: 'redemption-42', reward: { id: 'reward-42' }, status: 'UNFULFILLED' }] } }; env.publish();
    await env.wrapper.get('[data-twitch-page="engagement"]').trigger('click');
    await env.wrapper.get('[aria-label="Twitch dataset"]').setValue('redemptions');
    await env.wrapper.get('input[list="cf-twitch-reward-options"]').setValue('reward-42');
    await env.wrapper.get('[aria-label="Action"]').setValue('redemption-update');
    await env.wrapper.findAll('button').find(button => button.text() === 'Use record in action')!.trigger('click');
    expect(env.wrapper.get<HTMLInputElement>('[data-twitch-field="reward_id"]').element.value).toBe('reward-42');
    expect(env.wrapper.get<HTMLInputElement>('[data-twitch-field="id"]').element.value).toBe('redemption-42');
    expect(env.wrapper.get<HTMLSelectElement>('[data-twitch-field="status"]').element.value).toBe('FULFILLED');
    await env.wrapper.get('input[list="cf-twitch-reward-options"]').setValue('another-reward');
    expect(env.wrapper.findAll('button').some(button => button.text() === 'Use record in action')).toBe(false);
  });
  it('distinguishes data consent from action consent for shared capability names', async () => {
    const env = await render(); env.store.state!.runtime.twitch!.streamer!.scopes = [];
    await env.wrapper.get('[data-twitch-page="moderation"]').trigger('click');
    await env.wrapper.get('[aria-label="Twitch dataset"]').setValue('automod-settings');
    await env.wrapper.findAll('button').find(button => button.text() === 'Authorize data access')!.trigger('click'); await flushPromises();
    expect(env.authorize).toHaveBeenCalledExactlyOnceWith('resource:automod-settings');
  });
  it('keeps private plan names and project configuration out of public schedule drafts', () => {
    const plan = { ...scheduleDraft(), name: 'Private sponsor negotiation', projectId: 'CFP-SECRET', liveSceneId: 'private-scene', title: '', startsAt: '2026-12-01T18:00:00Z', timezone: 'Europe/Berlin' };
    const draft = twitchPublicPlanDraft(plan);
    expect(draft.title).toBe('');
    expect(JSON.stringify(draft)).not.toMatch(/Private sponsor|CFP-SECRET|private-scene/);
    expect(twitchPublicPlanDraft({ ...plan, title: 'Public build stream' }).title).toBe('Public build stream');
  });
  it('loads saved raid templates into the broadcast task without sending them', async () => {
    const env = await render();
    env.snapshot.templates = [{ id: 'raid-template', name: 'Aftershow raid', action: { name: 'raid-start', parameters: { to_broadcaster_id: '789' } }, updatedAt: new Date().toISOString() }]; env.publish(); await flushPromises();
    await env.wrapper.findAll('select').find(select => select.find('option[value="raid-template"]').exists())!.setValue('raid-template');
    await env.wrapper.findAll('button').find(button => button.text() === 'Load into draft')!.trigger('click');
    expect(env.wrapper.get('[data-twitch-page="broadcast"]').attributes('aria-current')).toBe('page');
    expect(env.wrapper.get<HTMLInputElement>('[data-twitch-field="to_broadcaster_id"]').element.value).toBe('789');
    expect(env.execute).not.toHaveBeenCalled();
  });
  it('requires a recent raid target preview bound to this channel before reviewing the raid', async () => {
    const env = await render();
    await env.wrapper.get('[data-twitch-page="broadcast"]').trigger('click');
    await env.wrapper.get('[aria-label="Action"]').setValue('raid-start');
    await env.wrapper.get('[data-twitch-field="to_broadcaster_id"]').setValue('789');
    const form = env.wrapper.get('[aria-label="Twitch action editor"]');
    await form.trigger('submit'); expect(env.preview).not.toHaveBeenCalled();
    expect(env.wrapper.text()).toContain('Preview the current raid target');
    env.operationStore.raidTarget = { id: '789', login: 'destination', name: 'Destination', title: 'Live build', categoryId: '42', categoryName: 'Game development', isLive: true, viewers: 100, checkedAt: new Date().toISOString() };
    env.operationStore.raidPreviewContext = 'another-account';
    await form.trigger('submit'); expect(env.preview).not.toHaveBeenCalled();
    const connection = env.application.integration();
    env.operationStore.raidPreviewContext = JSON.stringify([connection.twitchClientId, connection.twitchBroadcasterId, '123']);
    env.operationStore.raidTarget.checkedAt = new Date(Date.now() - 31_000).toISOString();
    await form.trigger('submit'); expect(env.preview).not.toHaveBeenCalled();
    env.operationStore.raidTarget.checkedAt = new Date().toISOString();
    await form.trigger('submit'); expect(env.preview).toHaveBeenCalledOnce();
    expect(env.execute).not.toHaveBeenCalled();
  });
});
