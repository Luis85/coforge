import { reactive, toRaw, watch } from "vue";
import type { CouncilFolderActions } from "../../../features/coforge/application/council-catalogue";
import type { CouncilDefinitionFolders } from "../../../features/coforge/domain/council-definition-folders";
import { useCouncilFolderStore } from "../../stores/coforge-council-folders";

export function useCouncilFolderEditor(props: {
  actions: CouncilFolderActions;
  folders: CouncilDefinitionFolders;
  preferencesRevision: number;
}) {
  const store = useCouncilFolderStore();
  let previewDraft = "";
  const fields = [
    { key: "agents", label: "Agent definitions folder" },
    { key: "teams", label: "Team definitions folder" },
    { key: "councils", label: "Council definitions folder" },
  ] as const;
  function reset() {
    store.draft = structuredClone(toRaw(props.folders));
    store.preview = null;
    store.error = "";
    store.notice = "";
  }
  async function action(work: () => Promise<void>) {
    if (store.busy) return;
    store.busy = true;
    store.error = "";
    store.notice = "";
    try {
      await work();
    } catch (error) {
      store.error =
        error instanceof Error
          ? error.message
          : "Folder settings could not be saved. Your draft is preserved; preview again after repairing the reported scope.";
    } finally {
      store.busy = false;
    }
  }
  const preview = () =>
    action(async () => {
      const draft = JSON.stringify(store.draft);
      const revision = props.preferencesRevision;
      const result = await props.actions.preview(
        structuredClone(toRaw(store.draft)),
      );
      if (draft !== JSON.stringify(store.draft)) return;
      store.preview = result;
      store.revision = revision;
      previewDraft = draft;
    });
  const save = () =>
    action(async () => {
      if (!store.preview || previewDraft !== JSON.stringify(store.draft))
        throw new Error("Preview the current folder draft before saving.");
      if (store.preview.invalid.length)
        throw new Error(
          "Repair conflicting or invalid definitions before saving these folder scopes.",
        );
      await props.actions.configure(
        structuredClone(toRaw(store.preview.folders)),
        store.revision,
      );
      store.notice =
        "Definition folders saved. Existing notes keep their identity and current location; new definitions use these folders.";
      store.preview = null;
    });
  reset();
  watch(
    () => store.draft,
    () => {
      store.preview = null;
    },
    { deep: true },
  );
  return reactive({ store, fields, preview, save, reset });
}
