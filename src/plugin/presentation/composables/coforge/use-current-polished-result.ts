import { computed, reactive } from 'vue';
import type { Idea } from '../../../features/coforge/domain/types';
import { polishingTargetForView } from './polishing-target-for-view';
import { polishingTargetLabel } from './use-polishing-result-body';

export function useCurrentPolishedResult(idea: () => Idea) {
  const current = computed(() => {
    if (!idea().polishingAmendments?.length) return undefined;
    try {
      const target = polishingTargetForView(idea());
      return idea().polishingAmendments?.some(ref => ref.artifactId === target.sourceArtifactId
        && idea().polishingRuns?.some(pass => pass.id === ref.polishingRunId && pass.review === 'applied')) ? target : undefined;
    } catch { return undefined; }
  });
  return reactive({ current, label: computed(() => current.value ? polishingTargetLabel(current.value.kind) : '') });
}
