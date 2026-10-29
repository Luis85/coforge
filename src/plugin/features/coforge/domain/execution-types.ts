import type { StageUsage } from "./ai-usage";
import type { AutomationContext } from './automation-context';
import type { CouncilPromptOrder } from "./council-prompt-order";
import type { TeamMessageDraft } from "./team-messages";
import type { ExecutionMessagingState } from "./execution-outbox";
import type { ExecutionLocalAction } from "./execution-local-action";
import type { ImplementationPlan } from "./types";
import type { ExecutionMessageRejectionInfo } from "./execution-message-rejection";
import type {
  ExecutionAllowance,
  ExecutionAllowanceAudit,
} from "./execution-allowance";
export type ExecutionSubject =
  | { kind: "note"; sourceId: string; revision: string; markdown: string }
  | {
      kind: "idea";
      sourceId: string;
      revision: string;
      markdown: string;
      ideaId: string;
      ideaRevision?: string;
    };
export interface ExecutionInvocation {
  id: string;
  roundId: string;
  promptOrder?: CouncilPromptOrder;
  agentId: string;
  agentRevision: string;
  provider: "demo" | "claude" | "herdr";
  model: string;
  instructions: string;
  access: "none";
  inputRoundIds: string[];
  output?: "markdown" | "plan";
  maxArtifactCharacters?: number;
  executionScope?: { id: string; limitMs: number };
}
export interface ExecutionDispatch {
  prompt: string;
  inputArtifactIds: string[];
}
export interface ExecutionResponse {
  markdown: string;
  simulated: boolean;
  costUsd?: number;
  usage?: StageUsage;
  messageDrafts?: TeamMessageDraft[];
  plan?: ImplementationPlan;
}
export interface ExecutionAttempt {
  id: string;
  invocationId: string;
  status: "dispatching" | "not-started" | "unknown" | "responded" | "published";
  startedAt: string;
  dispatch: ExecutionDispatch;
  artifactId?: string;
  error?: string;
  costUsd?: number;
  usage?: StageUsage;
  usageSource?: "provider";
  skipped?: boolean;
  uncertaintyAcknowledgedAt?: string;
}
export interface ExecutionArtifact extends ExecutionResponse {
  id: string;
  runId: string;
  invocationId: string;
  attemptId: string;
  roundId: string;
  agentId: string;
  agentRevision: string;
  provider: "demo" | "claude" | "herdr";
  model: string;
  inputArtifactIds: string[];
  createdAt: string;
  messagesRejected?: boolean;
  messageRejection?: ExecutionMessageRejectionInfo;
  skipped?: boolean;
  skipReason?: string;
}
export interface ExecutionCheckpoint {
  id: string;
  name: string;
  instructions: string;
  beforeCursor: number;
  kind: "approval" | "checklist";
  items: { id: string; label: string; required: boolean }[];
  order?: number;
}
export interface ExecutionAdmission {
  automationEvent?: AutomationContext;
  id: string;
  submissionKey: string;
  subject: ExecutionSubject;
  projectId: string;
  teamId: string;
  context: string;
  invocations: ExecutionInvocation[];
  definitionSnapshot?: string;
  limits?: {
    timeoutSeconds: number;
    maxTurns: number;
    maxBudgetUsd: number;
    maxInvocations?: number;
    executionLimitMs?: number;
    simulation: boolean;
  };
  checkpoints?: ExecutionCheckpoint[];
  localActions?: ExecutionLocalAction[];
}
export interface ExecutionRun extends ExecutionAdmission {
  allowance?: ExecutionAllowance;
  allowanceExtensions?: ExecutionAllowanceAudit[];
  cursor: number;
  state:
    | "queued"
    | "running"
    | "publishing"
    | "attention"
    | "waiting-human"
    | "completed"
    | "cancelled";
  attempts: ExecutionAttempt[];
  artifacts: ExecutionArtifact[];
  createdAt: string;
  updatedAt: string;
  reason?: string;
  pauseRequested?: boolean;
  checkpointEvidence?: {
    id: string;
    checkedIds: string[];
    note: string;
    completedAt: string;
  }[];
  activeCheckpointId?: string;
  hasGaps?: boolean;
  sourceAcknowledgement?: { revision: string; acknowledgedAt: string };
  projectionTarget?: { sourceId: string; acknowledgedAt: string };
  projectionDestinations?: string[];
  projectionRecovery?: {
    resumeState: ExecutionRun["state"];
    pendingArtifactIds: string[];
    reason?: string;
  };
  localActionEvidence?: {
    id: string;
    completedAt: string;
    messageIds: string[];
  }[];
  timing?: {
    usedMs: number;
    scopes: { id: string; usedMs: number }[];
    active?: {
      token: string;
      scopeId?: string;
      reservedMs: number;
      accountedMs?: number;
    };
    parallel?: {
      token: string;
      scopeId?: string;
      reservedMs: number;
      accountedMs?: number;
    }[];
  };
}
export interface ExecutionJournal {
  format: "coforge-execution/v2";
  revision: number;
  runs: ExecutionRun[];
  submissions: { key: string; runId: string }[];
  messaging?: ExecutionMessagingState;
  projections?: ExecutionProjectionTombstone[];
  cancelledRunIds?: string[];
}
export interface ExecutionProjectionTombstone {
  sourceId: string;
  artifactId: string;
  blockHash: string;
}
export const EXECUTION_RUN_BYTES = 2 * 1024 * 1024;
export const EXECUTION_JOURNAL_BYTES = 16 * 1024 * 1024;
export const EXECUTION_RESULT_RESERVE_BYTES = 512 * 1024;
export const emptyExecutionJournal = (): ExecutionJournal => ({
  format: "coforge-execution/v2",
  revision: 0,
  runs: [],
  submissions: [],
});
