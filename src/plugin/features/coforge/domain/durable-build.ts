import { boolean, list, number, oneOf, optional, shape, text, timestamp } from './check';
import type { Increment } from './types';
import { stageUsageCheck, type StageUsage } from './ai-usage';
import { agentConversationCheck, type AgentConversation } from './agent-conversation';
import { workflowVerificationRecordsCheck, workflowSourceHashCheck, type WorkflowVerificationRecord } from './workflow-verification';
import { agentSessionTraceCheck, type AgentSessionTrace } from './agent-session';

/** Missing execution policy preserves foreground behavior. Missing deadline permits long quiet work. */
export interface DurableBuildPolicy { mode: 'background'; maxRuntimeSeconds?: number; idleWarningSeconds?: number; maxTurns?: number; maxBudgetUsd?: number }
export const DEFAULT_DURABLE_IDLE_WARNING_SECONDS = 1800;
const seconds = number({ integer: true, min: 1, max: Math.floor(Number.MAX_SAFE_INTEGER / 1000) });
export const durableBuildPolicyCheck = shape({ mode: oneOf(['background'] as const), maxRuntimeSeconds: optional(seconds), idleWarningSeconds: optional(number({ integer: true, min: 0, max: Math.floor(Number.MAX_SAFE_INTEGER / 1000) })), maxTurns: optional(number({ integer: true, min: 1, max: 100000 })), maxBudgetUsd: optional(number({ min: 0.1, max: 10000 })) }, { strict: true });
export interface DurableBuildRef { version: 1; executionId: string; workerId: string; epoch: number; inputHash: string }
const identity = text({ min: 1, max: 160 });
export const durableBuildRefCheck = shape({ version: oneOf([1] as const), executionId: identity, workerId: identity, epoch: number({ integer: true, min: 1, max: Number.MAX_SAFE_INTEGER }), inputHash: text({ pattern: /^[a-f0-9]{64}$/u }) }, { strict: true });
export const DURABLE_BUILD_PHASES = ['prepared', 'starting', 'running', 'finalizing', 'completed', 'failed', 'cancelled', 'attention'] as const;
export type DurableBuildPhase = typeof DURABLE_BUILD_PHASES[number];
export interface DurableBuildResult { summary?: string; increment?: Increment; costUsd?: number; usage?: StageUsage; verification?: WorkflowVerificationRecord[] }
const increment = shape({ summary: text({ min: 1, max: 6000 }), files: list(shape({ path: text({ min: 1, max: 1000 }), additions: number({ integer: true, min: 0 }), deletions: number({ integer: true, min: 0 }) }, { strict: true }), { max: 10000 }),
  snapshotHash: optional(text({ pattern: /^[a-f0-9]{64}$/u })),
  verification: optional(workflowVerificationRecordsCheck), verificationSourceHash: optional(workflowSourceHashCheck),
  tests: list(text({ max: 2000 }), { max: 100 }), diff: text({ max: 200000 }), branch: optional(text({ max: 1000 })), worktree: optional(text({ max: 4096 })), commit: optional(text({ max: 160 })), createdAt: timestamp, simulated: boolean }, { strict: true });
const money = number({ min: 0 });
export const durableBuildResultCheck = shape({ summary: optional(text({ max: 6000 })), increment: optional(increment), costUsd: optional(money), usage: optional(stageUsageCheck), verification: optional(workflowVerificationRecordsCheck) }, { strict: true });
export interface DurableBuildSnapshot {
  version: 1; ref: DurableBuildRef; sequence: number; phase: DurableBuildPhase;
  createdAt: string; startedAt?: string; lastContactAt: string; lastActivityAt?: string; elapsedSeconds: number;
  logs: string[]; workspaceId?: string; workspaceCaptured?: boolean; cancellationRequested?: boolean; result?: DurableBuildResult;
  increment?: Increment; conversation?: AgentConversation; costUsd?: number; usage?: StageUsage; error?: string;
  verification?: WorkflowVerificationRecord[];
  sessionTrace?: AgentSessionTrace;
}
export const durableBuildSnapshotCheck = shape({ version: oneOf([1] as const), ref: durableBuildRefCheck, sequence: number({ integer: true, min: 0, max: Number.MAX_SAFE_INTEGER }), phase: oneOf(DURABLE_BUILD_PHASES),
  createdAt: timestamp, startedAt: optional(timestamp), lastContactAt: timestamp, lastActivityAt: optional(timestamp), elapsedSeconds: number({ min: 0 }), logs: list(text({ max: 1000 }), { max: 50 }),
  workspaceId: optional(identity), workspaceCaptured: optional(boolean), cancellationRequested: optional(boolean), result: optional(durableBuildResultCheck), increment: optional(increment), conversation: optional(agentConversationCheck), costUsd: optional(money), usage: optional(stageUsageCheck), error: optional(text({ max: 3900 })),
  verification: optional(workflowVerificationRecordsCheck),
  sessionTrace: optional(agentSessionTraceCheck),
}, { strict: true });
export interface DurableBuildExecution {
  intent: 'start' | 'cancel'; ref: DurableBuildRef; policy: DurableBuildPolicy; snapshot?: DurableBuildSnapshot;
  appliedSequence?: number; acknowledged?: boolean; reconcileError?: string;
}
export const durableBuildExecutionCheck = shape({ intent: oneOf(['start', 'cancel'] as const), ref: durableBuildRefCheck, policy: durableBuildPolicyCheck, snapshot: optional(durableBuildSnapshotCheck),
  appliedSequence: optional(number({ integer: true, min: 0 })), acknowledged: optional(boolean), reconcileError: optional(text({ max: 3900 })),
}, { strict: true });
export interface DurableBuildReadiness { ready: boolean; message: string; repairable?: boolean; reviewedSnapshots?: boolean }
export interface DurableBuildInspection { version: 1; ref: DurableBuildRef; snapshot: DurableBuildSnapshot; observedAt: string; evidenceHash: string }
export const durableBuildInspectionCheck = shape({ version: oneOf([1] as const), ref: durableBuildRefCheck, snapshot: durableBuildSnapshotCheck, observedAt: timestamp, evidenceHash: text({ pattern: /^[a-f0-9]{64}$/u }) }, { strict: true });
export interface DurableBuildInspectionReceipt extends DurableBuildInspection { ideaId: string; runId: string; runRevision: number }
/** Attention can still own a live writer; only confirmed provider termination releases the lane. */
export const durableBuildTerminal = (phase: DurableBuildPhase): boolean => ['completed', 'failed', 'cancelled'].includes(phase);
export const sameDurableBuildRef = (left: DurableBuildRef, right: DurableBuildRef): boolean => left.version === right.version && left.executionId === right.executionId && left.workerId === right.workerId && left.epoch === right.epoch && left.inputHash === right.inputHash;
