import type { IngestMeta, PersistedStudio } from '../domain/persisted';
import type {
  AgentStage, AppState, Idea, ImplementationPlan, Increment, IntegrationSettings, RiceScore, RuntimeInfo, Screening, Settings,
} from '../domain/types';

/** Full in-memory studio state. Only `AppState` is exposed to views. */
export interface InternalState extends AppState { integration: IntegrationSettings; ingestMeta: IngestMeta; manualHolds: string[] }
export type NoteIdea = Omit<Idea, 'voters' | 'increment'>;

export interface LoadedStudio { data: PersistedStudio | null; notes: NoteIdea[]; invalidNotes: string[] }
export interface SaveOptions { /** Ideas whose note already holds the new values (external edits): do not write them back. */ fromNotes?: readonly string[] }

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

/** Host capabilities the studio needs but must not implement itself. */
export interface StudioHost {
  runners: { demo: StageRunner; claude: StageRunner };
  probeRuntime(integration: IntegrationSettings): Promise<Pick<RuntimeInfo, 'cliAvailable' | 'projectPath' | 'allowImplementation'>>;
  report?(error: Error): void;
}

/** Host operations the CoForge views may request. Secrets can be written but never read back by a view. */
export interface StudioHostActions {
  setSecret(name: string, value: string): boolean;
  hasSecret(name: string): boolean;
  openIdeaNote(id: string): Promise<boolean>;
  saveExport(json: string): Promise<string>;
}
