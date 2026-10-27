import { computed, nextTick, reactive } from 'vue';
import { useStudioStore } from '../../stores/coforge-studio';

/** Stream page: the full-width chat with the viewer command reference beside it. */
export function useStreamPage() {
  const store = useStudioStore();
  const tab = computed({ get: () => store.streamTool, set: value => { store.streamTool = value; } });
  return reactive({
    store, tab,
    keydown: (event: KeyboardEvent) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      tab.value = event.key === 'Home' ? 'channel' : event.key === 'End' ? 'messages' : tab.value === 'channel' ? 'messages' : 'channel';
      const owner = event.view?.document ?? document;
      void nextTick(() => owner.getElementById(tab.value === 'channel' ? 'cf-stream-channel-tab' : 'cf-stream-messages-tab')?.focus());
    },
    intakeLabel: computed(() => store.state?.runtime.twitch?.phase === 'connected' ? 'Twitch connected' : 'Twitch not connected'),
  });
}
