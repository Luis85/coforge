import { defineStore } from "pinia";
import { ref } from "vue";
import type {
  ObsShowPlan,
  ObsShowStep,
} from "../../features/coforge/domain/obs-show";
export const useObsShowUi = defineStore("coforge-obs-show-ui", () => {
  const selectedPlan = ref("");
  const selectedCue = ref("");
  const draft = ref<ObsShowPlan | null>(null);
  const dirty = ref(false);
  const pending = ref(false);
  const error = ref("");
  const notice = ref("");
  const stepKind = ref<ObsShowStep["kind"]>("scene");
  const sceneId = ref("");
  const inputId = ref("");
  const overlayId = ref("");
  const volumeDb = ref(-12);
  const muted = ref(true);
  const itemId = ref(0);
  const visible = ref(true);
  const recordAction = ref<"start" | "stop" | "pause" | "resume">("start");
  const mediaAction = ref<
    "play" | "pause" | "stop" | "restart" | "next" | "previous"
  >("restart");
  const marker = ref("");
  const event = ref<
    | "stream-started"
    | "stream-paused"
    | "stream-resumed"
    | "stream-stopped"
    | "request-created"
    | "job-completed"
    | "workflow-run-finished"
  >("stream-started");
  const deleteConfirmation = ref(false);
  return {
    selectedPlan,
    selectedCue,
    draft,
    dirty,
    pending,
    error,
    notice,
    stepKind,
    sceneId,
    inputId,
    overlayId,
    volumeDb,
    muted,
    itemId,
    visible,
    recordAction,
    mediaAction,
    marker,
    event,
    deleteConfirmation,
  };
});
