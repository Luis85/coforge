import { defineStore } from "pinia";
import { ref } from "vue";
import type { CouncilDefinitionDocument } from "../../features/coforge/domain/council-definitions";
import type { CouncilImportPreview } from "../../features/coforge/application/council-catalogue";
export interface CouncilDefinitionDraft {
  projectId: string;
  definition: CouncilDefinitionDocument;
  revision?: string;
  saved: string;
}

export function useCouncilEditorStore(scope: 'council' | 'coworkers' = 'council') { return defineStore(
  `coforge-${scope}-editor`,
  () => {
    const draft = ref<CouncilDefinitionDocument | null>(null);
    const revision = ref<string | undefined>();
    const projectId = ref("");
    const saved = ref("");
    const search = ref("");
    const buffers = ref<Record<string, CouncilDefinitionDraft>>({});
    const selectedByProject = ref<Record<string, string>>({});
    const error = ref("");
    const notice = ref("");
    const busy = ref(false);
    const importJson = ref("");
    const exportJson = ref("");
    const preview = ref<CouncilImportPreview | null>(null);
    return {
      draft,
      revision,
      projectId,
      saved,
      search,
      buffers,
      selectedByProject,
      error,
      notice,
      busy,
      importJson,
      exportJson,
      preview,
    };
  },
)(); }
