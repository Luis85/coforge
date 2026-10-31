/** CoForge domain contracts. Ported from the local prototype's src/shared/types.ts. */
export type IdeaStatus = 'inbox' | 'screened' | 'ranked' | 'planned' | 'building' | 'review' | 'shipped' | 'flagged' | 'rejected';
export type AgentStage = 'screen' | 'score' | 'plan' | 'implement';
export type Provider = 'demo' | 'claude' | 'herdr' | 'codex';
/** Bounded at note/input boundaries and checked against each new request's captured taxonomy. */
export type Category = string;
export type ExecutionProvider = Provider | 'mcp';
/** Contributor colours are Obsidian palette names (`--color-<name>`), never raw colour literals. */
export type ContributorColor = 'purple' | 'orange' | 'green' | 'yellow' | 'blue' | 'pink' | 'cyan' | 'red';
export const CONTRIBUTOR_COLORS: readonly ContributorColor[] = ['purple', 'orange', 'green', 'yellow', 'blue', 'pink', 'cyan', 'red'];

export interface RiceScore { reach: number; impact: number; confidence: number; effort: number; score: number; rationale: string }
export interface Screening { verdict: 'clear' | 'flagged'; reason: string; signals: string[]; checkedAt: string; provider: ExecutionProvider }
export interface ImplementationPlan { summary: string; steps: string[]; acceptanceCriteria: string[]; risks: string[]; markdown: string; createdAt: string }
export interface FileChange { path: string; additions: number; deletions: number }
export interface Increment {
  summary: string; files: FileChange[]; tests: string[]; diff: string;
  branch?: string; worktree?: string; commit?: string; createdAt: string; simulated: boolean;
}
export interface Idea {
  requestObject?: import('./request-object').RequestObjectSnapshot;
  workflowRun?: import('./configured-workflow-run').WorkflowRun;
  workflowHistory?: import('./configured-workflow-run').WorkflowRun[];
  contexts?: import('./idea-context').IdeaContext[];
  id: string; number: number; title: string; description: string; authorId: string; category: Category; status: IdeaStatus;
  /** Absent only on legacy notes, which migrate to the initial project. */
  projectId?: string;
  requestKind?: 'feature' | 'bug';
  voters: string[]; createdAt: string; updatedAt: string;
  screening?: Screening; rice?: RiceScore; plan?: ImplementationPlan; increment?: Increment; reviewNote?: string; lastError?: string;
}
export interface Contributor { id: string; name: string; color: ContributorColor; joinedAt: string }
export type ChatSource = 'simulator' | 'twitch' | 'api';
export interface ChatMessage {
  id: string; userId: string; username: string; text: string; createdAt: string;
  kind: 'message' | 'request' | 'context' | 'vote' | 'system' | 'error'; ideaId?: string; source: ChatSource;
  externalId?: string;
  twitchChannelId?: string;
}
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
export interface AgentJob {
  conversation?: import('./agent-conversation').AgentConversation;
  workflow?: import('./configured-workflow-run').ConfiguredStepExecution;
  usage?: import('./ai-usage').StageUsage;
  herdrAgent?: 'claude';
  model?: string;
  id: string; ideaId: string; stage: AgentStage; status: JobStatus; provider: ExecutionProvider;
  projectId?: string;
  startedAt: string; finishedAt?: string; logs: string[]; error?: string; costUsd?: number;
}
export interface Activity { id: string; ideaId?: string; type: 'idea' | 'vote' | 'agent' | 'review' | 'system'; text: string; createdAt: string }
export interface Settings {
  requestObject?: import('./request-object').RequestObjectDefinition;
  workflow?: import('./configured-workflow').WorkflowDefinition;
  herdrAgent?: 'claude';
  stageAgents?: import('./stage-agents').StageAgents;
  stagePrompts?: import('./stage-prompts').StagePrompts;
  agentPrompt: string;
  projectName: string; projectBrief: string; provider: Provider; automation: Record<AgentStage, boolean>; paused: boolean;
  intervalSeconds: number; minVotes: number; maxTurns: number; maxBudgetUsd: number; timeoutSeconds: number; model: string;
  requestCooldownSeconds: number;
}
export interface RuntimeInfo {
  codexAvailable?: boolean;
  obsProduction?: import('./obs-production').ObsProductionSnapshot;
  /** Transient fail-closed publication holds; only an explicit public reconciliation clears them. */
  publicationDeniedProjectIds?: string[];
  herdrWorkflow?: { ready: boolean; busy: boolean; message: string };
  liveStudio?: import('./live-studio').LiveStudioState;
  streamRecording?: import('./stream-metrics').StreamRecordingState;
  obs?: import('./obs').ObsPublicState;
  cliAvailable: boolean; projectPath: string | null; allowImplementation: boolean;
  chatSource: 'simulator' | 'twitch'; chatStatus: string; activeJobId?: string;
  twitch?: import('./twitch').TwitchState;
}
export interface StudioProject {
  /** Individual workspace choices; missing keeps every existing capability. */
  features?: import('./project-features').ProjectFeature[];
  /** Workspace visibility only; shared services keep running. Missing means all groups. */
  featureGroups?: import('./project-feature-groups').ProjectFeatureGroup[];
  /** Missing legacy visibility means public. Private projects never enter viewer projections. */
  visibility?: import('./project-publicity').ProjectVisibility;
  id: string; settings: Settings; projectPath: string; worktreeFolder: string; allowImplementation: boolean;
  repositoryUrl: string; websiteUrl: string;
  createdAt: string; updatedAt: string;
  /** A referenced project note is missing or invalid; never dispatch work for it. */
  unavailable?: boolean;
}
export interface AppState {
  /** Durable operator stop policy; only the host's explicit Restart control releases an ID. */
  workflowStopHolds?: string[];
  obsShow?: import('./obs-show').ObsShowState;
  obsSetup?: import('./obs-setup').ObsSetupState;
  twitchOperations?: import('./twitch-operations').TwitchOperationsState;
  /** Private entrypoint-assigned provenance. Provider choice never implies sample content. */
  requestOrigins?: Record<string, import('./example-content').RequestOrigin>;
  /** Committed cleanup cutoff per request ID; newer generations keep their own cost history. */
  exampleRemovalCutoffs?: Record<string, string>;
  sampleEventIds?: string[];
  sampleCreatedProjectIds?: string[];
  setupGuide?: import('./stream-setup').StreamSetupState;
  obsSettings?: import('./obs').ObsSettings;
  obsCommand?: import('./obs').ObsCommand;
  obsResumeSceneId?: string;
  version: 1; nextIdeaNumber: number; ideas: Idea[]; contributors: Contributor[]; chat: ChatMessage[];
  jobs: AgentJob[]; events: Activity[]; settings: Settings; runtime: RuntimeInfo;
  /** Optional on legacy input only. The application store always supplies these fields. */
  projects?: StudioProject[]; activeProjectId?: string; nextProjectNumber?: number;
  botReplies?: import('./twitch').BotReply[];
  population?: import('./population').PopulationState;
  streamMessages?: import('./stream-messages').StreamMessage[];
}
/** Host-side configuration that replaced the prototype's .env file. Secrets are referenced by name only. */
export interface IntegrationSettings {
  codexBin?: string;
  ideasFolder: string; claudeBin: string; projectPath: string; allowImplementation: boolean; worktreeFolder: string;
  twitchEnabled: boolean; twitchClientId: string; twitchBotUserId: string; twitchBroadcasterId: string; twitchTokenSecret: string;
  twitchStreamerSecret: string; twitchBotUsesStreamer: boolean; twitchBotReplies: boolean;
  /** Vault folder for the public viewer board (static site + board.json), deployed to GitHub Pages from main. */
  publicFolder: string; publicBoardEnabled: boolean;
}
export type IdeaAction = AgentStage | 'approve' | 'changes' | 'reject' | 'unflag';

export const STAGES: readonly AgentStage[] = ['screen', 'score', 'plan', 'implement'];
export const STAGE_LABELS: Record<AgentStage, string> = { screen: 'Screen', score: 'Score', plan: 'Plan', implement: 'Build' };
export const STATUS_LABELS: Record<IdeaStatus, string> = {
  inbox: 'Inbox', screened: 'Screened', ranked: 'Ranked', planned: 'Planned', building: 'Building',
  review: 'In review', shipped: 'Accepted', flagged: 'Flagged', rejected: 'Archived',
};
export const IDEA_STATUSES = Object.keys(STATUS_LABELS) as IdeaStatus[];
export const CATEGORIES: Category[] = ['Gameplay', 'World', 'Quality of life', 'Art & audio', 'Community'];

export const riceValue = (r: Pick<RiceScore, 'reach' | 'impact' | 'confidence' | 'effort'>): number =>
  r.effort > 0 ? Math.round(((r.reach * r.impact * r.confidence) / r.effort) * 10) / 10 : 0;

export const rankedIdeas = (ideas: readonly Idea[]): Idea[] =>
  [...ideas].sort((a, b) => (b.rice?.score ?? 0) - (a.rice?.score ?? 0) || b.voters.length - a.voters.length || a.createdAt.localeCompare(b.createdAt));

export const ideaIdFor = (number: number): string => `CF-${String(number).padStart(3, '0')}`;

export function planMarkdown(plan: Pick<ImplementationPlan, 'summary' | 'steps' | 'acceptanceCriteria' | 'risks'>, title = 'Implementation plan'): string {
  const risks = plan.risks.length ? plan.risks.map(text => `- ${text}`).join('\n') : '- None identified by the agent; human review is still required.';
  return `# ${title}\n\n${plan.summary}\n\n## Steps\n\n${plan.steps.map((text, i) => `${i + 1}. ${text}`).join('\n')}\n\n`
    + `## Acceptance criteria\n\n${plan.acceptanceCriteria.map(text => `- [ ] ${text}`).join('\n')}\n\n## Risks and open questions\n\n${risks}\n`;
}
