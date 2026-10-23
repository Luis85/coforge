import { StudioError } from '../domain/errors';
import { integrationPatch, newIdeaInput, riceInput, settingsPatch } from '../domain/inputs';
import { createSeed } from '../domain/seed';
import type { AgentJob, AppState, IdeaAction, IntegrationSettings, Settings } from '../domain/types';
import { isActiveJob } from '../domain/workflow';
import { addVote, createIdea, ingestChat, simulateMessage, type ChatInput, type ChatResult } from './chat';
import { WorkflowEngine } from './engine';
import type { ExternalNoteChange, StudioHost, StudioStorage } from './ports';
import { adjustRice } from './review';
import { addEvent, mergeNote, StudioStore } from './studio-store';

export interface ActionOutcome<T = unknown> { message: string; result?: T }

/** The studio's use cases. Every view action and chat transport goes through this facade. */
export class StudioService {
  readonly store: StudioStore;
  readonly engine: WorkflowEngine;
  private readonly integrationListeners = new Set<(integration: IntegrationSettings) => void>();
  constructor(storage: StudioStorage, private readonly host: StudioHost) {
    this.store = new StudioStore(storage);
    this.engine = new WorkflowEngine(this.store, { runners: host.runners, ...(host.report ? { onError: host.report } : {}) });
  }

  async start(): Promise<{ invalidNotes: string[] }> {
    const loaded = await this.store.init();
    if (this.store.snapshot().settings.provider === 'claude') await this.refreshRuntime();
    else await this.store.updateRuntime(this.runtimeConfig());
    this.engine.start();
    return loaded;
  }
  async stop(): Promise<void> { await this.engine.stop(); }

  state(): AppState { return this.store.snapshot(); }
  subscribe(listener: (state: AppState) => void): () => void { return this.store.subscribe(listener); }
  integration(): IntegrationSettings { return this.store.internalSnapshot().integration; }
  onIntegrationChange(listener: (integration: IntegrationSettings) => void): () => void {
    this.integrationListeners.add(listener);
    return () => { this.integrationListeners.delete(listener); };
  }

  sendChat(username: string, text: string): Promise<ChatResult> { return ingestChat(this.store, { username, text, source: 'simulator' }); }
  ingest(input: ChatInput): Promise<ChatResult> { return ingestChat(this.store, input); }
  simulate(): Promise<ChatResult> { return simulateMessage(this.store); }

  async createIdea(input: unknown): Promise<ActionOutcome> {
    const values = newIdeaInput(input);
    const idea = await this.store.transaction(state => createIdea(state, { ...values, source: 'simulator' }));
    return { message: `Added ${idea.id} to the inbox.`, result: idea };
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
    const patch = settingsPatch(input);
    const settings = await this.store.transaction(state => {
      if (patch.provider && patch.provider !== state.settings.provider && state.jobs.some(isActiveJob))
        throw new StudioError('Finish or cancel queued runs before changing the agent provider.', 409);
      state.settings = { ...state.settings, ...patch, automation: { ...state.settings.automation, ...patch.automation } };
      addEvent(state, 'system', patch.paused !== undefined ? `Automation ${patch.paused ? 'paused' : 'resumed'}.` : 'Project settings updated.');
      return state.settings;
    });
    if (patch.provider === 'claude') await this.refreshRuntime();
    return settings;
  }

  async updateIntegration(input: unknown): Promise<IntegrationSettings> {
    const patch = integrationPatch(input);
    const integration = await this.store.transaction(state => {
      if (patch.ideasFolder && patch.ideasFolder !== state.integration.ideasFolder && state.jobs.some(isActiveJob))
        throw new StudioError('Finish or cancel queued runs before moving the ideas folder.', 409);
      state.integration = { ...state.integration, ...patch };
      return state.integration;
    });
    await this.store.updateRuntime(this.runtimeConfig());
    for (const listener of this.integrationListeners) listener(integration);
    return integration;
  }

  /** Checks the native Claude Code executable. No model request is made. */
  async refreshRuntime(): Promise<AppState['runtime']> {
    const runtime = await this.host.probeRuntime(this.integration());
    await this.store.updateRuntime(runtime);
    return this.state().runtime;
  }

  /** Replaces the project with the illustrative sample workspace. Existing idea notes go to the vault trash. */
  async loadSample(): Promise<void> {
    await this.store.transaction(state => {
      if (state.jobs.some(isActiveJob)) throw new StudioError('Cancel or finish active and queued jobs before resetting.', 409);
      const { runtime, integration } = state;
      Object.assign(state, createSeed(), { runtime, integration, ingestMeta: { processedMessages: [], lastRequests: {} }, manualHolds: [] });
      delete state.runtime.activeJobId;
    });
  }

  /** A readable private snapshot. Increments can contain source code and local paths. */
  exportJson(): string {
    const { runtime: _runtime, ...data } = this.state();
    return JSON.stringify({ ...data, exportedAt: new Date().toISOString() }, null, 2);
  }

  /** Reconciles an edit or deletion made directly in the vault. */
  async applyNoteChange(change: ExternalNoteChange): Promise<void> {
    const current = this.store.snapshot().ideas.find(idea => idea.id === (change.kind === 'upsert' ? change.idea.id : change.id));
    if (change.kind === 'remove') {
      if (!current) return;
      await this.store.transaction(state => {
        if (state.jobs.some(job => job.ideaId === change.id && isActiveJob(job))) throw new StudioError(`${change.id} was deleted while its run was active.`, 409);
        state.ideas = state.ideas.filter(idea => idea.id !== change.id);
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
