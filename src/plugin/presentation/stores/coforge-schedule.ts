import { defineStore } from "pinia";
import { ref } from "vue";
import type {
  ScheduledStream,
  ScheduleMusic,
  ScheduleNote,
} from "../../features/coforge/domain/schedule";
export function scheduleDraft(): ScheduledStream & { music: ScheduleMusic } {
  return {
    music: { liveInputId: "", breakInputId: "" },
    id: `CFS-${crypto.randomUUID()}`,
    name: "",
    startsAt: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    projectId: "",
    title: "",
    categoryId: "",
    categoryName: "",
    tags: [],
    language: "en",
    liveSceneId: "",
    breakSceneId: "",
    status: "planned",
  };
}
export const useScheduleStore = defineStore("coforge-schedule", () => {
  const notes = ref<ScheduleNote[]>([]);
  const draft = ref(scheduleDraft());
  const expected = ref<string | null>(null);
  const date = ref("");
  const tags = ref("");
  const selected = ref("");
  const busy = ref(false);
  const error = ref("");
  const notice = ref("");
  const ready = ref(false);
  const example = ref(false);
  const categoryQuery = ref("");
  const categories = ref<Array<{ id: string; name: string }>>([]);
  const review = ref("");
  const stepResults = ref<Record<string, string>>({});
  return {
    notes,
    draft,
    expected,
    date,
    tags,
    selected,
    busy,
    error,
    notice,
    ready,
    example,
    categoryQuery,
    categories,
    review,
    stepResults,
  };
});
