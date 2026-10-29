import { defineStore } from "pinia";
import { ref } from "vue";
import type {
  WorkflowOutputTemplate,
  WorkflowOutputTemplateInput,
} from "../../features/coforge/application/workflow-output-templates";

export interface ProjectOutputTemplateEditor {
  templates: WorkflowOutputTemplate[];
  invalid: { path: string; reason: string }[];
  loaded: boolean;
  loading: boolean;
  working: boolean;
  selectedId: string;
  draft: WorkflowOutputTemplateInput | null;
  expectedRevision?: string;
  saved: string;
  error: string;
  notice: string;
  deleting: boolean;
}
/** Independent template drafts survive view and project changes within the studio. */
export const useOutputTemplateStore = defineStore(
  "coforge-output-templates",
  () => {
    const projects = ref<Record<string, ProjectOutputTemplateEditor>>({});
    const libraryRequests = ref<Record<string, number>>({});
    function editor(projectId: string): ProjectOutputTemplateEditor {
      projects.value[projectId] ??= {
        templates: [],
        invalid: [],
        loaded: false,
        loading: false,
        working: false,
        selectedId: "",
        draft: null,
        saved: "null",
        error: "",
        notice: "",
        deleting: false,
      };
      return projects.value[projectId];
    }
    return {
      projects,
      editor,
      libraryRequests,
      requestLibrary: (projectId: string) => {
        libraryRequests.value[projectId] =
          (libraryRequests.value[projectId] ?? 0) + 1;
      },
    };
  },
);
