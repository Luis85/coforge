import { defineStore } from "pinia";
import { ref } from "vue";
import type { ObsProductionSnapshot } from "../../features/coforge/domain/obs-production";

/** Private per-view context; show definitions and outcomes remain canonical services. */
export const useObsProductionUi = defineStore("coforge-obs-production", () => {
  const snapshot = ref<ObsProductionSnapshot | null>(null);
  const pending = ref(false);
  const error = ref("");
  const notice = ref("");
  const transition = ref("");
  const duration = ref(300);
  const restartReviewed = ref(false);
  return {
    snapshot,
    pending,
    error,
    notice,
    transition,
    duration,
    restartReviewed,
  };
});
