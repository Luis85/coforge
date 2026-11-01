import { errorMessage } from '../domain/errors';
import { omit } from '../domain/objects';
import { synchronizeProject } from '../domain/projects';
import type { AppState } from '../domain/types';
import type { InternalState, LoadedStudio, SaveOptions, StudioStorage } from './ports';
import { enforceWorkflowStopHolds } from './workflow-stop-policy';
import { sameDurableBuildRef, type DurableBuildSnapshot, type DurableBuildInspectionReceipt } from '../domain/durable-build';
import { assemble, enforceIntegrity } from './studio-state';
import { prepareStudioCommit } from './commit-policies';
import { StudioEvents, type StudioEventListener, type StudioEventSink } from './studio-events';
import { defaultObsSettings } from '../domain/obs';
import { streamSurfaceSnapshot } from '../domain/stream-surfaces';
import { viewerNoteProfiles } from '../domain/viewer-notes';
import { collectCostTasks } from '../domain/ai-cost-snapshot';
import type { HerdrRecord } from '../domain/herdr';
import type { HerdrCostTarget } from '../domain/ai-cost-attribution';
import { recoverConfiguredRuns } from '../domain/configured-workflow-run';
import { projectIsPublic } from '../domain/project-publicity';
import { publicReplyBlocked } from './public-reply-policy';
import { workflowMetadataFingerprint } from './workflow-note-integrity';
export { addEvent, assemble, enforceIntegrity, mergeNote } from './studio-state';
type Listener = (state: AppState) => void | Promise<void>;

/** Serialized transactions over a cloned state: a failed write leaves the committed state unchanged. */
export class StudioStore {
  private state: InternalState | null = null;
  private pending: Promise<unknown> = Promise.resolve();
  private readonly listeners = new Set<Listener>();
  private readonly changeListeners = new Set<() => void>();
  private revision = 0;
  private readonly events: StudioEvents;
  constructor(private readonly storage: StudioStorage, sink?: StudioEventSink, private readonly observerFailed: () => void = () => {}, private readonly beforeCommit?: (next: AppState, previous: AppState | null) => Promise<void | (() => void)>) { this.events = new StudioEvents(sink, observerFailed); }
  subscribeEvents(listener: StudioEventListener): () => void { return this.events.subscribe(listener); }
  disposeObservers(): void { this.events.dispose(); this.listeners.clear(); this.changeListeners.clear(); }
  subscribeChanges(listener: () => void): () => void { this.changeListeners.add(listener); return () => { this.changeListeners.delete(listener); }; }
  streamSurfaceSnapshot(liveSince: number, projectId?: string) { return streamSurfaceSnapshot(this.current(), { channelId: this.current().integration.twitchBroadcasterId, liveSince, projectId }); }
  nativeStatusSnapshot() { const state = this.current(); return { twitch: state.runtime.twitch?.phase, running: state.jobs.filter(job => job.status === 'running').length, queued: state.jobs.filter(job => job.status === 'queued').length }; }
  viewerNotesSnapshot(ids?: ReadonlySet<string>) { return viewerNoteProfiles(this.current(), ids); }
  aiCostSnapshot(records: readonly HerdrRecord[], managed: readonly HerdrCostTarget[] = []) { return collectCostTasks(this.current(), records, managed); }
  previewExampleNotes(ids: readonly string[]): Promise<Record<string, string>> {
    if (!this.storage.previewExampleNotes) return Promise.resolve({});
    return this.storage.previewExampleNotes(ids);
  }
  exampleCleanupWarning(): string | undefined { return this.storage.exampleCleanupWarning?.(); }

  async init(): Promise<{ invalidNotes: string[] }> {
    let loaded: LoadedStudio;
    try { loaded = await this.storage.load(); }
    catch (error) { throw new Error(`CoForge could not load its data. The stored files were preserved. ${errorMessage(error)}`); }
    const loadedWorkflowFingerprints = new Map(loaded.notes.map(note => [note.id, workflowMetadataFingerprint(note)]));
    const state = assemble(loaded);
    // Verify the notes exactly as loaded; the recovery below is CoForge's own change and is trusted afterwards.
    enforceIntegrity(state, 'all');
    const now = new Date().toISOString();
    for (const job of state.jobs) {
      if (job.status !== 'running' && job.status !== 'queued') continue;
      if (job.durable) continue;
      job.status = 'failed'; job.finishedAt = now;
      job.error = 'Obsidian closed or the plugin reloaded during this run. Inspect any partial worktree before retrying.';
      job.logs.push(job.error);
      const idea = state.ideas.find(i => i.id === job.ideaId);
      if (idea && !job.workflow?.polishingId) { idea.lastError = job.error; if (idea.status === 'building') idea.status = 'planned'; }
    }
    delete state.runtime.activeJobId;
    recoverConfiguredRuns(state);
    enforceWorkflowStopHolds(state);
    enforceIntegrity(state, new Set());
    state.settings.paused = state.projects.some(project => project.id === state.activeProjectId && project.unavailable) || state.settings.workflow?.startupMode !== 'play';
    for (const project of state.projects) project.settings.paused = project.unavailable === true || project.settings.workflow?.startupMode !== 'play';
    synchronizeProject(state);
    const release = await this.beforeCommit?.(state, null);
    try {
      await this.storage.save(state, null, { fromNotes: state.ideas.filter(idea => {
        const original = loaded.notes.find(note => note.id === idea.id);
        return !idea.lastError && original?.projectId && workflowMetadataFingerprint(idea) === loadedWorkflowFingerprints.get(idea.id);
      }).map(idea => idea.id) });
      this.state = state;
      this.emit();
    }
    finally { if (typeof release === 'function') release(); }
    return { invalidNotes: loaded.invalidNotes };
  }

  get ready(): boolean { return this.state !== null; }
  snapshot(): AppState {
    return structuredClone(omit(this.current(), 'integration', 'ingestMeta', 'manualHolds'));
  }
  internalSnapshot(): InternalState { return structuredClone(this.current()); }
  denyPublicProjects(ids: readonly string[]): void {
    if (!this.state || !ids.length) return;
    this.state = { ...this.state, runtime: { ...this.state.runtime, publicationDeniedProjectIds: [...new Set([...(this.state.runtime.publicationDeniedProjectIds ?? []), ...ids])] } };
    this.emit();
  }
  clearPublicationDenial(id: string): void {
    if (!this.state?.runtime.publicationDeniedProjectIds?.includes(id)) return;
    this.state = { ...this.state, runtime: { ...this.state.runtime, publicationDeniedProjectIds: this.state.runtime.publicationDeniedProjectIds.filter(value => value !== id) } };
    this.emit();
  }
  exampleCostRemovalCutoffs(): Record<string, string> { return { ...this.current().exampleRemovalCutoffs }; }
  integrationSnapshot(): InternalState['integration'] { return { ...this.current().integration }; }
  liveChatSnapshot() {
    const state = this.current(); return { phase: state.runtime.twitch?.phase, connectedAt: state.runtime.twitch?.connectedAt,
      messages: state.population.counters['twitch-message-observed'] ?? 0,
      commands: state.population.counters['twitch-command-observed'] ?? 0 };
  }
  obsContext() {
    const state = this.current(); return { settings: structuredClone(state.obsSettings ?? defaultObsSettings()), command: state.obsCommand ? { ...state.obsCommand } : undefined, resumeSceneId: state.obsResumeSceneId };
  }
  pendingBotReply(): InternalState['botReplies'][number] | undefined {
    const reply = this.current().botReplies.find(reply => reply.status === 'pending'); return reply ? structuredClone(reply) : undefined;
  }
  publicReplyAllowed(id: string): boolean {
    const reply = this.current().botReplies.find(item => item.id === id);
    return Boolean(reply && !publicReplyBlocked(this.current(), reply));
  }
  recurringSnapshot(): { messages: InternalState['streamMessages']; pending: boolean } {
    const state = this.current(); return { messages: structuredClone(state.streamMessages), pending: state.botReplies.some(reply => Boolean(reply.streamMessageId) && reply.status === 'pending') };
  }

  transaction<T>(mutate: (state: InternalState) => T | Promise<T>, options: SaveOptions = {}): Promise<T> {
    const work = this.pending.then(async () => {
      const previous = this.current();
      const next = structuredClone(previous);
      const result = await mutate(next);
      enforceWorkflowStopHolds(next);
      const { events, fromNotes } = prepareStudioCommit(previous, next, options);
      const revoked = previous.projects.filter(project => projectIsPublic({ projects: previous.projects }, project.id) && !projectIsPublic({ projects: next.projects }, project.id)).map(project => project.id);
      this.denyPublicProjects(revoked);
      const mergeDenials = () => {
        const denied = [...new Set([...(next.runtime.publicationDeniedProjectIds ?? []), ...(this.current().runtime.publicationDeniedProjectIds ?? [])])];
        if (denied.length) next.runtime.publicationDeniedProjectIds = denied;
      };
      mergeDenials();
      const release = await this.beforeCommit?.(next, previous);
      try {
        await this.storage.save(next, previous, { ...options, ...(fromNotes ? { fromNotes } : {}) });
        mergeDenials();
        this.state = next;
        this.events.publish(events, ++this.revision);
        this.emit();
        return result;
      } finally { if (typeof release === 'function') release(); }
    });
    this.pending = work.catch(() => undefined);
    return work;
  }

  /** Runtime facts (CLI probe, chat status) are not persisted but still notify views. */
  async updateRuntime(patch: Partial<AppState['runtime']>): Promise<void> {
    await this.pending;
    const state = this.current();
    this.state = { ...state, runtime: { ...state.runtime, ...patch } };
    this.emit();
  }
  durableBuildJob(jobId: string) { const job = this.current().jobs.find(item => item.id === jobId); return job ? structuredClone(job) : undefined; }
  workflowStopHeld(ideaId: string): boolean { return this.current().workflowStopHolds?.includes(ideaId) === true; }
  durableBuildJobIds(ideaId?: string): string[] { return this.current().jobs.filter(job => job.durable && !job.durable.acknowledged && (!ideaId || job.ideaId === ideaId)).map(job => job.id); }
  durableBuildSnapshot(jobId: string): DurableBuildSnapshot | undefined {
    const state = this.current(); const snapshot = state.runtime.durableBuildSnapshots?.[jobId] ?? state.jobs.find(job => job.id === jobId)?.durable?.snapshot;
    return snapshot ? structuredClone(snapshot) : undefined;
  }
  durableBuildError(jobId: string): string | undefined { return this.current().runtime.durableBuildErrors?.[jobId] ?? this.current().jobs.find(job => job.id === jobId)?.durable?.reconcileError; }
  /** Worker heartbeat/log observations never enter a canonical transaction or write storage. */
  async observeDurableBuild(jobId: string, snapshot?: DurableBuildSnapshot, error?: string, remove = false): Promise<void> {
    await this.pending;
    const state = this.current(); const job = state.jobs.find(item => item.id === jobId);
    if (!job?.durable || snapshot && !sameDurableBuildRef(job.durable.ref, snapshot.ref)) return;
    if (job.durable.acknowledged && !remove) return;
    if (!snapshot && !remove && state.runtime.durableBuildErrors?.[jobId] === error) return;
    const snapshots = { ...state.runtime.durableBuildSnapshots }; const errors = { ...state.runtime.durableBuildErrors }; const inspections = { ...state.runtime.durableBuildInspections };
    if (snapshot) snapshots[jobId] = snapshot;
    if (error) errors[jobId] = error; else delete errors[jobId];
    if (remove) { delete snapshots[jobId]; delete errors[jobId]; delete inspections[jobId]; }
    this.state = { ...state, runtime: { ...state.runtime, durableBuildSnapshots: snapshots, durableBuildErrors: errors, durableBuildInspections: inspections } };
    this.emit();
  }
  durableBuildInspection(jobId: string): DurableBuildInspectionReceipt | undefined { const receipt = this.current().runtime.durableBuildInspections?.[jobId]; return receipt ? structuredClone(receipt) : undefined; }
  async observeDurableBuildInspection(jobId: string, receipt: DurableBuildInspectionReceipt): Promise<void> {
    await this.pending;
    const state = this.current(); const job = state.jobs.find(item => item.id === jobId);
    if (!job?.durable || !sameDurableBuildRef(job.durable.ref, receipt.ref)) throw new Error('The original worker identity changed during inspection.');
    const idea = state.ideas.find(item => item.id === receipt.ideaId);
    const run = idea?.workflowRun?.id === receipt.runId ? idea.workflowRun : idea?.polishingRuns?.find(item => item.id === receipt.runId)?.workflow;
    if (run?.id !== receipt.runId || run.revision !== receipt.runRevision) throw new Error('The workflow changed during inspection. Inspect its current retained evidence again.');
    this.state = { ...state, runtime: { ...state.runtime, durableBuildInspections: { ...state.runtime.durableBuildInspections, [jobId]: receipt } } };
    this.emit();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    if (this.state) this.deliverState(listener, this.snapshot());
    return () => { this.listeners.delete(listener); };
  }

  async flush(): Promise<void> { await this.pending; }

  private current(): InternalState {
    if (!this.state) throw new Error('CoForge is still loading.');
    return this.state;
  }
  private reportObserverFailure(): void { try { this.observerFailed(); } catch { /* A diagnostic failure cannot undo the committed write. */ } }
  private deliverState(listener: Listener, snapshot: AppState): void {
    try { const result = listener(snapshot); if (result) void result.catch(() => this.reportObserverFailure()); } catch { this.reportObserverFailure(); }
  }
  private emit(): void {
    if (this.listeners.size) { const snapshot = this.snapshot(); for (const listener of this.listeners) this.deliverState(listener, snapshot); }
    for (const listener of this.changeListeners) { try { listener(); } catch { this.reportObserverFailure(); } }
  }
}
