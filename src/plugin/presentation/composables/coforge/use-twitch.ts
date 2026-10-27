import { computed, reactive, ref, watch } from 'vue';
import { disconnectedTwitch, type ModerationAction, type TwitchRole } from '../../../features/coforge/domain/twitch';
import { useCoforge } from '../../context/coforge-context';
import { useStudioStore } from '../../stores/coforge-studio';
import { defaultIntegration } from '../../../features/coforge/domain/seed';

export function useTwitch() {
  const { host, studio } = useCoforge(); const store = useStudioStore();
  const state = computed(() => store.state?.runtime.twitch ?? disconnectedTwitch());
  const error = ref(''); const notice = ref(''); const checking = ref(false);
  const title = ref(''); const categoryId = ref(''); const categoryQuery = ref('');
  const tags = ref(''); const language = ref('');
  const categories = ref<Array<{ id: string; name: string }>>([]);
  const moderation = reactive({ action: 'timeout' as 'delete' | 'timeout' | 'ban', login: '', messageId: '', duration: 600, reason: '' });
  const confirmation = ref<{ channelId: string; text: string; action: ModerationAction } | null>(null);
  const savedConnection = ref(studio.ready ? studio.integration() : defaultIntegration());
  const connection = reactive({ twitchClientId: savedConnection.value.twitchClientId, twitchBotUsesStreamer: savedConnection.value.twitchBotUsesStreamer,
    twitchEnabled: savedConnection.value.twitchEnabled, twitchBotReplies: savedConnection.value.twitchBotReplies });
  watch(() => store.state, () => {
    if (!store.state) return;
    const next = studio.integration();
    if (connection.twitchClientId === savedConnection.value.twitchClientId) connection.twitchClientId = next.twitchClientId;
    for (const key of ['twitchBotUsesStreamer', 'twitchEnabled', 'twitchBotReplies'] as const) if (connection[key] === savedConnection.value[key]) connection[key] = next[key];
    savedConnection.value = next;
  });
  const actions = () => { if (!host.twitch) throw new Error('Twitch authorization is available in Obsidian.'); return host.twitch; };
  watch(() => store.moderationTarget, target => {
    if (!target) return;
    moderation.login = target.username; moderation.messageId = target.messageId ?? ''; moderation.action = target.messageId ? 'delete' : 'timeout'; confirmation.value = null;
  }, { immediate: true });
  watch(() => state.value.channel, (channel, previous) => {
    if (!channel) return;
    if (!previous || channel.id !== previous.id || title.value === previous.title) title.value = channel.title;
    if (!previous || channel.id !== previous.id || categoryId.value === previous.categoryId) categoryId.value = channel.categoryId;
    if (!previous || channel.id !== previous.id || tags.value === (previous.tags ?? []).join(', ')) tags.value = (channel.tags ?? []).join(', ');
    if (!previous || channel.id !== previous.id || language.value === (previous.language ?? '')) language.value = channel.language ?? '';
  }, { immediate: true });
  async function run(work: () => Promise<unknown>, success = ''): Promise<boolean> {
    error.value = ''; notice.value = ''; checking.value = true;
    try { await store.mutate(work); notice.value = success; return true; }
    catch (problem) { error.value = problem instanceof Error ? problem.message : 'Twitch could not complete that action.'; return false; }
    finally { checking.value = false; }
  }
  async function authorize(role: TwitchRole, clientId?: string, usesStreamer?: boolean) {
    await run(async () => {
      if (clientId !== undefined) await studio.updateIntegration({ twitchClientId: clientId.trim(), ...(usesStreamer === undefined ? {} : { twitchBotUsesStreamer: usesStreamer }) });
      await actions().authorize(role);
    });
  }
  async function search() { await run(async () => { categories.value = await actions().searchCategories(categoryQuery.value); }); }
  async function prepareModeration() {
    await run(async () => {
      const channel = state.value.channel;
      if (!channel) throw new Error('Refresh the connected channel before moderating.');
      const target = store.moderationTarget;
      if (target && target.channelId !== channel.id) throw new Error('This message belongs to a previous channel. Select a current message.');
      if (moderation.action === 'delete') {
        if (!moderation.messageId.trim()) throw new Error('Enter the single Twitch message ID to delete.');
        confirmation.value = { channelId: channel.id, text: `Delete message ${moderation.messageId} from ${channel.name}?`, action: { type: 'delete', messageId: moderation.messageId.trim() } };
      } else {
        const user = target?.userId && target.username === moderation.login ? { id: target.userId, login: target.username } : await actions().resolveUser(moderation.login.trim());
        confirmation.value = { channelId: channel.id, text: moderation.action === 'ban' ? `Ban ${user.login} from ${channel.name}?` : `Time out ${user.login} in ${channel.name} for ${moderation.duration} seconds?`,
          action: { type: moderation.action, userId: user.id, duration: moderation.duration, reason: moderation.reason.trim() } };
      }
    });
  }
  async function confirmModeration() {
    const pending = confirmation.value;
    if (!pending) return;
    if (pending.channelId !== state.value.channel?.id) { confirmation.value = null; error.value = 'The channel changed. Review the target again.'; return; }
    if (await run(() => actions().moderate(pending.action), 'Moderation action confirmed by Twitch.')) confirmation.value = null;
  }
  return reactive({
    store, state, connection, supported: Boolean(host.twitch), error, notice, checking, title, categoryId, categoryQuery, categories, moderation, confirmation, tags, language,
    brandingUrl: computed(() => { const login = state.value.channel?.login || state.value.streamer?.login; return login ? `https://dashboard.twitch.tv/u/${encodeURIComponent(login)}/settings/channel/brand` : ''; }),
    openBranding: () => { void studio.openTwitchBranding().catch(() => { error.value = 'The branding editor interaction could not be recorded.'; }); },
    replies: computed(() => (store.state?.botReplies ?? []).filter(reply => ['failed', 'uncertain'].includes(reply.status) && !reply.reviewedAt).slice(-5).reverse()),
    autoReplies: computed(() => store.state ? studio.integration().twitchBotReplies : false),
    authorize: (role: TwitchRole, clientId?: string, usesStreamer?: boolean) => { void authorize(role, clientId, usesStreamer); },
    saveConnection: () => { void run(() => studio.updateIntegration({ ...connection }), 'Twitch connection settings saved.'); },
    cancelAuthorization: () => host.twitch?.cancelAuthorization(),
    reconnect: () => { void run(() => actions().reconnect()); }, refresh: () => { void run(() => actions().refreshChannel()); },
    search: () => { void search(); },
    saveChannel: (event: Event) => { event.preventDefault(); void run(() => actions().updateChannel({ title: title.value, categoryId: categoryId.value, tags: tags.value.split(',').map(tag => tag.trim()).filter(Boolean), language: language.value.trim() || undefined }), 'Channel updated.'); },
    prepareModeration: (event: Event) => { event.preventDefault(); void prepareModeration(); },
    confirmModeration: () => { void confirmModeration(); }, cancelModeration: () => { confirmation.value = null; },
    openStreamMessages: () => { store.streamTool = 'messages'; store.navigate('stream'); },
    retry: (id: string) => { void run(() => actions().retryReply(id)); },
  });
}
