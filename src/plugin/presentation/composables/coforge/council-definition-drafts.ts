import { computed, onBeforeUnmount, toRaw } from "vue";
import type { CouncilCatalogueEntry } from "../../../features/coforge/application/council-catalogue";
import type { CouncilDefinitionDocument } from "../../../features/coforge/domain/council-definitions";
import type {
  useCouncilEditorStore,
  CouncilDefinitionDraft,
} from "../../stores/coforge-council-editor";

export function useCouncilDefinitionDrafts(
  store: ReturnType<typeof useCouncilEditorStore>,
  project: () => string,
) {
  const key = (projectId: string, id: string) =>
    JSON.stringify([projectId, id]);
  const dirty = computed(() =>
    Boolean(store.draft && JSON.stringify(store.draft) !== store.saved),
  );
  function preserve() {
    if (!store.draft || !store.projectId) return;
    store.buffers[key(store.projectId, store.draft.id)] = {
      projectId: store.projectId,
      definition: structuredClone(toRaw(store.draft)),
      revision: store.revision,
      saved: store.saved,
    };
    store.selectedByProject[store.projectId] = store.draft.id;
  }
  function apply(value: CouncilDefinitionDraft) {
    store.projectId = value.projectId;
    store.draft = structuredClone(toRaw(value.definition));
    store.revision = value.revision;
    store.saved = value.saved;
    store.selectedByProject[value.projectId] = value.definition.id;
    store.error = "";
    store.notice = "";
  }
  function select(entry: CouncilCatalogueEntry) {
    preserve();
    const projectId = project();
    const cached = store.buffers[key(projectId, entry.definition.id)];
    apply(
      cached && JSON.stringify(cached.definition) !== cached.saved
        ? cached
        : {
            projectId,
            definition: entry.definition,
            revision: entry.revision,
            saved: JSON.stringify(entry.definition),
          },
    );
  }
  function refresh(entries: readonly CouncilCatalogueEntry[]) {
    const byId = new Map(entries.map((entry) => [entry.definition.id, entry]));
    const canonical = (
      entry: CouncilCatalogueEntry,
      projectId: string,
    ): CouncilDefinitionDraft => ({
      projectId,
      definition: structuredClone(toRaw(entry.definition)),
      revision: entry.revision,
      saved: JSON.stringify(entry.definition),
    });
    for (const [bufferKey, buffer] of Object.entries(store.buffers)) {
      if (JSON.stringify(buffer.definition) !== buffer.saved) continue;
      const current = byId.get(buffer.definition.id);
      if (
        current &&
        (current.definition.schema === "agent/v1" ||
          current.definition.projectId === buffer.projectId)
      )
        store.buffers[bufferKey] = canonical(current, buffer.projectId);
      else delete store.buffers[bufferKey];
    }
    if (!store.draft || dirty.value) return;
    const current = byId.get(store.draft.id);
    if (
      current &&
      (current.definition.schema === "agent/v1" ||
        current.definition.projectId === store.projectId)
    )
      apply(canonical(current, store.projectId));
    else {
      store.draft = null;
      store.revision = undefined;
      store.saved = "";
    }
  }
  function fresh(definition: CouncilDefinitionDocument) {
    preserve();
    apply({ projectId: project(), definition, saved: "" });
  }
  function switchProject(projectId: string) {
    preserve();
    const selected = store.selectedByProject[projectId];
    const cached = selected
      ? store.buffers[key(projectId, selected)]
      : undefined;
    if (cached) apply(cached);
    else {
      store.projectId = projectId;
      store.draft = null;
      store.revision = undefined;
      store.saved = "";
      store.error = "";
      store.notice = "";
    }
  }
  function markSaved(entry: CouncilCatalogueEntry, projectId: string) {
    const value = {
      projectId,
      definition: structuredClone(toRaw(entry.definition)),
      revision: entry.revision,
      saved: JSON.stringify(entry.definition),
    };
    store.buffers[key(projectId, entry.definition.id)] = structuredClone(
      toRaw(value),
    );
    if (
      store.projectId === projectId &&
      store.draft?.id === entry.definition.id
    )
      apply(value);
  }
  function discard(entry?: CouncilCatalogueEntry) {
    const id = store.draft?.id;
    if (!id) return;
    delete store.buffers[key(project(), id)];
    if (entry)
      apply({
        projectId: project(),
        definition: entry.definition,
        revision: entry.revision,
        saved: JSON.stringify(entry.definition),
      });
    else {
      store.draft = null;
      store.revision = undefined;
      store.saved = "";
      delete store.selectedByProject[project()];
    }
  }
  function restore(id: string) {
    preserve();
    const value = store.buffers[key(project(), id)];
    if (value) apply(value);
  }
  function changed(id: string) {
    if (store.projectId === project() && store.draft?.id === id)
      return dirty.value;
    const value = store.buffers[key(project(), id)];
    return Boolean(value && JSON.stringify(value.definition) !== value.saved);
  }
  const unsaved = computed(() => {
    const values = Object.values(store.buffers).filter(
      (value) =>
        value.projectId === project() &&
        JSON.stringify(value.definition) !== value.saved &&
        value.definition.id !== store.draft?.id,
    );
    if (
      store.draft &&
      dirty.value &&
      !values.some((value) => value.definition.id === store.draft?.id)
    )
      values.push({
        projectId: project(),
        definition: store.draft,
        revision: store.revision,
        saved: store.saved,
      });
    return values;
  });
  if (store.projectId !== project()) switchProject(project());
  onBeforeUnmount(preserve);
  return {
    dirty,
    preserve,
    select,
    refresh,
    fresh,
    switchProject,
    markSaved,
    discard,
    restore,
    changed,
    unsaved,
  };
}
