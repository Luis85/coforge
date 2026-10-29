import { computed, nextTick, reactive, ref, watch, type ComponentPublicInstance } from 'vue';
import type { TwitchOperationIntent, TwitchParameters } from '../../../features/coforge/domain/twitch-operations';
import type { TwitchOperationsViewModel } from './use-twitch-operations';

const rewardConstraints = new Set(['is_paused', 'is_user_input_required', 'is_global_cooldown_enabled', 'global_cooldown_seconds', 'is_max_per_stream_enabled', 'max_per_stream', 'is_max_per_user_per_stream_enabled', 'max_per_user_per_stream']);

/** Keep ordinary reward authoring short without dropping configured constraints. */
export function useTwitchOperationsActionFields(model: TwitchOperationsViewModel) {
  const advancedOpen = ref(false);
  let reviewElement: HTMLElement | null = null;
  const isReward = computed(() => model.store.action === 'reward-create' || model.store.action === 'reward-update');
  const primary = computed(() => model.descriptor?.fields.filter(field => !isReward.value || !rewardConstraints.has(field.name)) ?? []);
  const advanced = computed(() => model.descriptor?.fields.filter(field => isReward.value && rewardConstraints.has(field.name)) ?? []);
  watch(() => model.store.action, () => { advancedOpen.value = false; });
  watch(() => model.store.error, error => { if (advanced.value.some(field => error.includes(field.name))) advancedOpen.value = true; });
  watch(() => model.store.review?.id, async id => {
    if (!id) return;
    await nextTick();
    reviewElement?.focus();
  });
  function bindReview(element: Element | ComponentPublicInstance | null) {
    reviewElement = element instanceof HTMLElement ? element : null;
  }
  function toggleAdvanced(event: Event) {
    if (event.currentTarget instanceof HTMLDetailsElement) advancedOpen.value = event.currentTarget.open;
  }
  return reactive({ primary, advanced, advancedOpen, bindReview, toggleAdvanced });
}

export function twitchContentUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !['twitch.tv', 'www.twitch.tv', 'clips.twitch.tv'].includes(url.hostname)) return undefined;
    return url.href;
  } catch { return undefined; }
}

/** API acceptance is distinct from completion of a clip or raid countdown. */
export function useTwitchOperationsReceipts() {
  return {
    links: (receipt?: TwitchParameters) => Object.entries(receipt ?? {}).flatMap(([key, value]) => {
      if (key !== 'edit_url' && key !== 'url') return [];
      const url = twitchContentUrl(value);
      return url ? [{ label: key === 'edit_url' ? 'Open Twitch content editor' : 'Open Twitch content', url }] : [];
    }),
    status: (intent: TwitchOperationIntent) => {
      if (intent.completion === 'accepted') {
        if (intent.action.name === 'raid-start') return 'Accepted; raid countdown pending';
        if (intent.action.name === 'clip-create') return 'Accepted; clip publication pending';
        return 'Accepted; inspect Twitch for completion';
      }
      return intent.status === 'confirmed' ? 'Confirmed by Twitch' : intent.status;
    },
  };
}
