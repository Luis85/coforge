import {
  computed,
  inject,
  onBeforeUnmount,
  provide,
  reactive,
  ref,
  watch,
  type InjectionKey,
} from "vue";
import { defaultSettings } from "../../../features/coforge/domain/seed";
import { projectConfigurationIdentity } from "../../../features/coforge/domain/projects";
import { useStudioShell } from "./use-studio-app";
import {
  pickSettingsDraft,
  validateSettingsDraft,
  type SettingsDraft,
} from "./settings-fields";
function createSettings() {
  const shell = useStudioShell();
  const { store, actions } = shell;
  const persisted = computed<SettingsDraft>(() => ({
    ...pickSettingsDraft(store.state?.settings ?? defaultSettings()),
    projectPath: store.activeProject?.projectPath ?? "",
    worktreeFolder: store.activeProject?.worktreeFolder ?? "",
    repositoryUrl: store.activeProject?.repositoryUrl ?? "",
    websiteUrl: store.activeProject?.websiteUrl ?? "",
    allowImplementation: store.activeProject?.allowImplementation ?? false,
  }));
  const persistedKey = computed(() => JSON.stringify(persisted.value));
  const sourceProject = computed(() =>
    store.activeProject && store.state
      ? { ...store.activeProject, settings: store.state.settings }
      : undefined,
  );
  const sourceIdentity = computed(() =>
    sourceProject.value
      ? projectConfigurationIdentity(sourceProject.value)
      : "",
  );
  const expectedProjectId = ref(sourceProject.value?.id ?? "");
  const expectedConfiguration = ref(sourceIdentity.value);
  const expectedKey = ref(persistedKey.value);
  const copyDraft = (value: SettingsDraft): SettingsDraft => ({ ...value });
  const draft = reactive<SettingsDraft>(copyDraft(persisted.value));
  const error = ref("");
  const saved = ref(false);
  const resetConfirm = ref(false);
  const checking = ref(false);
  const saving = ref(false);

  const dirty = computed(() => JSON.stringify(draft) !== expectedKey.value);
  const staleMessage = () =>
    `Project settings changed outside this form. Your draft for ${expectedProjectId.value || "the original project"} is kept. Copy any edits you want to retain, then discard changes to load the latest settings before saving.`;
  const loadSource = () => {
    Object.assign(draft, copyDraft(persisted.value));
    expectedKey.value = persistedKey.value;
    expectedProjectId.value = sourceProject.value?.id ?? "";
    expectedConfiguration.value = sourceIdentity.value;
  };
  watch([persistedKey, sourceIdentity], () => {
    if (saving.value) return;
    if (!dirty.value) loadSource();
    else error.value = staleMessage();
  });
  watch(
    dirty,
    (isDirty) => {
      store.dirtySettings = isDirty;
      if (isDirty) saved.value = false;
    },
    { immediate: true },
  );
  onBeforeUnmount(() => {
    store.dirtySettings = false;
  });
  const pending = computed(
    () =>
      saving.value ||
      store.projectJobs.some(
        (job) => job.status === "running" || job.status === "queued",
      ) ||
      store.projectIdeas.some(
        (idea) =>
          idea.workflowRun &&
          [
            "ready",
            "running",
            "waiting-human",
            "attention",
            "awaiting-review",
          ].includes(idea.workflowRun.state),
      ),
  );
  const runtime = computed(() => store.state?.runtime);
  const lastError = (fallback: string): string => {
    const toast = store.toasts[store.toasts.length - 1];
    return toast?.error ? toast.message : fallback;
  };

  async function save(): Promise<void> {
    if (saving.value) return;
    error.value = "";
    if (!sourceProject.value || sourceProject.value.unavailable) {
      error.value =
        "Choose an available project in Projects before changing its settings.";
      return;
    }
    if (
      expectedProjectId.value !== sourceProject.value?.id ||
      expectedConfiguration.value !== sourceIdentity.value ||
      expectedKey.value !== persistedKey.value
    ) {
      error.value = staleMessage();
      return;
    }
    const problem = validateSettingsDraft(draft);
    if (problem) {
      error.value = problem;
      return;
    }
    const patch = {
      ...draft,
      projectName: draft.projectName.trim(),
      projectBrief: draft.projectBrief.trim(),
    };
    saving.value = true;
    try {
      const written = await actions.saveProjectDraft(
        patch,
        expectedProjectId.value,
        expectedConfiguration.value,
      );
      if (!written) error.value = lastError("Settings could not be saved.");
      else if (
        written.id !== sourceProject.value?.id ||
        projectConfigurationIdentity(written) !== sourceIdentity.value
      )
        error.value =
          "Your settings were saved, but the project changed again outside this form. Your draft is kept; discard changes to review the latest source.";
      else {
        loadSource();
        saved.value = true;
      }
    } finally {
      saving.value = false;
    }
  }
  async function loadSample(): Promise<void> {
    error.value = "";
    if (await actions.loadSample()) {
      resetConfirm.value = false;
      saved.value = false;
    } else error.value = lastError("The sample workspace could not be loaded.");
  }
  async function checkClaude(): Promise<void> {
    checking.value = true;
    try {
      await actions.refreshRuntime();
    } finally {
      checking.value = false;
    }
  }

  return reactive({
    store,
    draft,
    error,
    saved,
    resetConfirm,
    checking,
    dirty,
    pending,
    runtime,
    saving,
    editingProjectId: expectedProjectId,
    availableProject: computed(() =>
      Boolean(store.activeProject && !store.activeProject.unavailable),
    ),
    status: computed(() =>
      saved.value && !dirty.value ? "saved" : dirty.value ? "dirty" : "clean",
    ),
    submit: (event: Event) => {
      event.preventDefault();
      void save();
    },
    discard: () => {
      loadSource();
      error.value = "";
      saved.value = false;
    },
    exportProject: () => {
      void actions.exportProject();
    },
    toggleReset: () => {
      resetConfirm.value = !resetConfirm.value;
    },
    keepData: () => {
      resetConfirm.value = false;
    },
    confirmReset: () => {
      void loadSample();
    },
    checkClaude: () => {
      void checkClaude();
    },
  });
}
export type SettingsModel = ReturnType<typeof createSettings>;
const settingsKey: InjectionKey<SettingsModel> = Symbol("coforge-settings");

/** In-studio "Studio settings": a draft of the project settings plus runtime evidence and project data actions. */
export function useSettings(): SettingsModel {
  const model = createSettings();
  provide(settingsKey, model);
  return model;
}
/** The settings form shared by the sections of SettingsView. */
export function useSettingsForm(): SettingsModel {
  const model = inject(settingsKey, null);
  if (!model) throw new Error("COFORGE_SETTINGS_MISSING");
  return model;
}
