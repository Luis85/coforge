import { defineStore } from "pinia";
import { ref } from "vue";
import type { CouncilDependencySnapshot } from "../../features/coforge/application/council-catalogue";
export const useCouncilDependencyStore = defineStore(
  "coforge-council-dependencies",
  () => {
    const snapshot = ref<CouncilDependencySnapshot>({
      items: [],
      complete: false,
    });
    const loading = ref(false);
    const error = ref("");
    return { snapshot, loading, error };
  },
);
