import { computed, reactive } from 'vue';
import type { CouncilCatalogueSnapshot } from '../../../features/coforge/application/council-catalogue';
import { resolveCouncilPlan } from '../../../features/coforge/application/council-execution';
import type { CouncilDefinition } from '../../../features/coforge/domain/council-definitions';

/** Read-only catalogue projection. Final preflight still captures and validates revisions. */
export function useCouncilSelection(catalogue: () => CouncilCatalogueSnapshot, projectId: () => string, selectedId: () => string) {
  const councils = computed(() => catalogue().valid.flatMap(entry =>
    entry.definition.schema === 'council/v1' && entry.definition.projectId === projectId() && entry.definition.enabled ? [entry.definition] : []));
  const selected = computed<CouncilDefinition | undefined>(() => councils.value.find(entry => entry.id === selectedId()));
  const resolution = computed(() => {
    const council = selected.value;
    if (!council) return { issue: selectedId() ? 'The selected Council is unavailable. Choose another Council or repair it in Definitions.' : '', plan: undefined };
    try {
      return { issue: '', plan: resolveCouncilPlan(catalogue(), { kind: 'council', id: council.id, teamId: council.teamId }) };
    } catch (error) {
      return { issue: `This Council is unavailable. ${error instanceof Error ? error.message : 'Review its members in Definitions.'}`, plan: undefined };
    }
  });
  return reactive({ councils, selected, issue: computed(() => resolution.value.issue),
    ready: computed(() => Boolean(resolution.value.plan)),
    members: computed(() => [...new Map(resolution.value.plan?.invocations.map(item => [item.agent.id, item.agent]) ?? []).values()]),
    rounds: computed(() => selected.value?.rounds ?? []),
  });
}
