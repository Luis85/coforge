import { computed, reactive } from 'vue';
import type { Idea } from '../../../features/coforge/domain/types';
import { useStudioStore } from '../../stores/coforge-studio';
import { formatTime } from './format';

/** The plan as Markdown: the saved note text, or a minimal rendering for plans saved without one. */
function planText(idea: Idea): string {
  const plan = idea.plan;
  if (!plan) return '';
  return plan.markdown || `# ${idea.id}: ${idea.title}\n\n${plan.summary}\n\n${plan.steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}`;
}

/**
 * Plan tab. The plan already lives in the idea note, so instead of a file download the streamer copies
 * its Markdown to the clipboard (e.g. to paste into a ticket or another note).
 */
export function useIdeaPlan(props: { idea: Idea }) {
  const store = useStudioStore();
  async function copy(): Promise<void> {
    const text = planText(props.idea);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      store.notify(`Plan for ${props.idea.id} copied as Markdown.`);
    } catch {
      store.notify('The plan could not be copied. Open the idea note to copy it from there.', true);
    }
  }
  return reactive({
    savedLabel: computed(() => (props.idea.plan ? `Saved with ${props.idea.id} · ${formatTime(props.idea.plan.createdAt)}` : '')),
    copy: () => { void copy(); },
  });
}
