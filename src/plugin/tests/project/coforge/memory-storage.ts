import type { InternalState, LoadedStudio, NoteIdea, StudioStorage, Timers } from '../../../features/coforge/application/ports';
import { StudioStore } from '../../../features/coforge/application/studio-store';
import { noteOnly } from '../../../features/coforge/domain/objects';
import type { PersistedStudio } from '../../../features/coforge/domain/persisted';
import { createEmptyState, createSeed, defaultIntegration } from '../../../features/coforge/domain/seed';
import type { AppState } from '../../../features/coforge/domain/types';

/** Splits a full state into what the vault storage would keep: idea notes plus the plugin-data file. */
export function toLoaded(state: AppState | InternalState): LoadedStudio {
  const notes: NoteIdea[] = state.ideas.map(noteOnly);
  const internal = state as Partial<InternalState>;
  const data: PersistedStudio = {
    version: 1, nextIdeaNumber: state.nextIdeaNumber, contributors: state.contributors, chat: state.chat, jobs: state.jobs, events: state.events,
    settings: state.settings, integration: internal.integration ?? defaultIntegration(),
    votes: Object.fromEntries(state.ideas.map(idea => [idea.id, idea.voters])),
    increments: Object.fromEntries(state.ideas.flatMap(idea => idea.increment ? [[idea.id, idea.increment] as const] : [])),
    ingestMeta: internal.ingestMeta ?? { processedMessages: [], lastRequests: {} }, manualHolds: internal.manualHolds ?? [],
  };
  return structuredClone({ data, notes, invalidNotes: [] });
}

/** In-memory canonical storage for application tests; `reload()` simulates a plugin restart. */
export class MemoryStorage implements StudioStorage {
  saves = 0;
  failNextSave = false;
  private loaded: LoadedStudio;
  constructor(initial: AppState | null = null) { this.loaded = initial ? toLoaded(initial) : { data: null, notes: [], invalidNotes: [] }; }
  async load(): Promise<LoadedStudio> { return structuredClone(this.loaded); }
  async save(next: InternalState): Promise<void> {
    if (this.failNextSave) { this.failNextSave = false; throw new Error('Disk full'); }
    this.loaded = toLoaded(next);
    this.saves++;
  }
}

export async function seededStore(state: AppState = createSeed()): Promise<{ store: StudioStore; storage: MemoryStorage }> {
  const storage = new MemoryStorage(state);
  const store = new StudioStore(storage);
  await store.init();
  return { store, storage };
}

export async function emptyStore(): Promise<{ store: StudioStore; storage: MemoryStorage }> {
  return seededStore({ ...createEmptyState(), nextIdeaNumber: 1 });
}

/** Node timers behind the numeric handles the studio's Timers port uses. */
export function nodeTimers(): Timers {
  const handles = new Map<number, ReturnType<typeof setTimeout>>();
  let next = 1;
  const add = (handle: ReturnType<typeof setTimeout>) => { handles.set(next, handle); return next++; };
  const clear = (id: number) => { clearTimeout(handles.get(id)); handles.delete(id); };
  return {
    setTimeout: (callback, ms) => add(setTimeout(callback, ms)), clearTimeout: clear,
    setInterval: (callback, ms) => add(setInterval(callback, ms)), clearInterval: clear,
  };
}
