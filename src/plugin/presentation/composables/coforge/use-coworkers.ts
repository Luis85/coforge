import { computed, reactive, ref } from 'vue';
import type { CouncilCatalogueActions } from '../../../features/coforge/application/council-catalogue';
import { useCouncilDefinitions } from './use-council-definitions';

/** Reusable CoWorkers have a vault-wide editor and their own retained draft buffers. */
export function useCoWorkerInventory(props: { catalogue: CouncilCatalogueActions }) {
  const model = useCouncilDefinitions({ catalogue: props.catalogue, projectId: '@coworkers', mode: 'coworkers' });
  const status = ref('all');
  const entries = computed(() => model.entries.filter(entry => entry.definition.schema === 'agent/v1'
    && (status.value === 'all' || entry.definition.enabled === (status.value === 'available'))));
  const membership = (id: string) => model.catalogue.valid.filter(entry => entry.definition.schema === 'team/v1' && entry.definition.members.includes(id)).map(entry => entry.definition.name);
  return reactive({ model, status, entries, membership, total: computed(() => model.agents.length) });
}
