import { errorMessage } from '../domain/errors';
import { omit } from '../domain/objects';
import type { PersistedStudio } from '../domain/persisted';
import { createEmptyState, defaultIntegration, defaultRuntime } from '../domain/seed';
import type { Activity, AppState, Idea } from '../domain/types';
import type { InternalState, LoadedStudio, NoteIdea, SaveOptions, StudioStorage } from './ports';

export function addEvent(state: InternalState, type: Activity['type'], text: string, ideaId?: string): void {
  state.events.push({ id: crypto.randomUUID(), type, text, ...(ideaId ? { ideaId } : {}), createdAt: new Date().toISOString() });
}

/** Joins idea notes with the votes and increments kept in plugin data. */
export function assemble(loaded: LoadedStudio): InternalState {
  const data: PersistedStudio = loaded.data ?? { ...createEmptyState(), integration: defaultIntegration(), votes: {}, increments: {}, ingestMeta: { processedMessages: [], lastRequests: {} }, manualHolds: [] };
  const ids = new Set<string>();
  const ideas: Idea[] = loaded.notes.map(note => {
    if (ids.has(note.id)) throw new Error(`Two notes use the idea ID ${note.id}. Rename or remove one of them.`);
    ids.add(note.id);
    const increment = data.increments[note.id];
    return { ...note, voters: [...new Set(data.votes[note.id] ?? [])], ...(increment ? { increment } : {}) };
  }).sort((a, b) => a.number - b.number);
  const nextIdeaNumber = Math.max(data.nextIdeaNumber, ...ideas.map(idea => idea.number + 1));
  const rest = omit(data, 'votes', 'increments');
  return { ...rest, nextIdeaNumber, ideas, runtime: defaultRuntime() };
}

/** Applies an edit made directly to an idea note, keeping plugin-owned votes and increments. */
export function mergeNote(state: InternalState, note: NoteIdea): boolean {
  const index = state.ideas.findIndex(idea => idea.id === note.id);
  const current = state.ideas[index];
  if (current) {
    const { voters, increment, ...known } = current;
    if (JSON.stringify(known) === JSON.stringify(note)) return false;
    state.ideas[index] = { ...note, voters, ...(increment ? { increment } : {}) };
  } else {
    state.ideas.push({ ...note, voters: [] });
    state.nextIdeaNumber = Math.max(state.nextIdeaNumber, note.number + 1);
  }
  return true;
}

type Listener = (state: AppState) => void;

/** Serialized transactions over a cloned state: a failed write leaves the committed state unchanged. */
export class StudioStore {
  private state: InternalState | null = null;
  private pending: Promise<unknown> = Promise.resolve();
  private readonly listeners = new Set<Listener>();
  constructor(private readonly storage: StudioStorage) {}

  async init(): Promise<{ invalidNotes: string[] }> {
    let loaded: LoadedStudio;
    try { loaded = await this.storage.load(); }
    catch (error) { throw new Error(`CoForge could not load its data. The stored files were preserved. ${errorMessage(error)}`); }
    const state = assemble(loaded);
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
    state.settings.paused = true; // Unattended execution never resumes merely because the plugin restarted.
    await this.storage.save(state, null, { fromNotes: state.ideas.filter(idea => !idea.lastError).map(idea => idea.id) });
    this.state = state;
    this.emit();
    return { invalidNotes: loaded.invalidNotes };
  }

  get ready(): boolean { return this.state !== null; }
  snapshot(): AppState {
    return structuredClone(omit(this.current(), 'integration', 'ingestMeta', 'manualHolds'));
  }
  internalSnapshot(): InternalState { return structuredClone(this.current()); }

  transaction<T>(mutate: (state: InternalState) => T, options: SaveOptions = {}): Promise<T> {
    const work = this.pending.then(async () => {
      const previous = this.current();
      const next = structuredClone(previous);
      const result = mutate(next);
      next.events = next.events.slice(-500);
      next.chat = next.chat.slice(-250);
      next.jobs = next.jobs.slice(-500);
      next.ingestMeta.processedMessages = next.ingestMeta.processedMessages.slice(-10000);
      await this.storage.save(next, previous, options);
      this.state = next;
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
    if (this.state) listener(this.snapshot());
    return () => { this.listeners.delete(listener); };
  }

  async flush(): Promise<void> { await this.pending; }

  private current(): InternalState {
    if (!this.state) throw new Error('CoForge is still loading.');
    return this.state;
  }
  private emit(): void {
    if (!this.listeners.size) return;
    const snapshot = this.snapshot();
    for (const listener of this.listeners) listener(snapshot);
  }
}
