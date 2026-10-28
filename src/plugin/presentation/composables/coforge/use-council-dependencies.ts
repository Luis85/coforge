import { onBeforeUnmount, watch } from "vue";
import type {
  CouncilCatalogueActions,
  CouncilDependencySnapshot,
} from "../../../features/coforge/application/council-catalogue";
import { useCouncilDependencyStore } from "../../stores/coforge-council-dependencies";

export function useCouncilDependencies(props: {
  catalogue: CouncilCatalogueActions;
  definitionId: string;
}) {
  const store = useCouncilDependencyStore();
  let generation = 0;
  let closed = false;
  async function fallback(): Promise<CouncilDependencySnapshot> {
    const snapshot = await props.catalogue.list();
    return {
      complete: false,
      items: snapshot.valid.flatMap((entry) => {
        const definition = entry.definition;
        if (
          definition.schema === "agent/v1" ||
          definition.id === props.definitionId ||
          (!definition.members.includes(props.definitionId) &&
            !(
              definition.schema === "council/v1" &&
              definition.teamId === props.definitionId
            ))
        )
          return [];
        return [
          {
            kind:
              definition.schema === "team/v1"
                ? ("team" as const)
                : ("council" as const),
            id: definition.id,
            name: definition.name,
            enabled: definition.enabled,
          },
        ];
      }),
    };
  }
  async function refresh() {
    const current = ++generation;
    const id = props.definitionId;
    store.loading = true;
    store.error = "";
    store.snapshot = { items: [], complete: false };
    try {
      const result = props.catalogue.dependencies
        ? await props.catalogue.dependencies(id)
        : await fallback();
      if (!closed && current === generation && id === props.definitionId)
        store.snapshot = result;
    } catch {
      if (!closed && current === generation)
        store.error =
          "Dependency lookup is unavailable. Refresh after restoring access to saved project definitions.";
    } finally {
      if (!closed && current === generation) store.loading = false;
    }
  }
  watch(
    () => props.definitionId,
    () => {
      void refresh();
    },
    { immediate: true },
  );
  onBeforeUnmount(() => {
    closed = true;
    generation++;
  });
  return { store, refresh };
}
