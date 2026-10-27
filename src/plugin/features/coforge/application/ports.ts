import type { IngestMeta, PersistedStudio } from '../domain/persisted';
import type {
  AgentStage, AppState, Idea, ImplementationPlan, Increment, IntegrationSettings, RiceScore, RuntimeInfo, Screening, Settings, StudioProject,
} from '../domain/types';

/** Full in-memory studio state. Only `AppState` is exposed to views. */
export interface InternalState extends AppState {
  projects: StudioProject[]; activeProjectId: string; nextProjectNumber: number;
  botReplies: import('../domain/twitch').BotReply[];
  population: import('../domain/population').PopulationState;
  streamMessages: import('../domain/stream-messages').StreamMessage[];
  integration: IntegrationSettings; ingestMeta: IngestMeta; manualHolds: string[];
  /** Fingerprints of the trusted idea content CoForge last wrote (see domain/integrity.ts). */
  integrity: Record<string, string>;
}
export type NoteIdea = Omit<Idea, 'voters' | 'increment'>;

export interface LoadedStudio { data: PersistedStudio | null; notes: NoteIdea[]; invalidNotes: string[]; projects?: StudioProject[] }
export interface SaveOptions {
  /** Ideas whose note already holds the new values (external edits): do not write them back. */
  fromNotes?: readonly string[];
  /** Every idea was replaced (sample workspace): retire all previous notes, even when an ID is reused. */
  replaceAll?: boolean;
  replaceProjectId?: string;
  fromProjects?: readonly string[];
}

/**
 * Canonical storage: idea notes in the vault plus one plugin-data file for everything else.
 * `load` reads the data file first and then the notes in its configured ideas folder.
 */
export interface StudioStorage {
  load(): Promise<LoadedStudio>;
  save(next: InternalState, previous: InternalState | null, options?: SaveOptions): Promise<void>;
}

export type ExternalNoteChange = { kind: 'upsert'; idea: NoteIdea } | { kind: 'remove'; id: string };

export interface StageResult { screening?: Screening; rice?: RiceScore; plan?: ImplementationPlan; increment?: Increment; costUsd?: number }
export interface StageInput { stage: AgentStage; idea: Idea; settings: Settings; integration: IntegrationSettings; signal?: AbortSignal; onLog?: (message: string) => void }
export type StageRunner = (input: StageInput) => Promise<StageResult>;

/** Host timers (Obsidian window timers in the plugin) keep pure code popout-safe and testable. */
export interface Timers {
  setTimeout(callback: () => void, ms: number): number;
  clearTimeout(handle: number): void;
  setInterval(callback: () => void, ms: number): number;
  clearInterval(handle: number): void;
}

/** Host capabilities the studio needs but must not implement itself. */
export interface StudioHost {
  runners: { demo: StageRunner; claude: StageRunner };
  timers: Timers;
  probeRuntime(integration: IntegrationSettings): Promise<Pick<RuntimeInfo, 'cliAvailable' | 'projectPath' | 'allowImplementation'>>;
  report?(error: Error): void;
  events?: import('./studio-events').StudioEventSink;
  observerFailed?(): void;
}

/** Host operations the CoForge views may request. Secrets can be written but never read back by a view. */
export interface StudioHostActions {
  twitch?: import('../domain/twitch').TwitchActions;
  diagnostics?(): string;
  exportDiagnostics?(): Promise<string>;
  setSecret(name: string, value: string): boolean;
  hasSecret(name: string): boolean;
  openIdeaNote(id: string): Promise<boolean>;
  saveExport(json: string): Promise<string>;
  /** Writes the public viewer board into the vault; resolves to the folder and whether files changed. */
  publishBoard(): Promise<{ folder: string; changed: boolean }>;
  /** Writes the GitHub Pages workflow into the vault repository and publishes the board once. */
  installPagesWorkflow(): Promise<{ workflow: string; folder: string; created: boolean }>;
}
