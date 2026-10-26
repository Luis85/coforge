/** CoForge domain contracts. Ported from the local prototype's src/shared/types.ts. */
export type IdeaStatus = 'inbox' | 'screened' | 'ranked' | 'planned' | 'building' | 'review' | 'shipped' | 'flagged' | 'rejected';
export type AgentStage = 'screen' | 'score' | 'plan' | 'implement';
export type Provider = 'demo' | 'claude';
export type Category = 'Gameplay' | 'World' | 'Quality of life' | 'Art & audio' | 'Community';
/** Contributor colours are Obsidian palette names (`--color-<name>`), never raw colour literals. */
export type ContributorColor = 'purple' | 'orange' | 'green' | 'yellow' | 'blue' | 'pink' | 'cyan' | 'red';
export const CONTRIBUTOR_COLORS: readonly ContributorColor[] = ['purple', 'orange', 'green', 'yellow', 'blue', 'pink', 'cyan', 'red'];

export interface RiceScore { reach: number; impact: number; confidence: number; effort: number; score: number; rationale: string }
export interface Screening { verdict: 'clear' | 'flagged'; reason: string; signals: string[]; checkedAt: string; provider: Provider }
export interface ImplementationPlan { summary: string; steps: string[]; acceptanceCriteria: string[]; risks: string[]; markdown: string; createdAt: string }
export interface FileChange { path: string; additions: number; deletions: number }
export interface Increment {
  summary: string; files: FileChange[]; tests: string[]; diff: string;
  branch?: string; worktree?: string; commit?: string; createdAt: string; simulated: boolean;
}
export interface Idea {
  id: string; number: number; title: string; description: string; authorId: string; category: Category; status: IdeaStatus;
  /** Absent only on legacy notes, which migrate to the initial project. */
  projectId?: string;
  voters: string[]; createdAt: string; updatedAt: string;
  screening?: Screening; rice?: RiceScore; plan?: ImplementationPlan; increment?: Increment; reviewNote?: string; lastError?: string;
}
export interface Contributor { id: string; name: string; color: ContributorColor; joinedAt: string }
export type ChatSource = 'simulator' | 'twitch' | 'api';
export interface ChatMessage {
  id: string; userId: string; username: string; text: string; createdAt: string;
  kind: 'message' | 'request' | 'vote' | 'system' | 'error'; ideaId?: string; source: ChatSource;
}
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
export interface AgentJob {
  id: string; ideaId: string; stage: AgentStage; status: JobStatus; provider: Provider;
  projectId?: string;
  startedAt: string; finishedAt?: string; logs: string[]; error?: string; costUsd?: number;
}
export interface Activity { id: string; ideaId?: string; type: 'idea' | 'vote' | 'agent' | 'review' | 'system'; text: string; createdAt: string }
export interface Settings {
  projectName: string; projectBrief: string; provider: Provider; automation: Record<AgentStage, boolean>; paused: boolean;
  intervalSeconds: number; minVotes: number; maxTurns: number; maxBudgetUsd: number; timeoutSeconds: number; model: string;
  requestCooldownSeconds: number;
}
export interface RuntimeInfo {
  cliAvailable: boolean; projectPath: string | null; allowImplementation: boolean;
  chatSource: 'simulator' | 'twitch'; chatStatus: string; activeJobId?: string;
}
export interface StudioProject {
  id: string; settings: Settings; projectPath: string; worktreeFolder: string; allowImplementation: boolean;
  repositoryUrl: string; websiteUrl: string;
  createdAt: string; updatedAt: string;
  /** A referenced project note is missing or invalid; never dispatch work for it. */
  unavailable?: boolean;
}
export interface AppState {
  version: 1; nextIdeaNumber: number; ideas: Idea[]; contributors: Contributor[]; chat: ChatMessage[];
  jobs: AgentJob[]; events: Activity[]; settings: Settings; runtime: RuntimeInfo;
  /** Optional on legacy input only. The application store always supplies these fields. */
  projects?: StudioProject[]; activeProjectId?: string; nextProjectNumber?: number;
}
/** Host-side configuration that replaced the prototype's .env file. Secrets are referenced by name only. */
export interface IntegrationSettings {
  ideasFolder: string; claudeBin: string; projectPath: string; allowImplementation: boolean; worktreeFolder: string;
  twitchEnabled: boolean; twitchClientId: string; twitchBotUserId: string; twitchBroadcasterId: string; twitchTokenSecret: string;
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
