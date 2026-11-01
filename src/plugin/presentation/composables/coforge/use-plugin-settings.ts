import { computed, inject, provide, reactive, ref, toRaw, watch, type InjectionKey } from 'vue';
import { defaultIntegration } from '../../../features/coforge/domain/seed';
import type { IntegrationSettings } from '../../../features/coforge/domain/types';
import { useStudioApp } from './use-studio-app';
import { defaultWorkflowVerificationProfile, workflowVerificationProfileCheck } from '../../../features/coforge/domain/native-workflow-tools';

type Key = keyof IntegrationSettings;
type TextKey = { [K in Key]-?: NonNullable<IntegrationSettings[K]> extends string ? K : never }[Key];

/** Mirrors `integrationPatch` in domain/inputs.ts so a rejection is explained next to the form. */
const FOLDER = /^(?!\/)(?!.*\.\.)[^\\:*?"<>|]+$/;
const TWITCH_ID = /^[\w-]*$/;
const SECRET_NAME = /^[a-z0-9-]+$/;
const ABSOLUTE = /^(?:[a-zA-Z]:[\\/]|\/|\\\\)/;
const WRAPPER = /\.(?:cmd|bat|ps1)$/i;
const TEXT_KEYS: TextKey[] = ['ideasFolder', 'claudeBin', 'codexBin', 'workerNodeBin', 'projectPath', 'worktreeFolder', 'twitchClientId', 'twitchBotUserId', 'twitchBroadcasterId', 'twitchTokenSecret', 'publicFolder'];

function validate(draft: IntegrationSettings): string | null {
  try { if (draft.workflowVerification) workflowVerificationProfileCheck(draft.workflowVerification); } catch (error) { return error instanceof Error ? error.message : 'Review the verification profile.'; }
  if (draft.executionConcurrency && ![draft.executionConcurrency.builds, draft.executionConcurrency.shortTasks].every(value => Number.isInteger(value) && value >= 1 && value <= 16)) return 'Set each execution lane limit to a whole number from 1 to 16.';
  if (draft.workerNodeBin !== undefined && (!draft.workerNodeBin.trim() || draft.workerNodeBin.length > 1000 || WRAPPER.test(draft.workerNodeBin.trim()))) return 'Set the worker Node path to a native executable or node on PATH, without a shell wrapper.';
  if (draft.codexBin !== undefined && (!draft.codexBin.trim() || draft.codexBin.length > 1000 || WRAPPER.test(draft.codexBin.trim()))) return 'Set Codex to a native executable or codex on PATH, without a shell wrapper.';
  const folder = draft.ideasFolder.trim();
  if (!folder || folder.length > 200 || !FOLDER.test(folder))
    return 'Use a vault-relative ideas folder such as CoForge/Ideas, without a leading slash, “..” or the characters \\ : * ? " < > |.';
  const bin = draft.claudeBin.trim();
  if (!bin || bin.length > 1000) return 'Enter the Claude Code executable: claude, or an absolute path to the native executable.';
  for (const [label, value] of [['Game repository', draft.projectPath], ['Worktree folder', draft.worktreeFolder]] as const) {
    const path = value.trim();
    if (path.length > 1000) return `${label} must be at most 1000 characters.`;
    if (path && !ABSOLUTE.test(path)) return `${label} must be an absolute path, for example C:/Projects/my-game or /Users/you/my-game.`;
  }
  if (draft.allowImplementation && !draft.projectPath.trim()) return 'Set the game repository before allowing real implementation.';
  for (const [label, value] of [['Client ID', draft.twitchClientId], ['Bot user ID', draft.twitchBotUserId], ['Broadcaster ID', draft.twitchBroadcasterId]] as const)
    if (value.trim().length > 100 || !TWITCH_ID.test(value.trim())) return `${label} may only contain letters, digits, underscores and dashes.`;
  if (draft.twitchEnabled && (!draft.twitchClientId.trim() || !draft.twitchBotUserId.trim() || !draft.twitchBroadcasterId.trim()))
    return 'Add the Client ID, bot user ID and broadcaster ID before enabling Twitch chat.';
  const board = draft.publicFolder.trim();
  if (!board || board.length > 200 || !FOLDER.test(board))
    return 'Use a vault-relative viewer board folder such as CoForge/Public, without a leading slash, “..” or the characters \\ : * ? " < > |.';
  const secret = draft.twitchTokenSecret.trim();
  if (!secret || secret.length > 64 || !SECRET_NAME.test(secret)) return 'The token secret name may only contain lowercase letters, digits and dashes (up to 64).';
  return null;
}

/** Changed fields only, trimmed: moving the ideas folder is a real vault operation, so unchanged values are never resent. */
function changes(draft: IntegrationSettings, saved: IntegrationSettings): Partial<IntegrationSettings> {
  const patch: Partial<IntegrationSettings> = {};
  for (const key of TEXT_KEYS) {
    const value = (draft[key] ?? '').trim();
    if (value !== (saved[key] ?? '')) patch[key] = value;
  }
  if (draft.allowImplementation !== saved.allowImplementation) patch.allowImplementation = draft.allowImplementation;
  if (draft.twitchEnabled !== saved.twitchEnabled) patch.twitchEnabled = draft.twitchEnabled;
  if (draft.twitchBotUsesStreamer !== saved.twitchBotUsesStreamer) patch.twitchBotUsesStreamer = draft.twitchBotUsesStreamer;
  if (draft.twitchBotReplies !== saved.twitchBotReplies) patch.twitchBotReplies = draft.twitchBotReplies;
  if (draft.publicBoardEnabled !== saved.publicBoardEnabled) patch.publicBoardEnabled = draft.publicBoardEnabled;
  const lanes = draft.executionConcurrency ?? { builds: 1, shortTasks: 1 };
  const previous = saved.executionConcurrency ?? { builds: 1, shortTasks: 1 };
  if (lanes.builds !== previous.builds || lanes.shortTasks !== previous.shortTasks) patch.executionConcurrency = { ...lanes };
  if (JSON.stringify(draft.workflowVerification ?? defaultWorkflowVerificationProfile()) !== JSON.stringify(saved.workflowVerification ?? defaultWorkflowVerificationProfile())) patch.workflowVerification = structuredClone(toRaw(draft.workflowVerification));
  return patch;
}

function createPluginSettings() {
  const app = useStudioApp();
  const { store, actions } = app.shell;
  const saved = ref<IntegrationSettings>(defaultIntegration());
  const draft = reactive<IntegrationSettings>(defaultIntegration());
  const loaded = ref(false);
  const error = ref('');
  const justSaved = ref(false);
  const checking = ref(false);
  const token = ref('');
  const tokenStored = ref(false);
  const tokenError = ref('');
  const website = ref('');
  const publishing = ref(false);

  const replaceDraft = (next: IntegrationSettings) => {
    Object.assign(draft, structuredClone(toRaw(next)));
    if (next.executionConcurrency === undefined) delete draft.executionConcurrency;
    draft.workflowVerification = structuredClone(next.workflowVerification ?? defaultWorkflowVerificationProfile());
  };
  const load = () => {
    const next = { ...defaultIntegration(), ...actions.integration() };
    saved.value = structuredClone(next);
    replaceDraft(next);
    tokenStored.value = actions.hasSecret(saved.value.twitchTokenSecret);
    loaded.value = true;
  };
  watch(() => store.state !== null, ready => { if (ready && !loaded.value) load(); }, { immediate: true });
  watch(() => store.state, () => {
    if (!loaded.value || !store.state) return;
    const next = { ...defaultIntegration(), ...actions.integration() };
    for (const key of TEXT_KEYS) {
      const value = next[key];
      if (value !== undefined && draft[key] === saved.value[key]) draft[key] = value;
    }
    for (const key of ['twitchEnabled', 'twitchBotUsesStreamer', 'twitchBotReplies'] as const) if (draft[key] === saved.value[key]) draft[key] = next[key];
    if (JSON.stringify(draft.executionConcurrency) === JSON.stringify(saved.value.executionConcurrency)) {
      if (next.executionConcurrency) draft.executionConcurrency = { ...next.executionConcurrency };
      else delete draft.executionConcurrency;
    }
    if (JSON.stringify(draft.workflowVerification ?? defaultWorkflowVerificationProfile()) === JSON.stringify(saved.value.workflowVerification ?? defaultWorkflowVerificationProfile())) draft.workflowVerification = structuredClone(next.workflowVerification ?? defaultWorkflowVerificationProfile());
    saved.value = structuredClone(next);
  });

  const patch = computed(() => changes(draft, saved.value));
  const dirty = computed(() => Object.keys(patch.value).length > 0);
  watch(dirty, isDirty => { if (isDirty) justSaved.value = false; });
  const lastError = (fallback: string): string => {
    const toast = store.toasts[store.toasts.length - 1];
    return toast?.error ? toast.message : fallback;
  };

  async function save(): Promise<void> {
    error.value = '';
    const problem = validate(draft);
    if (problem) { error.value = problem; return; }
    if (await actions.updateIntegration(patch.value)) { load(); justSaved.value = true; }
    else error.value = lastError('The integration settings could not be saved.');
  }
  async function checkClaude(): Promise<void> {
    checking.value = true;
    try { await actions.refreshRuntime(); } finally { checking.value = false; }
  }
  function saveToken(): void {
    tokenError.value = '';
    const value = token.value.trim();
    if (!value) { tokenError.value = 'Paste a Twitch User Access Token first.'; return; }
    if (draft.twitchTokenSecret.trim() !== saved.value.twitchTokenSecret) {
      tokenError.value = 'Save the new token secret name first, so the token is stored under the name CoForge reads.';
      return;
    }
    if (actions.setSecret(saved.value.twitchTokenSecret, value)) token.value = '';
    else tokenError.value = lastError('The token could not be stored.');
    tokenStored.value = actions.hasSecret(saved.value.twitchTokenSecret);
  }

  /** Publishing uses the saved folder; an unsaved folder change must be saved first. */
  async function runWebsite(work: () => Promise<string | null>): Promise<void> {
    website.value = '';
    if (draft.publicFolder.trim() !== saved.value.publicFolder) { website.value = 'Save the new viewer board folder first.'; return; }
    publishing.value = true;
    try { website.value = (await work()) ?? lastError('The viewer board could not be written.'); } finally { publishing.value = false; }
  }

  return reactive({
    store, draft, token, error, justSaved, checking, tokenStored, tokenError, loaded, dirty, website, publishing,
    publish: () => { void runWebsite(actions.publishBoard); },
    setupPages: () => { void runWebsite(actions.installPagesWorkflow); },
    failure: computed(() => app.failure),
    ready: computed(() => store.state !== null && loaded.value),
    runtime: computed(() => store.state?.runtime),
    pending: computed(() => (store.state?.jobs ?? []).some(job => job.status === 'running' || job.status === 'queued')),
    folderChanged: computed(() => draft.ideasFolder.trim() !== saved.value.ideasFolder),
    wrapperWarning: computed(() => WRAPPER.test(draft.claudeBin.trim())),
    workerNodeChanged: computed(() => (draft.workerNodeBin ?? 'node').trim() !== (saved.value.workerNodeBin ?? 'node').trim()),
    worktreeDefault: computed(() => draft.projectPath.trim()
      ? `${draft.projectPath.trim().replace(/[\\/]+$/, '')}-coforge-worktrees`
      : '<repository>-coforge-worktrees'),
    notice: computed(() => store.toasts[store.toasts.length - 1]),
    submit: (event: Event) => { event.preventDefault(); void save(); },
    revert: () => { replaceDraft(saved.value); error.value = ''; },
    checkClaude: () => { void checkClaude(); },
    saveToken,
  });
}
export type PluginSettingsModel = ReturnType<typeof createPluginSettings>;
const pluginSettingsKey: InjectionKey<PluginSettingsModel> = Symbol('coforge-plugin-settings');

/**
 * The CoForge plugin settings tab. It is its own Vue app, so it binds the studio itself and edits the
 * host-side integration settings (the plugin's replacement for the prototype's .env file).
 */
export function usePluginSettings(): PluginSettingsModel {
  const model = createPluginSettings();
  provide(pluginSettingsKey, model);
  return model;
}
/** The integration form shared by the sections of PluginSettings. */
export function usePluginSettingsForm(): PluginSettingsModel {
  const model = inject(pluginSettingsKey, null);
  if (!model) throw new Error('COFORGE_PLUGIN_SETTINGS_MISSING');
  return model;
}
