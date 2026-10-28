import { defineStore } from "pinia";
import { ref } from "vue";
import {
  DEFAULT_COUNCIL_FOLDERS,
  type CouncilDefinitionFolders,
} from "../../features/coforge/domain/council-definition-folders";
import type { CouncilFolderPreview } from "../../features/coforge/application/council-catalogue";
export const useCouncilFolderStore = defineStore(
  "coforge-council-folders",
  () => {
    const draft = ref<CouncilDefinitionFolders>({ ...DEFAULT_COUNCIL_FOLDERS });
    const preview = ref<CouncilFolderPreview | null>(null);
    const revision = ref(0);
    const busy = ref(false);
    const error = ref("");
    const notice = ref("");
    return { draft, preview, revision, busy, error, notice };
  },
);
