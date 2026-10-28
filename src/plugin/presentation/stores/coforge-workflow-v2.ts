import { defineStore } from "pinia";
import { ref } from "vue";
import type { WorkflowV2Definition } from "../../features/coforge/domain/configured-workflow-v2";
import type { WorkflowV2Preview } from "../../features/coforge/application/workflow-v2-ports";
export interface WorkflowV2Draft {
  draft: WorkflowV2Definition | null;
  revision: string;
  saved: string;
  source: string;
  destination: string;
  importJson: string;
  exportJson: string;
}

export const useWorkflowV2Store = defineStore(
  "coforge-workflow-v2-editor",
  () => {
    const draft = ref<WorkflowV2Definition | null>(null);
    const projectId = ref("");
    const revision = ref("");
    const saved = ref("");
    const busy = ref(false);
    const error = ref("");
    const notice = ref("");
    const source = ref("");
    const destination = ref("");
    const importJson = ref("");
    const importPreview = ref<WorkflowV2Definition | null>(null);
    const exportJson = ref("");
    const preview = ref<WorkflowV2Preview | null>(null);
    const buffers = ref<Record<string, WorkflowV2Draft>>({});
    return {
      draft,
      projectId,
      revision,
      saved,
      busy,
      error,
      notice,
      source,
      destination,
      importJson,
      importPreview,
      exportJson,
      preview,
      buffers,
    };
  },
);
