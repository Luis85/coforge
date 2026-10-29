import { defineStore } from "pinia";
import { ref } from "vue";
import type {
  ObsOverlayCandidates,
  ObsOverlayKind,
  ObsOverlayPreview,
} from "../../features/coforge/domain/obs-overlay";
export const useObsOverlayUi = defineStore("coforge-obs-overlay-ui", () => {
  const id = ref<string>(crypto.randomUUID());
  const name = ref("");
  const kind = ref<ObsOverlayKind>("request");
  const projectId = ref("");
  const inputId = ref("");
  const subjectId = ref("");
  const excerpt = ref("");
  const publicConfirmed = ref(false);
  const reviewed = ref(false);
  const choices = ref<ObsOverlayCandidates>({
    projects: [],
    requests: [],
    increments: [],
    recognition: [],
    inputs: [],
  });
  const preview = ref<ObsOverlayPreview | null>(null);
  const pending = ref(false);
  const dirty = ref(false);
  const error = ref("");
  const notice = ref("");
  const selection = ref("");
  return {
    id,
    name,
    kind,
    projectId,
    inputId,
    subjectId,
    excerpt,
    publicConfirmed,
    reviewed,
    choices,
    preview,
    pending,
    dirty,
    error,
    notice,
    selection,
  };
});
