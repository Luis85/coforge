import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { useCoforge } from "../../context/coforge-context";
import { useStudioStore } from "../../stores/coforge-studio";
import { defaultObsSettings, emptyObsState } from "../../../features/coforge/domain/obs";

export function useBroadcast() {
  const { studio, host } = useCoforge();
  const store = useStudioStore();
  const now = ref(Date.now());
  const clock = window.setInterval(() => {
    now.value = Date.now();
  }, 1000);
  onBeforeUnmount(() => window.clearInterval(clock));
  const state = computed(() => store.state?.runtime.obs ?? emptyObsState());
  const settings = computed(() => store.state?.obsSettings ?? defaultObsSettings());
  const draft = reactive(defaultObsSettings());
  let saved = defaultObsSettings();
  const loaded = ref(false);
  const password = ref("");
  const error = ref("");
  const notice = ref("");
  const working = ref(false);
  watch(
    settings,
    (next) => {
      for (const [key, value] of Object.entries(next)) {
        if (!loaded.value || Reflect.get(draft, key) === Reflect.get(saved, key))
          Object.assign(draft, { [key]: value });
      }
      saved = { ...next };
      loaded.value = true;
    },
    { immediate: true },
  );
  onMounted(() => {
    void studio.openStreamStudio().catch(() => {
      error.value = "The stream studio interaction could not be recorded.";
    });
  });
  async function run(action: () => Promise<unknown>, success = "") {
    error.value = "";
    notice.value = "";
    working.value = true;
    try {
      await store.mutate(action);
      notice.value = success;
      return true;
    } catch (problem) {
      error.value = problem instanceof Error ? problem.message : "The stream interaction could not be completed.";
      return false;
    } finally {
      working.value = false;
    }
  }
  const obs = () => {
    if (!host.obs)
      throw new Error("OBS control is available in the Obsidian plugin. This preview does not control a broadcast.");
    return host.obs;
  };
  const snapshot = computed(() => state.value.snapshot);
  const connected = computed(() => state.value.connection === "connected");
  const stable = computed(
    () =>
      connected.value &&
      !state.value.busy &&
      !working.value &&
      !state.value.uncertain &&
      !snapshot.value?.transitioning &&
      !snapshot.value?.reconnecting,
  );
  const active = computed(() => connected.value && Boolean(snapshot.value?.active));
  return reactive({
    elapsed: computed(() => {
      const value = snapshot.value;
      if (!value) return "";
      const parts = /^(\d+):([0-5]\d):([0-5]\d)/.exec(value.timecode);
      if (!parts) return value.timecode;
      const base = Number(parts[1]) * 3600 + Number(parts[2]) * 60 + Number(parts[3]);
      const seconds =
        base +
        (active.value && !state.value.uncertain
          ? Math.max(0, Math.floor((now.value - Date.parse(value.observedAt)) / 1000))
          : 0);
      return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
        .map((part) => String(part).padStart(2, "0"))
        .join(":");
    }),
    store,
    state,
    settings,
    draft,
    password,
    error,
    notice,
    working,
    connected,
    active,
    supported: Boolean(host.obs),
    busy: computed(() => state.value.busy || working.value),
    scenes: computed(() => snapshot.value?.scenes ?? []),
    currentScene: computed(
      () =>
        snapshot.value?.scenes.find((scene) => scene.id === snapshot.value?.programSceneId)?.name ?? "Not available",
    ),
    title: computed(() =>
      state.value.uncertain
        ? "OBS state needs confirmation"
        : !connected.value
          ? state.value.connection === "connecting" || state.value.connection === "authenticating"
            ? "Connecting to OBS"
            : "OBS not connected"
          : snapshot.value?.reconnecting
            ? "OBS is reconnecting the broadcast"
            : snapshot.value?.transitioning
              ? "OBS is changing state"
              : active.value
                ? state.value.onBreak
                  ? "On break · stream stays live"
                  : "Live in OBS"
                : state.value.prepared
                  ? "Ready to go live"
                  : "Prepare your stream",
    ),
    canPrepare: computed(() => Boolean(host.obs) && stable.value && !active.value),
    canGoLive: computed(() => Boolean(host.obs) && stable.value && !active.value && state.value.prepared),
    canPause: computed(
      () =>
        Boolean(host.obs) &&
        stable.value &&
        active.value &&
        !state.value.onBreak &&
        Boolean(settings.value.breakSceneId),
    ),
    canResume: computed(() => Boolean(host.obs) && stable.value && active.value && state.value.onBreak),
    canStop: computed(
      () =>
        Boolean(host.obs) &&
        connected.value &&
        !state.value.busy &&
        !working.value &&
        !state.value.uncertain &&
        active.value,
    ),
    checklist: computed(() => [
      {
        label: "OBS WebSocket connection",
        ready: connected.value,
        required: true,
        detail: connected.value ? "Connected" : "Start OBS and enable Tools → WebSocket Server Settings.",
      },
      {
        label: "Go-live scene",
        ready: Boolean(snapshot.value?.scenes.some((scene) => scene.id === settings.value.liveSceneId)),
        required: true,
        detail:
          snapshot.value?.scenes.find((scene) => scene.id === settings.value.liveSceneId)?.name ??
          "Choose and save a scene below.",
      },
      {
        label: "BRB scene",
        ready: Boolean(snapshot.value?.scenes.some((scene) => scene.id === settings.value.breakSceneId)),
        required: false,
        detail:
          snapshot.value?.scenes.find((scene) => scene.id === settings.value.breakSceneId)?.name ??
          "Optional; required for Pause / BRB.",
      },
      {
        label: "Twitch chat",
        ready: store.state?.runtime.twitch?.phase === "connected",
        required: false,
        detail: store.state?.runtime.twitch?.message ?? "Connect Twitch under Stream chat.",
      },
      {
        label: "Project",
        ready: Boolean(store.activeProject),
        required: false,
        detail: store.activeProject?.settings.projectName ?? "Add or select a project for community requests.",
      },
    ]),
    save: (event: Event) => {
      event.preventDefault();
      void run(() => obs().configure({ ...draft }), "OBS connection and scenes saved.");
    },
    connect: () => {
      void run(async () => {
        await obs().configure({ ...draft });
        await obs().connect();
      }, "OBS connected. Review readiness before going live.");
    },
    open: () => {
      void run(async () => {
        await obs().configure({ ...draft });
        await obs().open();
      }, "OBS is open and connected. Prepare the stream before going live.");
    },
    disconnect: () => {
      void run(() => obs().disconnect(), "Disconnected from OBS. Any existing broadcast keeps running.");
    },
    refresh: () => {
      void run(() => obs().refresh(), "OBS state refreshed.");
    },
    savePassword: () => {
      void run(async () => {
        await obs().setPassword(password.value);
        password.value = "";
      }, "OBS password stored securely. Reconnect to use it.");
    },
    prepare: () => {
      void run(() => obs().prepare(), "Readiness checked. Go live starts the OBS broadcast.");
    },
    goLive: () => {
      void run(() => obs().goLive(), "OBS confirmed the live broadcast.");
    },
    pause: () => {
      void run(() => obs().pause(), "BRB scene confirmed. The stream remains live.");
    },
    resume: () => {
      void run(() => obs().resume(), "Previous live scene restored.");
    },
    stop: () => {
      void run(() => obs().stop(), "OBS confirmed the stream stopped.");
    },
  });
}
