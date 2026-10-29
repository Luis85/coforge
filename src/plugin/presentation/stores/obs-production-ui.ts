import { defineStore } from "pinia";
import { ref } from "vue";
import type {
  ObsProductionFrame,
  ObsProductionSnapshot,
  ObsSceneTransform,
  ObsPropertyOption,
  ObsSourceFilter,
} from "../../features/coforge/domain/obs-production";
import type { ObsSceneContext } from "../../features/coforge/domain/obs-scenes";

/** Private, per-view OBS drafts. None of these fields is a public capture projection. */
export const useObsProductionUi = defineStore("coforge-obs-production", () => {
  const snapshot = ref<ObsProductionSnapshot | null>(null);
  const programFrame = ref<ObsProductionFrame | null>(null);
  const previewFrame = ref<ObsProductionFrame | null>(null);
  const editorFrame = ref<ObsProductionFrame | null>(null);
  const clockNow = ref(Date.now());
  const pending = ref(false);
  const error = ref("");
  const notice = ref("");
  const selectedInput = ref("");
  const selectedScene = ref("");
  const previewScene = ref("");
  const transition = ref("");
  const duration = ref(300);
  const sourceName = ref("");
  const inputKind = ref("");
  const sourceValue = ref("");
  const sourceEnabled = ref(false);
  const sourceProperty = ref("device_id");
  const sourceOptions = ref<ObsPropertyOption[]>([]);
  const sourceOption = ref<string | number>("");
  const sourceText = ref("");
  const sourceUrl = ref("");
  const itemId = ref(0);
  const transform = ref<ObsSceneTransform | null>(null);
  const transformRead = ref<{
    sceneId: string;
    itemId: number;
    context: ObsSceneContext;
  } | null>(null);
  const filters = ref<ObsSourceFilter[]>([]);
  const filterName = ref("");
  const filterKind = ref("");
  const filterSetting = ref("");
  const filterValue = ref("");
  const filterValueType = ref<"string" | "number" | "boolean">("number");
  const removeFilterName = ref("");
  const propertyValue = ref("");
  const propertyValueType = ref<"string" | "number" | "boolean">("string");
  const outputPreset = ref<"balanced" | "quality">("balanced");
  const replayEnabled = ref(true);
  const replaySeconds = ref(30);
  const restartReviewed = ref(false);
  const outputService = ref<"Twitch" | "Custom">("Twitch");
  const outputServer = ref("auto");
  const outputSecret = ref("");
  const recordDirectory = ref("");
  const video = ref({
    baseWidth: 1920,
    baseHeight: 1080,
    outputWidth: 1920,
    outputHeight: 1080,
    fpsNumerator: 30,
    fpsDenominator: 1,
  });
  return {
    snapshot,
    programFrame,
    previewFrame,
    editorFrame,
    clockNow,
    pending,
    error,
    notice,
    selectedInput,
    selectedScene,
    previewScene,
    transition,
    duration,
    sourceName,
    inputKind,
    sourceValue,
    sourceEnabled,
    sourceProperty,
    sourceOptions,
    sourceOption,
    sourceText,
    sourceUrl,
    itemId,
    transform,
    transformRead,
    filters,
    filterName,
    filterKind,
    filterSetting,
    filterValue,
    filterValueType,
    removeFilterName,
    propertyValue,
    propertyValueType,
    outputPreset,
    replayEnabled,
    replaySeconds,
    restartReviewed,
    outputService,
    outputServer,
    outputSecret,
    recordDirectory,
    video,
  };
});
