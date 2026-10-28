import { computed, onBeforeUnmount, toRaw } from "vue";
import type { StoredWorkflowV2 } from "../../../features/coforge/application/workflow-v2-ports";
import type {
  useWorkflowV2Store,
  WorkflowV2Draft,
} from "../../stores/coforge-workflow-v2";

export function useWorkflowV2ProjectDrafts(
  store: ReturnType<typeof useWorkflowV2Store>,
) {
  const dirty = computed(() =>
    Boolean(store.draft && JSON.stringify(store.draft) !== store.saved),
  );
  function preserve() {
    if (!store.projectId) return;
    store.buffers[store.projectId] = {
      draft: store.draft ? structuredClone(toRaw(store.draft)) : null,
      revision: store.revision,
      saved: store.saved,
      source: store.source,
      destination: store.destination,
      importJson: store.importJson,
      exportJson: store.exportJson,
    };
  }
  function apply(value: WorkflowV2Draft) {
    store.draft = value.draft ? structuredClone(toRaw(value.draft)) : null;
    store.revision = value.revision;
    store.saved = value.saved;
    store.source = value.source;
    store.destination = value.destination;
    store.importJson = value.importJson;
    store.exportJson = value.exportJson;
    store.preview = null;
    store.importPreview = null;
  }
  function enter(projectId: string) {
    preserve();
    store.projectId = projectId;
    apply(
      store.buffers[projectId] ?? {
        draft: null,
        revision: "",
        saved: "null",
        source: "",
        destination: "",
        importJson: "",
        exportJson: "",
      },
    );
  }
  function commit(
    projectId: string,
    saved: StoredWorkflowV2,
    submitted: string,
  ) {
    const value = store.buffers[projectId];
    if (!value) return;
    store.buffers[projectId] = {
      ...value,
      draft:
        JSON.stringify(value.draft) === submitted
          ? saved.definition
            ? structuredClone(toRaw(saved.definition))
            : null
          : value.draft,
      revision: saved.revision,
      saved: JSON.stringify(saved.definition),
    };
  }
  onBeforeUnmount(preserve);
  return { dirty, preserve, enter, commit };
}
