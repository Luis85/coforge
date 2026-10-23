import { computed, reactive, ref, watch } from 'vue';
import type { Idea, RiceScore } from '../../../features/coforge/domain/types';
import { riceValue } from '../../../features/coforge/domain/types';
import { useIdeaDrawerContext } from './use-idea-drawer';
import { useStudioActions } from './use-studio-actions';

type RiceDraft = Omit<RiceScore, 'score'>;

const DEFAULT_RICE: RiceDraft = { reach: 100, impact: 1, confidence: 0.7, effort: 1, rationale: '' };
const IMPACT_OPTIONS = [
  { value: 0.25, label: '0.25 · Minimal' }, { value: 0.5, label: '0.5 · Low' }, { value: 1, label: '1 · Medium' },
  { value: 2, label: '2 · High' }, { value: 3, label: '3 · Massive' },
] as const;
const INVALID_RICE = 'Use a nonnegative reach, an impact from 0.25–3, confidence from 0–1, positive effort, and a rationale.';
/** Mirrors `adjustRice` in application/review.ts: the estimate is locked once work runs or the idea leaves review. */
const LOCKED_STATUSES = ['building', 'shipped', 'rejected', 'flagged'];

const pick = (rice: RiceDraft): RiceDraft =>
  ({ reach: rice.reach, impact: rice.impact, confidence: rice.confidence, effort: rice.effort, rationale: rice.rationale });

function valid(rice: RiceDraft): boolean {
  return [rice.reach, rice.impact, rice.confidence, rice.effort].every(Number.isFinite)
    && rice.reach >= 0 && rice.impact >= 0.25 && rice.impact <= 3 && rice.confidence >= 0 && rice.confidence <= 1
    && rice.effort > 0 && rice.rationale.trim().length >= 3;
}

/** Prioritization section: the saved RICE equation plus an editable draft that survives failed saves. */
export function useIdeaRiceEditor(props: { idea: Idea }) {
  const drawer = useIdeaDrawerContext();
  const actions = useStudioActions();
  const editing = ref(false);
  const draft = reactive<RiceDraft>(pick(props.idea.rice ?? DEFAULT_RICE));

  watch(() => props.idea.id, () => { editing.value = false; });
  watch([() => JSON.stringify(props.idea.rice), () => props.idea.id, editing], () => {
    if (props.idea.rice && !editing.value) Object.assign(draft, pick(props.idea.rice));
  });

  async function save(): Promise<void> {
    if (!valid(draft)) { drawer.fail(INVALID_RICE); return; }
    const id = props.idea.id;
    const value = pick(draft);
    if (await drawer.perform('rice', () => actions.adjustRice(id, value))) editing.value = false;
  }

  return reactive({
    draft, editing, impactOptions: IMPACT_OPTIONS,
    locked: computed(() => drawer.isBusy || LOCKED_STATUSES.includes(props.idea.status) || props.idea.screening?.verdict !== 'clear'),
    reach: computed(() => props.idea.rice?.reach.toLocaleString() ?? ''),
    confidence: computed(() => `${Math.round((props.idea.rice?.confidence ?? 0) * 100)}%`),
    score: computed(() => props.idea.rice?.score.toLocaleString() ?? ''),
    preview: computed(() => riceValue(draft).toLocaleString()),
    toggle: () => { editing.value = !editing.value; },
    save: () => { void save(); },
  });
}
