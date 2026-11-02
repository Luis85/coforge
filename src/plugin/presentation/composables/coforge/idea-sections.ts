import { ref, watch, type Ref, type ComponentPublicInstance } from 'vue';
import type { IdeaDrawerTab } from './use-idea-drawer';

export const IDEA_SECTIONS: ReadonlyArray<{ value: IdeaDrawerTab; label: string; purpose: string; hint: string }> = [
  { value: 'overview', label: 'Overview', hint: 'Request & priority', purpose: 'Understand the request, its community context and prioritization.' },
  { value: 'workflow', label: 'Workflow runs', hint: 'Steps & decisions', purpose: 'See the current step, take the next action and inspect saved workflow results.' },
  { value: 'plan', label: 'Plan & Design', hint: 'Saved specifications', purpose: 'Read the saved plan, acceptance criteria and design prepared for implementation.' },
  { value: 'increment', label: 'Increment', hint: 'Changes & review', purpose: 'Inspect changed files, compare verification evidence and make your review decision.' },
  { value: 'sessions', label: 'Sessions', hint: 'Observe agent activity', purpose: 'Follow active and previous agent sessions. Observation is read-only; captured prompts and responses are in Activity.' },
  { value: 'ai-costs', label: 'AI costs', hint: 'Usage & coverage', purpose: 'Inspect recorded usage and cost coverage for this request. Unknown amounts are not zero.' },
  { value: 'activity', label: 'Activity', hint: 'Conversations & history', purpose: 'Read captured agent prompts, responses and recovery evidence, followed by the request timeline.' },
];

/** Changing sections starts at the top without moving keyboard focus off its navigation control. */
export function useIdeaSectionScroll(tab: Ref<IdeaDrawerTab>, selected: () => string | null) {
  const scroll = ref<HTMLElement | null>(null);
  watch([tab, selected], () => { if (scroll.value) scroll.value.scrollTop = 0; }, { flush: 'post' });
  return { bind: (element: Element | ComponentPublicInstance | null) => { scroll.value = element instanceof HTMLElement ? element : null; } };
}
