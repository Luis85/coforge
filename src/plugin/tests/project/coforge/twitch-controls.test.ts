// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, disposePinia, type Pinia } from 'pinia';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StudioService } from '../../../features/coforge/application/studio';
import { createDemoRunner } from '../../../features/coforge/application/demo-agent';
import { disconnectedTwitch, type TwitchActions } from '../../../features/coforge/domain/twitch';
import TwitchChannelControls from '../../../presentation/components/coforge/TwitchChannelControls.vue';
import ChatComposer from '../../../presentation/components/coforge/ChatComposer.vue';
import { coforgeKey, type CoforgeContext } from '../../../presentation/context/coforge-context';
import { useStudioStore } from '../../../presentation/stores/coforge-studio';
import { MemoryStorage, nodeTimers } from './memory-storage';

const mounted: Array<{ wrapper: VueWrapper; pinia: Pinia; studio: StudioService }> = [];
afterEach(async () => { for (const { wrapper, pinia, studio } of mounted.splice(0)) { wrapper.unmount(); useStudioStore(pinia).dispose(); disposePinia(pinia); await studio.stop(); } });
async function render(composer = false) {
  const timers = nodeTimers(); const runner = createDemoRunner(timers, [1, 1]);
  const studio = new StudioService(new MemoryStorage(), { timers, runners: { demo: runner, claude: runner }, probeRuntime: async () => ({ cliAvailable: false, projectPath: null, allowImplementation: false }) });
  await studio.start();
  const moderate = vi.fn<TwitchActions['moderate']>(async () => undefined); const send = vi.fn<TwitchActions['send']>(async () => undefined);
  const twitch: TwitchActions = { moderate, send, authorize: async () => undefined, cancelAuthorization: () => undefined, reconnect: async () => undefined,
    refreshChannel: async () => undefined, updateChannel: async () => undefined, searchCategories: async () => [], resolveUser: async login => ({ id: '99', login }), retryReply: async () => undefined };
  const context: CoforgeContext = { studio, startupError: () => null, onNotice: () => () => undefined,
    host: { twitch, setSecret: () => false, hasSecret: () => false, openIdeaNote: async () => true, saveExport: async () => 'export.json',
      publishBoard: async () => ({ folder: 'CoForge/Public', changed: false }), installPagesWorkflow: async () => ({ workflow: '', folder: '', created: false }) } };
  const pinia = createPinia(); const store = useStudioStore(pinia);
  store.state = studio.state();
  store.state.runtime.twitch = { ...disconnectedTwitch(), phase: 'connected', message: 'Twitch chat connected', canChat: true, canManage: true, canModerate: true,
    bot: { id: '456', login: 'actual_bot', scopes: [] }, streamer: { id: '123', login: 'actual_streamer', scopes: [] },
    channel: { id: '123', login: 'actual_streamer', name: 'Actual streamer', title: 'Current stream', categoryId: '42', categoryName: 'Game' } };
  const wrapper = mount(composer ? ChatComposer : TwitchChannelControls, { global: { plugins: [pinia], provide: { [coforgeKey as symbol]: context } } });
  mounted.push({ wrapper, pinia, studio }); await flushPromises();
  return { wrapper, store, moderate, send };
}

describe('Twitch operator controls', () => {
  it('requires review and confirmation before deleting exactly the selected message', async () => {
    const env = await render(); env.store.moderationTarget = { channelId: '123', username: 'Viewer', userId: '99', messageId: 'selected-message' }; await flushPromises();
    await env.wrapper.get('.cf-twitch-moderation form').trigger('submit'); await flushPromises();
    expect(env.moderate).not.toHaveBeenCalled(); expect(env.wrapper.get('[aria-label="Confirm moderation"]').text()).toContain('selected-message');
    await env.wrapper.get('.cf-btn-danger').trigger('click'); await flushPromises();
    expect(env.moderate).toHaveBeenCalledExactlyOnceWith({ type: 'delete', messageId: 'selected-message' });
  });
  it('invalidates a reviewed moderation action when the connected channel changes', async () => {
    const env = await render(); env.store.moderationTarget = { channelId: '123', username: 'Viewer', userId: '99', messageId: 'selected-message' }; await flushPromises();
    await env.wrapper.get('.cf-twitch-moderation form').trigger('submit'); await flushPromises();
    env.store.state!.runtime.twitch!.channel!.id = '987';
    await env.wrapper.get('.cf-btn-danger').trigger('click'); await flushPromises();
    expect(env.moderate).not.toHaveBeenCalled(); expect(env.wrapper.text()).toContain('channel changed');
  });
  it('sends through the real bot action and keeps the draft after a failed send', async () => {
    const env = await render(true); env.send.mockRejectedValueOnce(new Error('Twitch unavailable'));
    await env.wrapper.get('textarea').setValue('Hello channel');
    await env.wrapper.get('form').trigger('submit'); await flushPromises();
    expect(env.send).toHaveBeenCalledExactlyOnceWith('Hello channel');
    expect(env.wrapper.get('textarea').element.value).toBe('Hello channel');
    await env.wrapper.get('form').trigger('submit'); await flushPromises();
    expect(env.wrapper.get('textarea').element.value).toBe('');
  });
});
