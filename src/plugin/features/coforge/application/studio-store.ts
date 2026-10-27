import { errorMessage } from '../domain/errors';
import { omit } from '../domain/objects';
import { synchronizeProject } from '../domain/projects';
import type { AppState } from '../domain/types';
import type { InternalState, LoadedStudio, SaveOptions, StudioStorage } from './ports';
import { assemble, enforceIntegrity } from './studio-state';
import { prepareStudioCommit } from './commit-policies';
import { StudioEvents, type StudioEventListener, type StudioEventSink } from './studio-events';
export { addEvent, assemble, enforceIntegrity, mergeNote } from './studio-state';
type Listener = (state: AppState) => void | Promise<void>;

/** Serialized transactions over a cloned state: a failed write leaves the committed state unchanged. */
export class StudioStore {
  private state: InternalState | null = null;
  private pending: Promise<unknown> = Promise.resolve();
  private readonly listeners = new Set<Listener>();
  private revision = 0;
  private readonly events: StudioEvents;
  constructor(private readonly storage: StudioStorage, sink?: StudioEventSink, private readonly observerFailed: () => void = () => {}) { this.events = new StudioEvents(sink, observerFailed); }
  subscribeEvents(listener: StudioEventListener): () => void { return this.events.subscribe(listener); }
  disposeObservers(): void { this.events.dispose(); this.listeners.clear(); }

  async init(): Promise<{ invalidNotes: string[] }> {
    let loaded: LoadedStudio;
    try { loaded = await this.storage.load(); }
    catch (error) { throw new Error(`CoForge could not load its data. The stored files were preserved. ${errorMessage(error)}`); }
    const state = assemble(loaded);
    // Verify the notes exactly as loaded; the recovery below is CoForge's own change and is trusted afterwards.
    enforceIntegrity(state, 'all');
    const now = new Date().toISOString();
    for (const job of state.jobs) {
      if (job.status !== 'running' && job.status !== 'queued') continue;
      job.status = 'failed'; job.finishedAt = now;
      job.error = 'Obsidian closed or the plugin reloaded during this run. Inspect any partial worktree before retrying.';
      job.logs.push(job.error);
      const idea = state.ideas.find(i => i.id === job.ideaId);
      if (idea) { idea.lastError = job.error; if (idea.status === 'building') idea.status = 'planned'; }
    }
    delete state.runtime.activeJobId;
    enforceIntegrity(state, new Set());
    state.settings.paused = true; // Unattended execution never resumes merely because the plugin restarted.
    for (const project of state.projects) project.settings.paused = true;
    synchronizeProject(state);
    await this.storage.save(state, null, { fromNotes: state.ideas.filter(idea => !idea.lastError && loaded.notes.find(note => note.id === idea.id)?.projectId).map(idea => idea.id) });
    this.state = state;
    this.emit();
    return { invalidNotes: loaded.invalidNotes };
  }

  get ready(): boolean { return this.state !== null; }
  snapshot(): AppState {
    return structuredClone(omit(this.current(), 'integration', 'ingestMeta', 'manualHolds'));
  }
  internalSnapshot(): InternalState { return structuredClone(this.current()); }
  integrationSnapshot(): InternalState['integration'] { return { ...this.current().integration }; }
  pendingBotReply(): InternalState['botReplies'][number] | undefined {
    const reply = this.current().botReplies.find(reply => reply.status === 'pending'); return reply ? structuredClone(reply) : undefined;
  }
  recurringSnapshot(): { messages: InternalState['streamMessages']; pending: boolean } {
    const state = this.current(); return { messages: structuredClone(state.streamMessages), pending: state.botReplies.some(reply => Boolean(reply.streamMessageId) && reply.status === 'pending') };
  }

  transaction<T>(mutate: (state: InternalState) => T, options: SaveOptions = {}): Promise<T> {
    const work = this.pending.then(async () => {
      const previous = this.current();
      const next = structuredClone(previous);
      const result = mutate(next);
      const { events, fromNotes } = prepareStudioCommit(previous, next, options);
      await this.storage.save(next, previous, { ...options, ...(fromNotes ? { fromNotes } : {}) });
      this.state = next;
      this.events.publish(events, ++this.revision);
      this.emit();
      return result;
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
    if (!this.listeners.size) return;
    const snapshot = this.snapshot();
    for (const listener of this.listeners) this.deliverState(listener, snapshot);
  }
}
