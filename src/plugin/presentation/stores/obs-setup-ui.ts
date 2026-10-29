import { defineStore } from "pinia";
import { ref } from "vue";
import type {
  ObsSetupInput,
  ObsSetupPreview,
  ObsSetupRole,
} from "../../features/coforge/domain/obs-setup";
export const useObsSetupUi = defineStore("coforge-obs-setup-ui", () => {
  const draft = ref<ObsSetupInput>({ prefix: "CoForge", sources: [] });
  const preview = ref<ObsSetupPreview | null>(null);
  const confirmed = ref(false);
  const pending = ref(false);
  const error = ref("");
  const notice = ref("");
  const sourceName = ref("");
  const sourceKind = ref("");
  const property = ref("");
  const value = ref("");
  const roles = ref<ObsSetupRole[]>(["development", "council", "playtest"]);
  const enabled = ref(true);
  const includeTitles = ref(true);
  const created = ref(false);
  const includeVideo = ref(false);
  const includeOutputPreset = ref(false);
  return {
    draft,
    preview,
    confirmed,
    pending,
    error,
    notice,
    sourceName,
    sourceKind,
    property,
    value,
    roles,
    enabled,
    includeTitles,
    created,
    includeVideo,
    includeOutputPreset,
  };
});
