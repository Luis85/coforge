import { StudioError } from '../domain/errors';
import { omit } from '../domain/objects';
import { cleanLine, cleanText } from '../domain/sanitize';
import { integrationPatch, newIdeaInput, riceInput, settingsPatch } from '../domain/inputs';
import type { AgentJob, AppState, IdeaAction, IntegrationSettings, Settings } from '../domain/types';
import { isActiveJob } from '../domain/workflow';
import { addVote, createIdea, ingestChat, simulateMessage, type ChatInput, type ChatResult } from './chat';
import { WorkflowEngine } from './engine';
import type { ExternalNoteChange, StudioHost, StudioStorage } from './ports';
import { adjustRice } from './review';
import { addEvent, mergeNote, StudioStore } from './studio-store';
import { addProject, editProject } from './projects';
import { copySettings, projectPaths, selectProjectState } from '../domain/projects';
import type { StudioProject } from '../domain/types';
import { loadProjectSample } from './sample-project';
import { blockPlayer, updateEconomyRules, updateCommunitySettings, recordOperation } from './population';
import { activateStreamMessage, removeStreamMessage, saveStreamMessage } from './stream-messages';
import { streamSetupProgress } from '../domain/stream-setup';
import { defaultObsSettings, emptyObsState } from '../domain/obs';
import { disconnectedTwitch } from '../domain/twitch';
import { normalizeStagePrompts } from '../domain/stage-prompts';
import { hasClaudeStages, normalizeStageAgents } from '../domain/stage-agents';
import { projectHasPendingWorkflow, saveProjectWorkflow } from './workflow-configuration';
import { validateFolderLayout } from '../domain/vault-folder-policy';
import { previewExampleCleanup, removeExampleContent } from './example-cleanup';
import type { ExampleCleanupPreview } from './example-cleanup-plan';
import { updateRequestValues } from './request-values';
import { economySnapshot, saveEconomyConfiguration, fulfillEconomyPerk } from './economy-configuration';
import type { EconomyConfigurationInput } from '../domain/command-economy';

export interface ActionOutcome<T = unknown> { message: string; result?: T }

/** The studio's use cases. Every view action and chat transport goes through this facade. */
export class StudioService {
  readonly store: StudioStore;
  readonly engine: WorkflowEngine;
  private readonly integrationListeners = new Set<(integration: IntegrationSettings) => void>();
  constructor(storage: StudioStorage, private readonly host: StudioHost) {
    this.store = new StudioStore(storage, host.events, host.observerFailed, host.beforeCommit);
    this.engine = new WorkflowEngine(this.store, { agentTasks: host.agentTasks, runners: host.runners, timers: host.timers, ...(host.report ? { onError: host.report } : {}), ...(host.assertWorkflowReviewable ? { assertWorkflowReviewable: host.assertWorkflowReviewable } : {}) });
  }

  async start(): Promise<{ invalidNotes: string[] }> {
    const loaded = await this.store.init();
    if (this.store.snapshot().projects?.some(project => hasClaudeStages(project.settings))) await this.refreshRuntime();
    else await this.store.updateRuntime(this.runtimeConfig());
    this.engine.start();
    return loaded;
  }
  async stop(): Promise<void> { await this.engine.stop(); this.store.disposeObservers(); }
  get ready(): boolean { return this.store.ready; }
  openStreamStudio(): Promise<void> { return this.store.transaction(state => recordOperation(state, 'stream-studio-opened')); }
  updateStreamSetup(action: 'open' | 'dismiss' | 'complete', outputReviewed = false): Promise<void> {
    return this.store.transaction(state => {
      if (action === 'complete' && !streamSetupProgress({ obs: state.runtime.obs ?? emptyObsState(), settings: state.obsSettings ?? defaultObsSettings(), twitch: state.runtime.twitch ?? disconnectedTwitch(), integration: state.integration, outputReviewed }).ready)
        throw new StudioError('Finish the missing setup checks before completing the guide.');
      state.setupGuide = { dismissed: action !== 'open', ...(action === 'complete' ? { completedAt: new Date().toISOString() } : {}) };
      recordOperation(state, action === 'open' ? 'stream-setup-opened' : action === 'dismiss' ? 'stream-setup-dismissed' : 'stream-setup-completed');
    });
  }
  openTwitchBranding(): Promise<void> { return this.store.transaction(state => recordOperation(state, 'twitch-branding-opened', 'none')); }

  state(): AppState { return this.store.snapshot(); }
  getEconomy() { return economySnapshot(this.store); }
  saveEconomyConfiguration(input: EconomyConfigurationInput, expectedConfigurationIdentity: string): Promise<void> { return saveEconomyConfiguration(this.store, input, expectedConfigurationIdentity); }
  fulfillEconomyPerk(id: string, expectedRevision: number, note: string): Promise<void> { return fulfillEconomyPerk(this.store, id, expectedRevision, note); }
  subscribe(listener: (state: AppState) => void): () => void { return this.store.subscribe(listener); }
  onEvent(listener: import('./studio-events').StudioEventListener): () => void { return this.store.subscribeEvents(listener); }
  integration(): IntegrationSettings { return this.store.integrationSnapshot(); }
  onIntegrationChange(listener: (integration: IntegrationSettings) => void): () => void {
    this.integrationListeners.add(listener);
    return () => { this.integrationListeners.delete(listener); };
  }

  sendChat(username: string, text: string): Promise<ChatResult> { return ingestChat(this.store, { username, text, source: 'simulator' }, this.host.economyReservations); }
  ingest(input: ChatInput): Promise<ChatResult> { return ingestChat(this.store, input, this.host.economyReservations); }
  simulate(): Promise<ChatResult> { return simulateMessage(this.store, Math.random, this.host.economyReservations); }
  blockPlayer(id: string, blocked: boolean): Promise<void> { return this.store.transaction(state => blockPlayer(state, id, blocked)); }
  updateEconomyRules(input: unknown): Promise<void> { return this.store.transaction(state => updateEconomyRules(state, input)); }
  updateCommunitySettings(input: unknown): Promise<void> { return this.store.transaction(state => updateCommunitySettings(state, input)); }
  saveStreamMessage(input: unknown, id?: string): Promise<string> { return this.store.transaction(state => saveStreamMessage(state, input, id)); }
  activateStreamMessage(id: string, active: boolean): Promise<void> { return this.store.transaction(state => activateStreamMessage(state, id, active)); }
  removeStreamMessage(id: string): Promise<void> { return this.store.transaction(state => removeStreamMessage(state, id)); }

  async createProject(input: unknown): Promise<StudioProject> {
    const project = await addProject(this.store, input);
    if (hasClaudeStages(project.settings)) await this.refreshRuntime();
    return project;
  }
  async updateProject(input: unknown, id = this.state().activeProjectId!, expectedConfiguration?: string): Promise<StudioProject> {
    const project = await editProject(this.store, id, input, expectedConfiguration);
    if (input && typeof input === 'object' && 'visibility' in input && input.visibility === 'public') this.store.clearPublicationDenial(id);
    if (hasClaudeStages(project.settings)) await this.refreshRuntime();
    await this.store.updateRuntime(this.runtimeConfig());
    return project;
  }
  async selectProject(id: string): Promise<void> {
    await this.store.transaction(state => { selectProjectState(state, id); });
  }
  async saveWorkflow(projectId: string, definition: unknown, expectedIdentity: string): Promise<StudioProject> {
    const project = await saveProjectWorkflow(this.store, projectId, definition, expectedIdentity);
    if (hasClaudeStages(project.settings)) await this.refreshRuntime();
    return project;
  }
  startWorkflow(ideaId: string) { return this.engine.startWorkflow(ideaId); }
  runWorkflowStep(ideaId: string) { return this.engine.runWorkflowStep(ideaId); }
  completeWorkflowManual(ideaId: string, expectedRevision: number, checkedIds: string[], note = '') { return this.engine.completeWorkflowManual(ideaId, expectedRevision, checkedIds, note); }
  stopWorkflow(ideaId: string) { return this.engine.stopWorkflow(ideaId); }
  acknowledgeWorkflowNudge(ideaId: string, revision: number, consent: boolean) { return this.engine.acknowledgeWorkflowNudge(ideaId, revision, consent); }

  async applyProjectNoteChange(change: { kind: 'upsert'; project: StudioProject } | { kind: 'remove'; id: string }): Promise<void> {
    const id = change.kind === 'upsert' ? change.project.id : change.id;
    if (change.kind === 'remove' || change.project.visibility === 'private' || change.project.unavailable) this.store.denyPublicProjects([id]);
    const current = this.store.internalSnapshot().projects.find(project => project.id === id);
    if (change.kind === 'upsert' && JSON.stringify(current) === JSON.stringify(change.project)) {
      if (change.project.visibility !== 'private' && !change.project.unavailable) this.store.clearPublicationDenial(id);
      return;
    }
    for (const job of this.state().jobs.filter(job => job.projectId === id && isActiveJob(job))) await this.engine.cancel(job.id);
    await this.store.transaction(state => {
      const next = change.kind === 'upsert' ? { ...change.project, settings: { ...change.project.settings, paused: true } }
        : current ? { ...current, unavailable: true, projectPath: '', allowImplementation: false, settings: { ...current.settings, paused: true } } : null;
      if (!next) return;
      const index = state.projects.findIndex(project => project.id === id);
      if (index === -1) state.projects.push(next); else state.projects[index] = next;
      state.nextProjectNumber = Math.max(state.nextProjectNumber, Number(id.match(/^CFP-(\d+)$/)?.[1] ?? 0) + 1);
      if (state.activeProjectId === id) { state.settings = copySettings(next.settings); Object.assign(state.integration, projectPaths(next)); }
      addEvent(state, 'system', change.kind === 'upsert' ? `Project “${next.settings.projectName}” changed in the vault. Automation is paused for review.` : 'A project note is missing. Restore it before running more work.');
    });
    if (change.kind === 'upsert' && change.project.visibility !== 'private' && !change.project.unavailable) this.store.clearPublicationDenial(id);
    if (change.kind === 'upsert' && hasClaudeStages(change.project.settings)) await this.refreshRuntime();
  }

  async createIdea(input: unknown): Promise<ActionOutcome> {
    const values = newIdeaInput(input);
    const idea = await this.store.transaction(state => createIdea(state, { ...values, source: 'simulator' }, 'manual'));
    return { message: `Added ${idea.id} to the inbox.`, result: idea };
  }
  updateRequestValues(ideaId: string, values: unknown, expectedRequestFingerprint: string): Promise<void> {
    return updateRequestValues(this.store, ideaId, values, expectedRequestFingerprint);
  }
  async vote(ideaId: string): Promise<ChatResult> {
    return this.store.transaction(state => addVote(state, ideaId, { username: 'streamer', userId: 'streamer', source: 'simulator' }));
  }
  async act(ideaId: string, action: IdeaAction, note?: string): Promise<unknown> { return this.engine.action(ideaId, action, note); }
  async adjustRice(ideaId: string, input: unknown): Promise<void> {
    const rice = riceInput(input);
    await this.store.transaction(state => adjustRice(state, ideaId, rice));
  }
  runNext(): Promise<AgentJob | null> { return this.engine.tick(true); }
  cancel(jobId: string): Promise<void> { return this.engine.cancel(jobId); }

  async updateSettings(input: unknown): Promise<Settings> {
    const parsed = settingsPatch(input);
    if (parsed.workflow !== undefined) throw new StudioError('Use Workflow settings to save a workflow with its source revision.', 409);
    const patch = {
      ...parsed,
      ...(parsed.stageAgents === undefined ? {} : { stageAgents: normalizeStageAgents(parsed.stageAgents) }),
        ...(parsed.stagePrompts === undefined ? {} : { stagePrompts: normalizeStagePrompts(parsed.stagePrompts) }),
      ...(parsed.agentPrompt === undefined ? {} : { agentPrompt: cleanText(parsed.agentPrompt, 8000) }), ...(parsed.projectName === undefined ? {} : { projectName: cleanLine(parsed.projectName, 80) }),
      ...(parsed.projectBrief === undefined ? {} : { projectBrief: cleanText(parsed.projectBrief, 8000) }),
    };
    const settings = await this.store.transaction(state => {
      if (Object.keys(patch).some(key => !['paused', 'automation'].includes(key)) && projectHasPendingWorkflow(state, state.activeProjectId))
        throw new StudioError('Finish, stop or review this project’s workflow before changing project settings. Future definitions can be edited in Workflow settings.', 409);
      if ((patch.stagePrompts !== undefined || patch.agentPrompt !== undefined || patch.stageAgents !== undefined || patch.model !== undefined || patch.provider !== undefined)
        && state.jobs.some(job => job.projectId === state.activeProjectId && isActiveJob(job)))
        throw new StudioError('Finish or cancel queued runs before changing the provider, model or project prompts.', 409);
      const previousAgents = JSON.stringify([state.settings.provider, state.settings.model, state.settings.stageAgents ?? {}]);
      state.settings = { ...state.settings, ...patch, automation: { ...state.settings.automation, ...patch.automation } };
      if (previousAgents !== JSON.stringify([state.settings.provider, state.settings.model, state.settings.stageAgents ?? {}])) recordOperation(state, 'project-stage-agents-updated', 'committed', undefined, 1, state.activeProjectId);
      addEvent(state, 'system', patch.paused !== undefined ? `Automation ${patch.paused ? 'paused' : 'resumed'}.` : 'Project settings updated.');
      return state.settings;
    });
    if ((patch.provider !== undefined || patch.stageAgents !== undefined) && hasClaudeStages(settings)) await this.refreshRuntime();
    return settings;
  }

  async updateIntegration(input: unknown): Promise<IntegrationSettings> {
    const patch = integrationPatch(input);
    const release = this.host.noteFolders?.reserve?.(patch.ideasFolder ? [patch.ideasFolder] : []);
    try {
      const integration = await this.store.transaction(state => {
        validateFolderLayout({ ...state.integration, ...patch }, this.host.privateFolders?.() ?? []);
        this.host.noteFolders?.assertAvailable?.([patch.ideasFolder ?? state.integration.ideasFolder]);
        if (patch.claudeBin && patch.claudeBin !== state.integration.claudeBin && state.jobs.some(isActiveJob))
          throw new StudioError('Finish or cancel all project runs before changing the Claude executable.', 409);
        if ((patch.projectPath !== undefined || patch.worktreeFolder !== undefined || patch.allowImplementation !== undefined)
          && (state.jobs.some(job => job.projectId === state.activeProjectId && isActiveJob(job)) || projectHasPendingWorkflow(state, state.activeProjectId)))
          throw new StudioError('Finish or stop this project’s queued runs and workflow before editing its repository configuration.', 409);
        if (patch.ideasFolder && patch.ideasFolder !== state.integration.ideasFolder && state.jobs.some(isActiveJob))
          throw new StudioError('Finish or cancel queued runs before moving the ideas folder.', 409);
        state.integration = { ...state.integration, ...patch };
        return state.integration;
      });
      await this.store.updateRuntime(this.runtimeConfig());
      for (const listener of this.integrationListeners) listener(integration);
      return integration;
    } finally { release?.(); }
  }

  /** Checks the native Claude Code executable. No model request is made. */
  async refreshRuntime(): Promise<AppState['runtime']> {
    const integration = this.integration();
    const runtime = await this.host.probeRuntime(integration);
    const cliAvailable = integration.claudeBin === this.integration().claudeBin && runtime.cliAvailable;
    await this.store.updateRuntime({ cliAvailable, ...this.runtimeConfig() });
    return this.state().runtime;
  }

  /** Replaces the project with the illustrative sample workspace. Existing idea notes go to the vault trash. */
  async loadSample(): Promise<void> {
    const projectId = this.state().activeProjectId;
    await this.store.transaction(state => {
      if (projectId && projectHasPendingWorkflow(state, projectId)) throw new StudioError('Finish, stop or review this project’s workflow before replacing its requests with examples.', 409);
      loadProjectSample(state);
    }, { replaceAll: true, replaceProjectId: projectId });
  }

  previewExampleCleanup(): Promise<ExampleCleanupPreview> { return previewExampleCleanup(this.store); }
  exampleCleanupWarning(): string | undefined { return this.store.exampleCleanupWarning(); }
  removeExampleContent(preview: ExampleCleanupPreview, additionalIds: readonly string[] = []) {
    return removeExampleContent(this.store, preview, additionalIds, this.host.assertExampleCleanup);
  }

  /** A readable private snapshot. Increments can contain source code and local paths. */
  exportJson(): string {
    return JSON.stringify({ ...omit(this.state(), 'runtime'), exportedAt: new Date().toISOString() }, null, 2);
  }

  /** Reconciles an edit or deletion made directly in the vault. */
  async applyNoteChange(change: ExternalNoteChange): Promise<void> {
    const current = this.store.snapshot().ideas.find(idea => idea.id === (change.kind === 'upsert' ? change.idea.id : change.id));
    if (change.kind === 'remove') {
      if (!current) return;
      await this.store.transaction(state => {
        if (state.jobs.some(job => job.ideaId === change.id && isActiveJob(job))) throw new StudioError(`${change.id} was deleted while its run was active.`, 409);
        state.ideas = state.ideas.filter(idea => idea.id !== change.id);
        if (state.requestOrigins) delete state.requestOrigins[change.id];
        state.manualHolds = state.manualHolds.filter(id => id !== change.id);
        addEvent(state, 'system', `${change.id}’s note was removed from the vault.`);
      }, { fromNotes: [change.id] });
      return;
    }
    // CoForge's own note writes come back as vault events; an unchanged note needs no transaction.
    if (!mergeNote(this.store.internalSnapshot(), change.idea)) return;
    await this.store.transaction(state => { mergeNote(state, change.idea); }, { fromNotes: [change.idea.id] });
  }

  private runtimeConfig(): Pick<AppState['runtime'], 'projectPath' | 'allowImplementation'> {
    const integration = this.integration();
    return { projectPath: integration.projectPath.trim() || null, allowImplementation: integration.allowImplementation };
  }
}
