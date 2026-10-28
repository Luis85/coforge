import { computed, onMounted, onBeforeUnmount, reactive } from "vue";
import { useCoforge } from "../../context/coforge-context";
import { useStudioStore } from "../../stores/coforge-studio";
import { scheduleDraft, useScheduleStore } from "../../stores/coforge-schedule";
import type { ScheduleNote } from "../../../features/coforge/domain/schedule";
import type { ScheduleStep } from "../../../features/coforge/application/schedule-ports";
import { useTemporaryExample } from "./use-temporary-example";
export function useSchedule() {
  const { host } = useCoforge();
  const store = useScheduleStore();
  const studio = useStudioStore();
  const actions = () =>
    store.example ? host.previewSchedule?.() : host.schedule;
  const music = () => (store.example ? host.previewMusic?.() : host.music);
  let stopMusic = () => {};
  onBeforeUnmount(() => stopMusic());
  const localDate = (iso: string) => {
    const date = new Date(iso);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  };
  const draftKey = () =>
    JSON.stringify({ draft: store.draft, date: store.date, tags: store.tags });
  let clean = draftKey();
  const dirty = () => clean !== draftKey();
  async function run(work: () => Promise<void>) {
    if (store.busy) return;
    store.busy = true;
    store.error = "";
    store.notice = "";
    try {
      await work();
    } catch (error) {
      store.error =
        error instanceof Error
          ? error.message
          : "Stream schedule is unavailable.";
    } finally {
      store.busy = false;
    }
  }
  const selected = computed(() =>
    store.notes.find((note) => note.plan.id === store.selected),
  );
  async function load() {
    const service = actions();
    if (!service) return;
    store.notes = await service.list();
    stopMusic();
    const player = music();
    store.playlists = player?.snapshot().library.playlists ?? [];
    stopMusic =
      player?.subscribe((state) => {
        store.playlists = state.library.playlists;
      }) ?? (() => {});
    if (selected.value && selected.value.revision !== store.expected) {
      store.review = "";
      if (!dirty()) choose(selected.value);
    }
    store.ready = true;
  }
  function choose(note: ScheduleNote) {
    if (dirty()) {
      store.error =
        "Save or discard the current plan before selecting another stream.";
      return;
    }
    store.selected = note.plan.id;
    store.draft = structuredClone(note.plan);
    store.draft.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    store.expected = note.revision;
    store.date = localDate(note.plan.startsAt);
    store.tags = note.plan.tags.join(", ");
    store.review = "";
    store.stepResults = {};
    clean = draftKey();
  }
  onMounted(() => {
    void run(load);
  });
  const exitExample = () => {
    if (!store.example) return;
    stopMusic();
    store.example = false;
    store.notes = [];
    store.playlists = [];
    store.selected = "";
    store.draft = scheduleDraft();
    store.expected = null;
    store.date = "";
    store.tags = "";
    store.categoryQuery = "";
    store.categories = [];
    store.review = "";
    store.stepResults = {};
    store.ready = false;
    store.error = "";
    store.notice = "";
    clean = draftKey();
    host.discardPreview?.("schedule");
  };
  const beginExample = useTemporaryExample("schedule", exitExample);
  return reactive({
    store,
    studio,
    selected,
    available: computed(() => Boolean(actions())),
    canPreview: Boolean(host.previewSchedule),
    playlists: computed(() => store.playlists),
    projectName: (id: string) =>
      studio.state?.projects?.find((project) => project.id === id)?.settings
        .projectName ?? id,
    sceneName: (id: string) =>
      studio.state?.runtime.obs?.snapshot?.scenes.find(
        (scene) => scene.id === id,
      )?.name ?? (id ? "Saved scene · reconnect OBS to verify" : "Not set"),
    playlistName: (id: string) =>
      store.playlists.find((playlist) => playlist.id === id)?.name ??
      (id ? "Saved playlist · refresh library to verify" : "Not set"),
    scenes: computed(() => studio.state?.runtime.obs?.snapshot?.scenes ?? []),
    projects: computed(
      () =>
        studio.state?.projects?.filter((project) => !project.unavailable) ?? [],
    ),
    dirty: computed(dirty),
    zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    label: (note: ScheduleNote) =>
      new Intl.DateTimeFormat(undefined, {
        timeZone: note.plan.timezone,
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(note.plan.startsAt)),
    choose,
    refresh: () => {
      void run(load);
    },
    preview: () => {
      if (host.schedule || store.busy) return;
      beginExample();
      store.example = true;
      void run(load);
    },
    exitExample,
    create: () => {
      if (dirty()) {
        store.error = "Save or discard the current plan first.";
        return;
      }
      store.selected = "";
      store.draft = scheduleDraft();
      store.draft.projectId = studio.state?.activeProjectId ?? "";
      store.expected = null;
      store.date = "";
      store.tags = "";
      store.review = "";
      clean = draftKey();
    },
    discard: () => {
      clean = draftKey();
      if (selected.value) choose(selected.value);
      else {
        store.draft = scheduleDraft();
        store.date = "";
        store.tags = "";
        clean = draftKey();
      }
      store.error = "";
    },
    save: (event: Event) => {
      event.preventDefault();
      void run(async () => {
        const date = new Date(store.date);
        if (
          !Number.isFinite(date.getTime()) ||
          localDate(date.toISOString()) !== store.date
        )
          throw new Error(
            "Choose a valid local start time. This time may not exist because of a daylight-saving change.",
          );
        const input = {
          ...store.draft,
          startsAt: date.toISOString(),
          tags: store.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        };
        const note = await actions()?.save(input, store.expected);
        if (!note) return;
        store.notes = (await actions()?.list()) ?? [];
        clean = draftKey();
        choose(note);
        store.notice = "Stream plan saved. No live settings were changed.";
      });
    },
    open: () => {
      void run(async () => {
        if (selected.value) await actions()?.open(selected.value.plan.id);
      });
    },
    searchCategories: () => {
      void run(async () => {
        if (!host.twitch)
          throw new Error(
            "Connect Twitch in Stream chat to search categories.",
          );
        store.categories = await host.twitch.searchCategories(
          store.categoryQuery,
        );
      });
    },
    category: (id: string) => {
      const category = store.categories.find((category) => category.id === id);
      if (category) {
        store.draft.categoryId = category.id;
        store.draft.categoryName = category.name;
      }
    },
    review: () => {
      if (dirty()) {
        store.error = "Save or discard changes before reviewing preparation.";
        return;
      }
      store.review = selected.value?.revision ?? "";
      store.stepResults = {};
    },
    apply: (step: ScheduleStep) => {
      void run(async () => {
        const note = selected.value;
        if (!note || !store.review || store.review !== note.revision || dirty())
          throw new Error(
            "Review the saved plan before applying a preparation step.",
          );
        const guard = step === "project" ? studio.configurationIssue() : "";
        if (guard) throw new Error(guard);
        await actions()?.apply(note.plan.id, store.review, step);
        store.stepResults[step] = "Applied";
        store.notice = `Preparation step applied: ${step}.`;
      });
    },
  });
}
