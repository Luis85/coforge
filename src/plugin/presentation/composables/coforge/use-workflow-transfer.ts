import { computed, reactive, watch, type Ref } from "vue";
import {
  parseWorkflowDefinition,
  serializeWorkflowDefinition,
  type WorkflowDefinition,
} from "../../../features/coforge/domain/configured-workflow";
import { storeToRefs } from "pinia";
import { useWorkflowEditorStore } from "../../stores/coforge-workflow-editor";
interface TransferContext {
  draft: Ref<WorkflowDefinition>;
  selectedId: Ref<string>;
  error: Ref<string>;
  notice: Ref<string>;
  saveExport(json: string): Promise<string>;
}
const fileInput = (value: unknown): value is HTMLInputElement =>
  Boolean(
    value &&
    typeof value === "object" &&
    Reflect.get(value, "tagName") === "INPUT" &&
    "files" in value,
  );
/** Import parses a bounded definition into a preview; only Replace draft mutates local form state. */
export function useWorkflowTransfer(context: TransferContext) {
  const state = useWorkflowEditorStore();
  const {
    transferMode: mode,
    importText: text,
    importPreview: preview,
    exportJson,
    exportPath,
    exporting: saving,
  } = storeToRefs(state);
  const session = state.session;
  watch(
    text,
    () => {
      preview.value = null;
    },
    { flush: "sync" },
  );
  function inspect() {
    context.error.value = "";
    preview.value = null;
    try {
      preview.value = parseWorkflowDefinition(text.value);
    } catch (cause) {
      context.error.value =
        cause instanceof Error
          ? cause.message
          : "The workflow JSON could not be read.";
    }
  }
  let fileRead = 0;
  async function readFile(event: Event) {
    if (!fileInput(event.target)) return;
    const read = ++fileRead;
    const originalText = text.value;
    const file = event.target.files?.[0];
    if (!file) return;
    context.error.value = "";
    preview.value = null;
    if (file.size > 1600000) {
      context.error.value = "The workflow file exceeds the import size limit.";
      event.target.value = "";
      return;
    }
    try {
      const contents = await file.text();
      if (
        state.session !== session ||
        mode.value !== "import" ||
        read !== fileRead ||
        text.value !== originalText
      )
        return;
      text.value = contents;
      inspect();
    } catch {
      context.error.value =
        "The selected workflow file could not be read. Your draft is kept.";
    } finally {
      event.target.value = "";
    }
  }
  async function saveExport() {
    if (saving.value || !exportJson.value) return;
    saving.value = true;
    context.error.value = "";
    try {
      exportPath.value = await context.saveExport(exportJson.value);
      context.notice.value =
        "Workflow JSON saved in the private plugin folder.";
    } catch {
      context.error.value =
        "The workflow JSON could not be saved. The export preview is kept.";
    } finally {
      saving.value = false;
    }
  }
  return reactive({
    mode,
    text,
    preview,
    exportJson,
    exportPath,
    saving,
    previewJson: computed(() =>
      preview.value ? serializeWorkflowDefinition(preview.value) : "",
    ),
    openImport: () => {
      mode.value = "import";
      preview.value = null;
      context.error.value = "";
    },
    inspect,
    replace: () => {
      if (!preview.value) return;
      context.draft.value = parseWorkflowDefinition(
        serializeWorkflowDefinition(preview.value),
      );
      context.selectedId.value = context.draft.value.steps[0]?.id ?? "";
      preview.value = null;
      mode.value = null;
      context.notice.value =
        "Imported into your draft. Review the steps, then Save workflow when ready.";
    },
    openExport: () => {
      context.error.value = "";
      try {
        exportJson.value = serializeWorkflowDefinition(context.draft.value);
        exportPath.value = "";
        mode.value = "export";
      } catch (cause) {
        context.error.value =
          cause instanceof Error
            ? cause.message
            : "Fix the workflow before exporting.";
      }
    },
    saveExport: () => {
      void saveExport();
    },
    copyJson: () => {
      if (!navigator.clipboard?.writeText) {
        context.notice.value =
          "Clipboard unavailable. Select the JSON text and copy it manually.";
        return;
      }
      void navigator.clipboard.writeText(exportJson.value).then(
        () => {
          context.notice.value = "Workflow JSON copied.";
        },
        () => {
          context.notice.value =
            "Clipboard unavailable. Select the JSON text and copy it manually.";
        },
      );
    },
    readFile: (event: Event) => {
      void readFile(event);
    },
    close: () => {
      mode.value = null;
      preview.value = null;
      exportJson.value = "";
      exportPath.value = "";
    },
  });
}
