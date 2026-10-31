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
  /** Atomically commit command note effects with wallet, receipts and frozen rewards. */
  atomicCommand?: true;
  requestValuesEdit?: { ideaId: string; expectedInputIdentity: string };
  /** Exact whole-note fingerprints reviewed before removing example requests. */
  exampleCleanup?: { notes: Record<string, string> };
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
  previewExampleNotes?(ids: readonly string[]): Promise<Record<string, string>>;
  exampleCleanupWarning?(): string | undefined;
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
export interface ManagedNoteFolderPolicy {
  assertAvailable(folders: readonly string[]): void;
  reserve(folders: readonly string[]): () => void;
}
export interface StudioHost {
  outputTemplates?: import('./workflow-output-templates').WorkflowOutputTemplateActions;
  agentTasks?: import('./agent-task').AgentTaskPort;
  /** Private immutable reward tickets are reserved before command effects. */
  economyReservations?: import("../domain/command-economy").EconomyReservationPort;
  /** A host publication lease spans persistence and notification, including initialization. */
  beforeCommit?(next: AppState, previous: AppState | null): Promise<void | (() => void)>;
  assertExampleCleanup?(ideaIds: readonly string[]): void | (() => void) | Promise<void | (() => void)>;
  privateFolders?(): readonly string[];
  /** Keep canonical note owners separate without restricting ordinary watched source notes. */
  noteFolders?: Partial<ManagedNoteFolderPolicy>;
  assertWorkflowReviewable?(workspaceId: string, expectedIncrement: Increment): Promise<void>;
  runners: { demo: StageRunner; claude: StageRunner; codex?: StageRunner; herdr?: StageRunner; mcp?: StageRunner };
  timers: Timers;
  probeRuntime(integration: IntegrationSettings): Promise<Pick<RuntimeInfo, 'cliAvailable' | 'codexAvailable' | 'projectPath' | 'allowImplementation'>>;
  report?(error: Error): void;
  events?: import('./studio-events').StudioEventSink;
  observerFailed?(): void;
}

/** Host operations the CoForge views may request. Secrets can be written but never read back by a view. */
export interface StudioHostActions {
  outputTemplates?: import('./workflow-output-templates').WorkflowOutputTemplateActions;
  serviceDesign?: import('../../service-design/domain/blueprint').ServiceDesignActions;
  obsProduction?: import('./obs-production-workflow').ObsProductionActions;
  obsShow?: import('./obs-show-ports').ObsShowActions;
  obsSetup?: import('./obs-setup-workflow').ObsSetupActions;
  obsOverlays?: import('./obs-overlay-workflow').ObsOverlayActions;
  /** Relative vault file names for explicit link authoring; never returns file contents. */
  listVaultFiles?(): Promise<string[]>;
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
  alerts?: import('./alerts-ports').AlertsActions;
  finance?: import('./finance-ports').FinanceActions;
  previewFinance?(): import('./finance-ports').FinanceActions;
  herdr?: import('./herdr-ports').HerdrActions;
  previewHerdr?(): import('./herdr-ports').HerdrActions;
  previewLiveStudio?(): import('./studio-example').StudioExample;
  obsScenes?: import('../domain/obs-scenes').ObsSceneActions;
  previewStreamStatistics?(): import('../domain/stream-metrics').StreamHistory[];
  /** Browser-only temporary service disposal; never a vault or live integration mutation. */
  discardPreview?(example: "finance" | "ai-costs" | "schedule" | "statistics" | "live-studio" | "council" | "herdr" | "task-scheduler"): void;
  streamHistory?: import('./stream-metrics-ports').StreamHistoryActions;
  obs?: import('../domain/obs').ObsActions;
  twitch?: import('../domain/twitch').TwitchActions;
  twitchOperations?: import('../domain/twitch-operations').TwitchOperationsActions;
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
