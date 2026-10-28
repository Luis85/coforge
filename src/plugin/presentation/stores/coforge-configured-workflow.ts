import { defineStore } from "pinia";
import { ref } from "vue";
export interface WorkflowManualDraft {
  checked: string[];
  note: string;
  error: string;
  saving: boolean;
  reviewedRevision: number;
}
/** Human decisions are kept apart by the exact captured run, step and revision. */
export const useConfiguredWorkflowUiStore = defineStore(
  "coforge-configured-workflow",
  () => {
    const manualDrafts = ref<Record<string, WorkflowManualDraft>>({});
    const monitorError = ref("");
    const historyExpanded = ref(false);
    return { manualDrafts, monitorError, historyExpanded };
  },
);
