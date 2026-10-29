import { defineStore } from "pinia";
import { ref } from "vue";
import type { WorkflowTriggerDraft } from "../../features/coforge/domain/workflow-triggers";
export const useWorkflowTriggersStore = defineStore(
  "coforge-workflow-triggers",
  () => {
    const draft = ref<WorkflowTriggerDraft>({
      name: "",
      enabled: false,
      event: "request-created",
      scope: "project",
      projectId: "",
      workflow: "v1",
      workflowRevision: "",
      request: "event",
      cooldownSeconds: 60,
    });
    const id = ref("");
    const revision = ref(0);
    const acknowledge = ref(false);
    const example = ref(false);
    return { draft, id, revision, acknowledge, example };
  },
);
