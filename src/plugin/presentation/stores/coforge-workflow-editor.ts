import { defineStore } from "pinia";
import { ref } from "vue";
import {
  defaultWorkflowDefinition,
  type WorkflowDefinition,
} from "../../features/coforge/domain/configured-workflow";
import { defaultSettings } from "../../features/coforge/domain/seed";
/** One editor's unsaved configuration and transfer panels, scoped by the workbench's Pinia instance. */
export const useWorkflowEditorStore = defineStore(
  "coforge-workflow-editor",
  () => {
    const draft = ref<WorkflowDefinition>(
      defaultWorkflowDefinition(defaultSettings()),
    );
    const selectedId = ref("");
    const expectedIdentity = ref("");
    const expectedProject = ref("");
    const saving = ref(false);
    const error = ref("");
    const notice = ref("");
    const stale = ref(false);
    const transferMode = ref<"import" | "export" | null>(null);
    const importText = ref("");
    const importPreview = ref<WorkflowDefinition | null>(null);
    const exportJson = ref("");
    const exportPath = ref("");
    const exporting = ref(false);
    const session = ref("");
    return {
      draft,
      selectedId,
      expectedIdentity,
      expectedProject,
      saving,
      error,
      notice,
      stale,
      transferMode,
      importText,
      importPreview,
      exportJson,
      exportPath,
      exporting,
      session,
    };
  },
);
