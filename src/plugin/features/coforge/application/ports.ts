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

export interface StageResult { markdown?: string; summary?: string; screening?: Screening; rice?: RiceScore; plan?: ImplementationPlan; increment?: Increment; costUsd?: number; usage?: import('../domain/ai-usage').StageUsage }
export interface StageInput { workflow?: import('../domain/configured-workflow-run').ConfiguredStepExecution; onChanges?: (increment: Increment | null) => Promise<void>; onWorkspace?: (workspaceId: string) => Promise<void>; jobId?: string; stage: AgentStage; idea: Idea; settings: Settings; integration: IntegrationSettings; signal?: AbortSignal; onLog?: (message: string) => void; onUsage?: (costUsd: number) => Promise<void>; onTokenUsage?: (usage: import('../domain/ai-usage').StageUsage) => Promise<void> }
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
  agentTasks?: import('./agent-task').AgentTaskPort;
  privateFolders?(): readonly string[];
  assertWorkflowReviewable?(workspaceId: string, expectedIncrement: Increment): Promise<void>;
  runners: { demo: StageRunner; claude: StageRunner; herdr?: StageRunner; mcp?: StageRunner };
  timers: Timers;
  probeRuntime(integration: IntegrationSettings): Promise<Pick<RuntimeInfo, 'cliAvailable' | 'projectPath' | 'allowImplementation'>>;
  report?(error: Error): void;
  events?: import('./studio-events').StudioEventSink;
  observerFailed?(): void;
}

/** Host operations the CoForge views may request. Secrets can be written but never read back by a view. */
export interface StudioHostActions {
  workflowTriggers?: import('./workflow-trigger-ports').WorkflowTriggerActions;
  taskScheduler?: import('./task-scheduler-ports').TaskSchedulerActions;
  previewTaskScheduler?(): import('./task-scheduler-ports').TaskSchedulerActions;
  previewWorkflowTriggers?(): import('./workflow-trigger-ports').WorkflowTriggerActions;
  mcp?: import('./mcp-ports').McpActions;
  council?: import('./council-ports').CouncilActions;
  previewCouncil?(): import('./council-ports').CouncilActions;
  herdrWorkflows?: import('./herdr-workflow-ports').HerdrWorkflowActions;
  schedule?: import('./schedule-ports').ScheduleActions;
  previewSchedule?(): import('./schedule-ports').ScheduleActions;
  aiCosts?: import('./ai-cost-ports').AICostActions;
  previewAiCosts?(): import('./ai-cost-ports').AICostActions;
  viewerNotes?: import('./viewer-note-ports').ViewerNoteActions;
  streamViews?: import('./stream-surface-ports').StreamViewActions;
  streamSource?: import('./stream-surface-ports').StreamSurfaceSource;
  finance?: import('./finance-ports').FinanceActions;
  previewFinance?(): import('./finance-ports').FinanceActions;
  herdr?: import('./herdr-ports').HerdrActions;
  previewHerdr?(): import('./herdr-ports').HerdrActions;
  previewMusic?(): import('./music-ports').MusicActions;
  music?: import('./music-ports').MusicActions;
  previewLiveStudio?(): import('./studio-example').StudioExample;
  obsScenes?: import('../domain/obs-scenes').ObsSceneActions;
  previewStreamStatistics?(): import('../domain/stream-metrics').StreamHistory[];
  streamHistory?: import('./stream-metrics-ports').StreamHistoryActions;
  obs?: import('../domain/obs').ObsActions;
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
