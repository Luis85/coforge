import { computed, inject, onBeforeUnmount, provide, reactive, ref, watch, type InjectionKey } from 'vue';
import { defaultSettings } from '../../../features/coforge/domain/seed';
import type { Provider, Settings } from '../../../features/coforge/domain/types';
import type { StudioProject } from '../../../features/coforge/domain/types';
import { useStudioShell } from './use-studio-app';
import type { ProjectPaths } from '../../../features/coforge/domain/projects';
import { validateProjectPath, validateProjectUrl } from '../../../features/coforge/domain/project-note';

/** The studio settings the form edits. Automation switches and pause live on other screens. */
type ProjectLinks = Pick<StudioProject, 'repositoryUrl' | 'websiteUrl'>;
type SettingsDraft = Pick<Settings, 'projectName' | 'projectBrief' | 'agentPrompt' | 'provider' | 'model' | NumberKey> & ProjectPaths & ProjectLinks;
type NumberKey = 'intervalSeconds' | 'minVotes' | 'requestCooldownSeconds' | 'maxTurns' | 'maxBudgetUsd' | 'timeoutSeconds';
interface NumberField { key: NumberKey; label: string; min: number; max: number; step: number; integer: boolean; help?: string }

/** Mirrors `settingsPatch` in domain/inputs.ts so the form explains a rejection before it is sent. */
const RHYTHM: NumberField[] = [
  { key: 'intervalSeconds', label: 'Queue interval · seconds', min: 2, max: 3600, step: 1, integer: true, help: 'How often automatic dispatch checks for work.' },
  { key: 'minVotes', label: 'Votes before planning', min: 0, max: 10000, step: 1, integer: true, help: 'Minimum demand for automatic planning.' },
];
const LIMITS: NumberField[] = [
  { key: 'maxTurns', label: 'Maximum agent turns', min: 1, max: 50, step: 1, integer: true },
  { key: 'maxBudgetUsd', label: 'Budget cap per run · USD', min: 0.1, max: 20, step: 0.01, integer: false },
  { key: 'timeoutSeconds', label: 'Timeout · seconds', min: 15, max: 1800, step: 1, integer: true },
];
const MODEL_PATTERN = /^[a-zA-Z0-9._:-]+$/;
const PROVIDERS: Array<{ value: Provider; icon: string; title: string; text: string }> = [
  { value: 'demo', icon: 'flask-conical', title: 'Simulation', text: 'Illustrative agent results. No CLI or credentials needed.' },
  { value: 'claude', icon: 'bot', title: 'Claude Code CLI', text: 'Real local agent runs using your configured Claude account.' },
];

const pick = (settings: Settings): Omit<SettingsDraft, keyof ProjectPaths | keyof ProjectLinks> => ({
  agentPrompt: settings.agentPrompt,
  projectName: settings.projectName, projectBrief: settings.projectBrief, provider: settings.provider, model: settings.model,
  intervalSeconds: settings.intervalSeconds, minVotes: settings.minVotes, requestCooldownSeconds: settings.requestCooldownSeconds,
  maxTurns: settings.maxTurns, maxBudgetUsd: settings.maxBudgetUsd, timeoutSeconds: settings.timeoutSeconds,
});

function invalidNumber(draft: SettingsDraft): string | null {
  for (const field of [...RHYTHM, ...LIMITS]) {
    const value: unknown = draft[field.key];
    const valid = typeof value === 'number' && Number.isFinite(value) && value >= field.min && value <= field.max && (!field.integer || Number.isInteger(value));
    if (!valid) return `${field.label.split(' · ')[0] ?? field.label} must be ${field.integer ? 'a whole number' : 'a number'} from ${field.min} to ${field.max}.`;
  }
  return null;
}

function validate(draft: SettingsDraft): string | null {
  try { validateProjectPath(draft.projectPath); validateProjectPath(draft.worktreeFolder); validateProjectUrl(draft.repositoryUrl, true); validateProjectUrl(draft.websiteUrl); }
  catch (error) { return error instanceof Error ? error.message : 'Use absolute project paths.'; }
  if (draft.allowImplementation && !draft.projectPath) return 'Set the project repository before allowing real implementation.';
  if (!draft.projectName.trim() || draft.projectBrief.trim().length < 10 || !draft.model.trim())
    return 'Add a project name, a brief of at least 10 characters, and a Claude model.';
  if (!MODEL_PATTERN.test(draft.model.trim()))
    return 'Use a model name or alias containing letters, numbers, dots, dashes, underscores, or colons.';
  return invalidNumber(draft);
}

function createSettings() {
  const shell = useStudioShell();
  const { store, actions } = shell;
  const persisted = computed<SettingsDraft>(() => ({ ...pick(store.state?.settings ?? defaultSettings()),
    projectPath: store.activeProject?.projectPath ?? '', worktreeFolder: store.activeProject?.worktreeFolder ?? '',
    repositoryUrl: store.activeProject?.repositoryUrl ?? '', websiteUrl: store.activeProject?.websiteUrl ?? '',
    allowImplementation: store.activeProject?.allowImplementation ?? false }));
  const persistedKey = computed(() => JSON.stringify(persisted.value));
  const draft = reactive<SettingsDraft>({ ...persisted.value });
  const error = ref('');
  const saved = ref(false);
  const resetConfirm = ref(false);
  const checking = ref(false);
  watch(persistedKey, () => { Object.assign(draft, persisted.value); });

  const dirty = computed(() => JSON.stringify(draft) !== persistedKey.value);
  watch(dirty, isDirty => { store.dirtySettings = isDirty; if (isDirty) saved.value = false; }, { immediate: true });
  onBeforeUnmount(() => { store.dirtySettings = false; });
  const pending = computed(() => store.projectJobs.some(job => job.status === 'running' || job.status === 'queued'));
  const runtime = computed(() => store.state?.runtime);
  const lastError = (fallback: string): string => {
    const toast = store.toasts[store.toasts.length - 1];
    return toast?.error ? toast.message : fallback;
  };

  async function save(): Promise<void> {
    error.value = '';
    const problem = validate(draft);
    if (problem) { error.value = problem; return; }
    const patch: SettingsDraft = { ...draft, projectName: draft.projectName.trim(), projectBrief: draft.projectBrief.trim(), model: draft.model.trim() };
    if (await actions.changeProject(patch, store.state?.activeProjectId)) saved.value = true;
    else error.value = lastError('Settings could not be saved.');
  }
  async function loadSample(): Promise<void> {
    error.value = '';
    if (await actions.loadSample()) { resetConfirm.value = false; saved.value = false; }
    else error.value = lastError('The sample workspace could not be loaded.');
  }
  async function checkClaude(): Promise<void> {
    checking.value = true;
    try { await actions.refreshRuntime(); } finally { checking.value = false; }
  }

  return reactive({
    store, draft, error, saved, resetConfirm, checking, dirty, pending, runtime,
    providers: PROVIDERS, rhythm: RHYTHM, limits: LIMITS,
    status: computed(() => saved.value && !dirty.value ? 'saved' : dirty.value ? 'dirty' : 'clean'),
    submit: (event: Event) => { event.preventDefault(); void save(); },
    discard: () => { Object.assign(draft, persisted.value); error.value = ''; saved.value = false; },
    exportProject: () => { void actions.exportProject(); },
    toggleReset: () => { resetConfirm.value = !resetConfirm.value; },
    keepData: () => { resetConfirm.value = false; },
    confirmReset: () => { void loadSample(); },
    checkClaude: () => { void checkClaude(); },
  });
}
export type SettingsModel = ReturnType<typeof createSettings>;
const settingsKey: InjectionKey<SettingsModel> = Symbol('coforge-settings');

/** In-studio "Studio settings": a draft of the project settings plus runtime evidence and project data actions. */
export function useSettings(): SettingsModel {
  const model = createSettings();
  provide(settingsKey, model);
  return model;
}
/** The settings form shared by the sections of SettingsView. */
export function useSettingsForm(): SettingsModel {
  const model = inject(settingsKey, null);
  if (!model) throw new Error('COFORGE_SETTINGS_MISSING');
  return model;
}
