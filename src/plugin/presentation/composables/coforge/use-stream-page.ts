import { computed, reactive } from 'vue';
import { useStudioStore } from '../../stores/coforge-studio';

/** Stream page: the full-width chat with the viewer command reference beside it. */
export function useStreamPage() {
  const store = useStudioStore();
  return reactive({
    store,
    intakeLabel: computed(() => store.state?.runtime.twitch?.phase === 'connected' ? 'Twitch connected' : 'Twitch not connected'),
  });
}
