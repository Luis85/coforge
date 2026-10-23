import { computed, reactive, ref } from 'vue';
import type { ChatMessage, Contributor } from '../../../features/coforge/domain/types';
import { useStudioStore } from '../../stores/coforge-studio';
import { avatarStyle, initials } from './format';
import { useChatAutoScroll } from './use-chat-scroll';
import { useChatSimulator } from './use-chat-simulator';
import { useStudioActions } from './use-studio-actions';

const BOT_ID = 'system:coforge';
const SOURCE_LABELS: Record<ChatMessage['source'], string> = { twitch: 'Twitch', api: 'Bridge', simulator: 'Demo' };

/** One chat line, fully derived for display. */
export interface ChatMessageView {
  id: string; bot: boolean; error: boolean; command: boolean; author: string; initials: string; text: string;
  source: string; time: string; dateTime: string; ideaId: string | undefined;
  avatar: Record<string, string>; nameStyle: Record<string, string> | undefined;
}

function messageView(message: ChatMessage, contributors: readonly Contributor[]): ChatMessageView {
  const bot = message.userId === BOT_ID;
  const color = contributors.find(person => person.id === message.userId)?.color;
  return {
    id: message.id, bot, error: message.kind === 'error', command: message.kind === 'request' || message.kind === 'vote',
    author: bot ? 'CoForge' : message.username, initials: initials(message.username), text: message.text,
    source: SOURCE_LABELS[message.source], dateTime: message.createdAt,
    time: new Date(message.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
    ideaId: bot ? message.ideaId : undefined, avatar: avatarStyle(color),
    nameStyle: !bot && color ? { color: `var(--color-${color})` } : undefined,
  };
}

/** Stream chat panel: channel header, pinned command hint, the message log and its auto-scroll. */
export function useChatPanel() {
  const store = useStudioStore();
  const state = computed(() => store.state);
  const live = computed(() => state.value?.runtime.chatSource === 'twitch');
  const showHelp = ref(false);
  const scroll = useChatAutoScroll(() => {
    const chat = state.value?.chat ?? [];
    return `${chat.length}:${chat[chat.length - 1]?.id ?? ''}`;
  });
  return reactive({
    store, live, showHelp,
    sourceLabel: computed(() => live.value ? 'Twitch' : 'Simulator'),
    chatStatus: computed(() => state.value?.runtime.chatStatus ?? ''),
    channel: computed(() => `${(state.value?.settings.projectName ?? '').toLowerCase().replace(/\s/g, '') || 'community'}-workshop`),
    people: computed(() => state.value?.contributors.length ?? 0),
    sessionLabel: computed(() => live.value ? 'Connected chat' : 'Sample community · local demo'),
    empty: computed(() => !state.value?.chat.length),
    messages: computed(() => (state.value?.chat ?? []).slice(-100).map(message => messageView(message, state.value?.contributors ?? []))),
    bindList: scroll.bind,
    onScroll: scroll.onScroll,
    stick: scroll.stick,
    toggleHelp: () => { showHelp.value = !showHelp.value; },
    select: (ideaId: string) => { store.select(ideaId); },
  });
}

/**
 * Chat composer: sends as a simulated viewer, keeps the draft when sending fails, and drives the
 * sample-chat loop. Twitch is receive-only, so composed messages always stay in this vault.
 */
export function useChatComposer(emit: (event: 'sent') => void) {
  const store = useStudioStore();
  const actions = useStudioActions();
  const username = ref('pixelpilgrim');
  const text = ref('');
  const sending = ref(false);
  const error = ref('');
  const simulator = useChatSimulator(() => actions.simulate());
  const live = computed(() => store.state?.runtime.chatSource === 'twitch');
  const submit = async () => {
    if (!text.value.trim() || !username.value.trim() || sending.value) return;
    sending.value = true;
    error.value = '';
    const sent = await actions.sendChat(username.value, text.value);
    sending.value = false;
    if (!sent) { error.value = 'Message could not be sent. Your draft is kept.'; return; }
    text.value = '';
    emit('sent');
  };
  return reactive({
    username, text, sending, error, live,
    simulating: simulator.running,
    canSend: computed(() => !sending.value && Boolean(text.value.trim()) && Boolean(username.value.trim())),
    sourceNote: computed(() => live.value
      ? 'Incoming messages from Twitch. Composer sends local test messages; replies are not posted to Twitch.'
      : 'Local simulation · no messages sent to a platform'),
    toggleSimulation: simulator.toggle,
    submit: () => { void submit(); },
    keydown: (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
      event.preventDefault();
      void submit();
    },
  });
}
