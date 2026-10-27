import { computed, reactive, ref } from 'vue';
import type { ChatMessage, Contributor } from '../../../features/coforge/domain/types';
import { useStudioStore } from '../../stores/coforge-studio';
import { avatarStyle, initials } from './format';
import { useChatAutoScroll } from './use-chat-scroll';
import { useStudioActions } from './use-studio-actions';

const BOT_ID = 'system:coforge';
const SOURCE_LABELS: Record<ChatMessage['source'], string> = { twitch: 'Twitch', api: 'Bridge', simulator: 'Demo' };

/** One chat line, fully derived for display. */
export interface ChatMessageView {
  id: string; bot: boolean; error: boolean; command: boolean; author: string; initials: string; text: string;
  source: string; time: string; dateTime: string; ideaId: string | undefined;
  avatar: Record<string, string>; nameStyle: Record<string, string> | undefined;
  userId?: string; externalId?: string; channelId?: string;
}

function messageView(message: ChatMessage, contributors: readonly Contributor[]): ChatMessageView {
  const bot = message.userId === BOT_ID;
  const color = contributors.find(person => person.id === message.userId)?.color;
  return {
    id: message.id, bot, error: message.kind === 'error', command: message.kind === 'request' || message.kind === 'vote',
    author: message.username, initials: initials(message.username), text: message.text,
    source: bot && message.source === 'twitch' ? message.externalId ? 'Sent' : 'Local result' : SOURCE_LABELS[message.source], dateTime: message.createdAt,
    time: new Date(message.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
    ideaId: bot ? message.ideaId : undefined, avatar: avatarStyle(color),
    nameStyle: !bot && color ? { color: `var(--color-${color})` } : undefined,
    ...(message.userId.startsWith('twitch:') ? { userId: message.userId.slice(7) } : {}), externalId: message.externalId, channelId: message.twitchChannelId,
  };
}

/** Stream chat panel: channel header, pinned command hint, the message log and its auto-scroll. */
export function useChatPanel() {
  const store = useStudioStore();
  const actions = useStudioActions();
  const state = computed(() => store.state);
  const live = computed(() => state.value?.runtime.twitch?.phase === 'connected');
  const showHelp = ref(false);
  const scroll = useChatAutoScroll(() => {
    const chat = state.value?.chat ?? [];
    return `${chat.length}:${chat[chat.length - 1]?.id ?? ''}`;
  });
  return reactive({
    store, live, showHelp,
    sourceLabel: computed(() => live.value ? 'Twitch' : 'Offline'),
    chatStatus: computed(() => state.value?.runtime.chatStatus ?? ''),
    channel: computed(() => state.value?.runtime.twitch?.channel?.login ?? 'No Twitch channel connected'),
    people: computed(() => state.value?.contributors.length ?? 0),
    requestExample: computed(() => `!request ${state.value?.activeProjectId ?? 'CFP-001'} Add a fishing minigame`),
    sessionLabel: computed(() => live.value ? 'Channel messages' : 'Local history'),
    empty: computed(() => !state.value?.chat.length),
    messages: computed(() => (state.value?.chat ?? []).slice(-100).map(message => messageView(message, state.value?.contributors ?? []))),
    bindList: scroll.bind,
    onScroll: scroll.onScroll,
    stick: scroll.stick,
    toggleHelp: () => { showHelp.value = !showHelp.value; },
    select: (ideaId: string) => { void actions.openIdea(ideaId); },
    moderate: (message: ChatMessageView) => {
      if (message.channelId && message.channelId === state.value?.runtime.twitch?.channel?.id) {
        store.moderationTarget = { channelId: message.channelId, username: message.author, userId: message.userId, messageId: message.externalId };
        store.navigate('stream');
      }
    },
  });
}

/** Explicit local testing or sending as the connected bot; failed drafts are preserved. */
export function useChatComposer(emit: (event: 'sent') => void) {
  const store = useStudioStore();
  const actions = useStudioActions();
  const username = ref('Local tester');
  const text = ref('');
  const sending = ref(false);
  const error = ref('');
  const testing = ref(false);
  const live = computed(() => store.state?.runtime.twitch?.phase === 'connected' && store.state.runtime.twitch.canChat);
  const submit = async () => {
    if (!text.value.trim() || !username.value.trim() || sending.value) return;
    sending.value = true;
    error.value = '';
    const sent = live.value && !testing.value ? await actions.sendTwitch(text.value) : await actions.sendChat(username.value, text.value);
    sending.value = false;
    if (!sent) { error.value = live.value && !testing.value ? 'Delivery was not confirmed. Check Twitch before sending again; your draft is kept.' : 'The command was not accepted. Your draft is kept.'; return; }
    text.value = '';
    emit('sent');
  };
  return reactive({
    store, username, text, sending, error, live, testing,
    botName: computed(() => store.state?.runtime.twitch?.bot?.login ?? 'Chatbot'),
    testLocally: () => { testing.value = true; }, stopTesting: () => { testing.value = false; },
    requestPlaceholder: computed(() => store.state?.population?.players.some(player => player.id === `simulator:${username.value.trim().toLocaleLowerCase('en-US')}` && player.registeredAt)
      ? `!request ${store.state?.activeProjectId || '<project-id>'} Your feature idea…` : '!register to join The Hood'),
    canSend: computed(() => !sending.value && Boolean(text.value.trim()) && (live.value || testing.value) && Boolean(username.value.trim())),
    sourceNote: computed(() => live.value
      ? testing.value ? 'Local test: nothing is posted to Twitch.' : 'Sends to the connected Twitch channel as the chatbot.'
      : 'Local test: nothing is posted to Twitch.'),
    submit: () => { void submit(); },
    keydown: (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
      event.preventDefault();
      void submit();
    },
  });
}
