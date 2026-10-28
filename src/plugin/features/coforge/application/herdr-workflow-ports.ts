import type { HerdrAgent, HerdrPane, HerdrSettings, HerdrWorkspace } from '../domain/herdr';
import type { AgentStage, Increment } from '../domain/types';
import type { StageInput, StageResult } from './ports';

export interface HerdrWorkflowProfile { access?: import('../domain/configured-workflow').WorkflowAccess; name: string; kind: 'claude'; model: string; stage: AgentStage; resultPath: string; systemPrompt: string; sessionId?: string }
export interface HerdrWorkflowTarget extends HerdrAgent { stateChangeSeq?: number; completionSeq?: number }
export interface HerdrWorkflowGateway {
  createWorkspace(settings: HerdrSettings, cwd: string, label: string, signal?: AbortSignal): Promise<{ workspace: HerdrWorkspace; pane: HerdrPane }>;
  startAgent(settings: HerdrSettings, pane: HerdrPane, profile: HerdrWorkflowProfile, signal?: AbortSignal): Promise<{ agent: HerdrWorkflowTarget; argv: string[] }>;
  inspectAgent(settings: HerdrSettings, target: HerdrWorkflowTarget, signal?: AbortSignal): Promise<HerdrWorkflowTarget>;
  sendPrompt(settings: HerdrSettings, target: HerdrWorkflowTarget, prompt: string, signal?: AbortSignal): Promise<HerdrWorkflowTarget>;
  dispose(): void;
}
export interface HerdrAttemptArea {
  workspaceId?: string;
  cwd: string; resultPath: string;
  readResult(): Promise<unknown | null>;
  finish(output: unknown): Promise<StageResult>;
  dispose(): Promise<void>;
  release?(uncertain: boolean): Promise<void>;
  captureChanges?(): Promise<Increment | undefined>;
}
export interface HerdrAttemptFiles { prepare(input: StageInput & { jobId: string }): Promise<HerdrAttemptArea>; acknowledgeWorkspace?(workspaceId: string, attemptId: string, reusable?: boolean): Promise<void> }

export interface HerdrWorkflowRecord {
  workflow?: import('../domain/configured-workflow-run').ConfiguredStepExecution;
  workspaceId?: string;
  id: string; jobId: string; ideaId: string; projectId: string; stage: AgentStage; model: string; kind: 'claude';
  settings: HerdrSettings; fingerprint: string; nonce: string; at: string;
  updatedAt?: string; inspectedAt?: string; inspection?: 'session' | 'original-target' | 'target-changed';
  configuration?: { systemPrompt: string; timeoutSeconds: number; sessionId: string };
  launchArgv?: string[];
  phase: 'preparing' | 'creating-workspace' | 'workspace-created' | 'starting-agent' | 'agent-ready' | 'sending-prompt' | 'waiting-result' | 'completed' | 'attention' | 'reviewed';
  projectPath?: string; worktreeFolder?: string;
  cwd?: string; resultPath?: string; workspace?: HerdrWorkspace; pane?: HerdrPane; target?: HerdrWorkflowTarget;
}
export interface HerdrWorkflowStorage { load(): Promise<HerdrWorkflowRecord[]>; save(records: HerdrWorkflowRecord[]): Promise<void> }
export interface HerdrWorkflowState { records: HerdrWorkflowRecord[]; ready: boolean; busy: boolean; error: string }
export interface HerdrWorkflowActions {
  snapshot(): HerdrWorkflowState;
  subscribe(listener: (state: HerdrWorkflowState) => void): () => void;
  inspect(id: string): Promise<void>;
  acknowledge(id: string): Promise<void>;
}
