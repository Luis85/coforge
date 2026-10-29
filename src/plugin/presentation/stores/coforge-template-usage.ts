import { defineStore } from "pinia";
import { ref } from "vue";
import type { WorkflowOutputTemplateUsage } from "../../features/coforge/application/workflow-output-template-usage";

export interface TemplateUsageState extends WorkflowOutputTemplateUsage {
  loading: boolean;
  error: string;
  request: number;
}
export const useTemplateUsageStore = defineStore(
  "coforge-template-usage",
  () => {
    const entries = ref<Record<string, TemplateUsageState>>({});
    function entry(projectId: string, templateId: string): TemplateUsageState {
      const key = `${projectId}:${templateId}`;
      entries.value[key] ??= {
        references: [],
        loading: false,
        error: "",
        request: 0,
      };
      // Read the inserted value through the reactive record, rather than returning the raw assignment result.
      return entries.value[key]!;
    }
    return { entry };
  },
);
