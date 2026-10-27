import { errorMessage } from '../domain/errors';
import { ideaFingerprint, needsVerification, quarantine } from '../domain/integrity';
import { omit } from '../domain/objects';
import type { PersistedStudio } from '../domain/persisted';
import { createEmptyState, defaultIntegration, defaultRuntime, defaultSettings } from '../domain/seed';
import { copySettings, initialProject, INITIAL_PROJECT_ID, projectPaths, synchronizeProject } from '../domain/projects';
import type { Activity, AppState, Idea } from '../domain/types';
import type { InternalState, LoadedStudio, NoteIdea, SaveOptions, StudioStorage } from './ports';

export function addEvent(state: InternalState, type: Activity['type'], text: string, ideaId?: string): void {
  state.events.push({ id: crypto.randomUUID(), type, text, ...(ideaId ? { ideaId } : {}), createdAt: new Date().toISOString() });
}

/** Joins idea notes with the votes and increments kept in plugin data. */
export function assemble(loaded: LoadedStudio): InternalState {
  const data: PersistedStudio = loaded.data ?? { ...createEmptyState(), integration: defaultIntegration(), votes: {}, increments: {}, ingestMeta: { processedMessages: [], lastRequests: {} }, manualHolds: [], integrity: {} };
  const projects = [...(loaded.projects ?? [])];
  const legacy = data.activeProjectId === undefined && data.nextProjectNumber === undefined;
  if (legacy && (loaded.data || loaded.notes.some(note => !note.projectId)) && !projects.some(project => project.id === INITIAL_PROJECT_ID))
    projects.unshift(initialProject(data.settings, data.integration, new Date().toISOString()));
  const integrity = { ...data.integrity };
  const ids = new Set<string>();
  const ideas: Idea[] = loaded.notes.map(note => {
    if (ids.has(note.id)) throw new Error(`Two notes use the idea ID ${note.id}. Rename or remove one of them.`);
    ids.add(note.id);
    const increment = data.increments[note.id];
    const idea = { ...note, projectId: note.projectId ?? INITIAL_PROJECT_ID, voters: [...new Set(data.votes[note.id] ?? [])], ...(increment ? { increment } : {}) };
    if (!note.projectId && integrity[note.id] === ideaFingerprint(note)) integrity[note.id] = ideaFingerprint(idea);
    return idea;
  }).sort((a, b) => a.number - b.number);
  const nextIdeaNumber = Math.max(data.nextIdeaNumber, ...ideas.map(idea => idea.number + 1));
  const rest = omit(data, 'votes', 'increments');
  const activeProjectId = data.activeProjectId || projects[0]?.id || '';
  for (const id of new Set([activeProjectId, ...ideas.map(idea => idea.projectId ?? INITIAL_PROJECT_ID)].filter(Boolean))) {
    if (!projects.some(project => project.id === id)) projects.push({
      ...initialProject({ ...data.settings, projectName: `Missing project note (${id})`, paused: true }, defaultIntegration(), new Date().toISOString()), id, unavailable: true,
    });
  }
  const selected = projects.find(project => project.id === activeProjectId);
  const nextProjectNumber = Math.max(data.nextProjectNumber ?? 1, ...projects.map(project => Number(project.id.match(/^CFP-(\d+)$/)?.[1] ?? 0) + 1));
  for (const job of rest.jobs) job.projectId ??= ideas.find(idea => idea.id === job.ideaId)?.projectId ?? INITIAL_PROJECT_ID;
  const botReplies = (data.botReplies ?? []).map(reply => reply.status === 'sending'
    ? { ...reply, status: 'uncertain' as const, error: 'The previous session ended before delivery was confirmed. This reply will not be resent automatically.' } : reply);
  return { ...rest, botReplies, integrity, nextIdeaNumber, nextProjectNumber, ideas, projects, activeProjectId,
    settings: copySettings(selected?.settings ?? data.settings), integration: { ...data.integration, ...(selected ? projectPaths(selected) : {}) }, runtime: defaultRuntime() };
}

/** Applies an edit made directly to an idea note, keeping plugin-owned votes and increments. */
/**
 * Verifies ideas that came from the vault against the fingerprints of what CoForge last wrote, quarantines any
 * changed or unknown idea past the inbox, then records fresh fingerprints for every idea. Returns quarantined IDs.
 */
export function enforceIntegrity(state: InternalState, external: ReadonlySet<string> | 'all'): string[] {
  const quarantined: string[] = [];
  for (const idea of state.ideas) {
    if (external !== 'all' && !external.has(idea.id)) continue;
    if (!needsVerification(idea) || state.integrity[idea.id] === ideaFingerprint(idea)) continue;
    quarantine(idea);
    quarantined.push(idea.id);
    addEvent(state, 'system', `${idea.id} was changed or added outside CoForge after screening. It is back in the inbox for a new screening.`, idea.id);
  }
  state.integrity = Object.fromEntries(state.ideas.map(idea => [idea.id, ideaFingerprint(idea)]));
  return quarantined;
}

export function mergeNote(state: InternalState, note: NoteIdea): boolean {
  note = { ...note, projectId: note.projectId ?? INITIAL_PROJECT_ID };
  if (!state.projects.some(project => project.id === note.projectId)) {
    state.projects.push({ ...initialProject({ ...defaultSettings(), projectName: `Missing project note (${note.projectId})` }, defaultIntegration(), new Date().toISOString()),
      id: note.projectId!, unavailable: true });
    state.nextProjectNumber = Math.max(state.nextProjectNumber, Number(note.projectId!.slice(4)) + 1);
  }
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

  transaction<T>(mutate: (state: InternalState) => T, options: SaveOptions = {}): Promise<T> {
    const work = this.pending.then(async () => {
      const previous = this.current();
      const next = structuredClone(previous);
      const result = mutate(next);
      synchronizeProject(next);
      // Ideas merged from the vault are verified; changes CoForge made itself become the new trusted fingerprints.
      const quarantined = enforceIntegrity(next, new Set(options.fromNotes ?? []));
      const fromNotes = options.fromNotes?.filter(id => !quarantined.includes(id));
      next.events = next.events.slice(-500);
      next.chat = next.chat.slice(-250);
      next.jobs = next.jobs.slice(-500);
      const activeReplies = next.botReplies.filter(reply => reply.status === 'pending' || reply.status === 'sending');
      next.botReplies = [...next.botReplies.filter(reply => reply.status !== 'pending' && reply.status !== 'sending').slice(-200), ...activeReplies];
      next.ingestMeta.processedMessages = next.ingestMeta.processedMessages.slice(-10000);
      await this.storage.save(next, previous, { ...options, ...(fromNotes ? { fromNotes } : {}) });
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
