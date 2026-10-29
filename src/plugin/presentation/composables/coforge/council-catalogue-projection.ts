import { onBeforeUnmount } from 'vue';
import type { CouncilCatalogueEntry, CouncilCatalogueSnapshot } from '../../../features/coforge/application/council-catalogue';
import type { useCouncilEditorStore } from '../../stores/coforge-council-editor';

/** A vault-wide read can finish across navigation; draft callbacks belong to one live project view. */
export function useCouncilCatalogueProjection(input: {
  store: ReturnType<typeof useCouncilEditorStore>;
  projectId(): string;
  read(): Promise<CouncilCatalogueSnapshot>;
  action(work: () => Promise<void>): Promise<void>;
  refreshed(entries: readonly CouncilCatalogueEntry[]): void;
}) {
  const { store } = input;
  const catalogue = store.catalogue;
  let live = true;
  store.catalogueLoaded = false;
  onBeforeUnmount(() => { live = false; });
  function snapshot(value: CouncilCatalogueSnapshot) {
    catalogue.valid = value.valid; catalogue.invalid = value.invalid;
    store.catalogueLoaded = true;
  }
  const load = () => input.action(async () => {
    const projectId = input.projectId();
    store.catalogueLoading = true; store.catalogueLoaded = false;
    try {
      snapshot(await input.read());
      if (live && input.projectId() === projectId) input.refreshed(catalogue.valid);
    } finally { store.catalogueLoading = false; }
  });
  return { catalogue, snapshot, load };
}
