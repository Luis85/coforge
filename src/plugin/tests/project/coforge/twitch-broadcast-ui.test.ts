// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, disposePinia, type Pinia } from 'pinia';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StudioService } from '../../../features/coforge/application/studio';
import { createDemoRunner } from '../../../features/coforge/application/demo-agent';
import { emptyTwitchOperations, type TwitchOperationsActions, type TwitchOperationsSnapshot, type TwitchRaidTarget } from '../../../features/coforge/domain/twitch-operations';
import { TWITCH_ACTIONS } from '../../../features/coforge/domain/twitch-operations-catalogue';
import TwitchOperationsView from '../../../presentation/components/coforge/TwitchOperationsView.vue';
import { coforgeKey, type CoforgeContext } from '../../../presentation/context/coforge-context';
import { useStudioStore } from '../../../presentation/stores/coforge-studio';
import { MemoryStorage, nodeTimers } from './memory-storage';

const mounted: Array<{ wrapper: VueWrapper; pinia: Pinia; studio: StudioService }> = [];
afterEach(async () => {
  for (const { wrapper, pinia, studio } of mounted.splice(0)) { wrapper.unmount(); useStudioStore(pinia).dispose(); disposePinia(pinia); await studio.stop(); }
  vi.useRealTimers();
});
const target = (id: string): TwitchRaidTarget => ({ id, login: `streamer_${id}`, name: `Streamer ${id}`, title: 'Building a community game', categoryId: '42', categoryName: 'Software development', isLive: true, viewers: 12, checkedAt: new Date().toISOString() });

async function render() {
  const timers = nodeTimers(); const runner = createDemoRunner(timers, [1, 1]);
  const studio = new StudioService(new MemoryStorage(), { timers, runners: { demo: runner, claude: runner }, probeRuntime: async () => ({ cliAvailable: false, projectPath: null, allowImplementation: false }) });
  await studio.start(); await studio.updateIntegration({ twitchClientId: 'client', twitchBroadcasterId: '123' });
  const snapshot: TwitchOperationsSnapshot = { ...emptyTwitchOperations(), resources: {}, capabilities: [] };
  const execute = vi.fn<TwitchOperationsActions['execute']>(async () => 'intent-id');
  const previewRaid = vi.fn(async (id: string) => target(id));
  const actions: TwitchOperationsActions = { snapshot: () => snapshot, preview: action => ({ id: 'review', channelId: '123', accountId: '123', clientId: 'client', action, createdAt: new Date().toISOString() }), execute, previewRaid,
    refresh: async () => undefined, acknowledgeActivity: async () => undefined, reconcile: async () => undefined, setRetention: async () => undefined, subscribe: () => () => {} };
  const context: CoforgeContext = { studio, startupError: () => null, onNotice: () => () => undefined, host: { twitchOperations: actions,
    setSecret: () => false, hasSecret: () => false, openIdeaNote: async () => true, saveExport: async () => 'private.json', publishBoard: async () => ({ folder: 'CoForge/Public', changed: false }), installPagesWorkflow: async () => ({ workflow: '', folder: '', created: false }) } };
  const pinia = createPinia(); const store = useStudioStore(pinia); store.state = studio.state();
  store.state.runtime.twitch = { phase: 'connected', message: 'Connected', canChat: true, canManage: true, canModerate: true, streamer: { id: '123', login: 'owner', scopes: [...new Set(TWITCH_ACTIONS.flatMap(action => action.scopes))] } };
  const wrapper = mount(TwitchOperationsView, { global: { plugins: [pinia], provide: { [coforgeKey as symbol]: context } } });
  mounted.push({ wrapper, pinia, studio }); await flushPromises();
  return { wrapper, snapshot, previewRaid, execute };
}

describe('Twitch break timing and raid preparation', () => {
  it('counts down fresh ad timing, marks old snapshots stale and disposes its clock', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] }); vi.setSystemTime('2026-10-29T12:00:00Z');
    const env = await render(); const baseline = vi.getTimerCount();
    env.snapshot.capabilities.push({ resource: 'ads', label: 'Ad schedule', available: true, missingScopes: [] });
    env.snapshot.resources.ads = { status: 'ready', checkedAt: new Date().toISOString(), result: { records: [{ next_ad_at: '2026-10-29T12:02:00Z', duration: 60, snooze_count: 2, preroll_free_time: 120 }] } };
    await env.wrapper.get('[data-twitch-page="broadcast"]').trigger('click');
    expect(env.wrapper.get('[data-twitch-ad-countdown]').text()).toBe('02:00');
    await vi.advanceTimersByTimeAsync(2000);
    expect(env.wrapper.get('[data-twitch-ad-countdown]').text()).toBe('01:58');
    await vi.advanceTimersByTimeAsync(59_000);
    expect(env.wrapper.get('[aria-label="Ad break timing"]').text()).toContain('Schedule is stale');
    await env.wrapper.get('[data-twitch-page="activity"]').trigger('click');
    expect(vi.getTimerCount()).toBe(baseline);
    expect(env.execute).not.toHaveBeenCalled();
  });

  it('uses named raid templates as a shortlist and previews without starting a raid', async () => {
    const env = await render();
    env.snapshot.templates = [{ id: 'friend', name: 'Coding friend', action: { name: 'raid-start', parameters: { to_broadcaster_id: '456' } }, updatedAt: new Date().toISOString() }];
    await env.wrapper.get('[data-twitch-page="broadcast"]').trigger('click');
    await env.wrapper.get('[aria-label="Raid shortlist"]').setValue('friend');
    expect(env.previewRaid).not.toHaveBeenCalled();
    await env.wrapper.get('[data-twitch-raid-preview]').trigger('click'); await flushPromises();
    expect(env.previewRaid).toHaveBeenCalledExactlyOnceWith('456');
    expect(env.wrapper.get('[aria-label="Raid target preview"]').text()).toContain('Streamer 456');
    await env.wrapper.get('[data-twitch-raid-prepare]').trigger('click'); await flushPromises();
    expect(env.wrapper.get<HTMLSelectElement>('[aria-label="Action"]').element.value).toBe('raid-start');
    expect(env.execute).not.toHaveBeenCalled();
  });

  it('discards a late target response after the target changes', async () => {
    const env = await render(); let finish: ((value: TwitchRaidTarget) => void) | undefined;
    env.previewRaid.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    await env.wrapper.get('[data-twitch-page="broadcast"]').trigger('click');
    await env.wrapper.get('[aria-label="Raid target channel ID"]').setValue('456');
    await env.wrapper.get('[data-twitch-raid-preview]').trigger('click');
    await env.wrapper.get('[aria-label="Raid target channel ID"]').setValue('789');
    finish?.(target('456')); await flushPromises();
    expect(env.wrapper.find('[aria-label="Raid target preview"]').exists()).toBe(false);
    expect(env.execute).not.toHaveBeenCalled();
  });
});
