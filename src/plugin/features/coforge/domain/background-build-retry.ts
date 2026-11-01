import { boolean, list, number, oneOf, optional, record, shape, text, timestamp } from './check';
import { workflowIdCheck, type AiWorkflowStep } from './configured-workflow';
import { durableBuildPolicyCheck, durableBuildResultCheck, type DurableBuildPolicy, type DurableBuildReadiness } from './durable-build';
import type { Increment } from './types';
import type { WorkflowCoworkerProfile } from './workflow-coworker-binding';
import type { WorkflowArtifact } from './configured-workflow-run';

/** Opaque private immutable resource identity. A preview reference alone grants no import authority. */
export interface BackgroundBuildSnapshotRef { version: 1; id: string; contentHash: string }
const hash = text({ pattern: /^[a-f0-9]{64}$/u });
export const backgroundBuildSnapshotRefCheck = shape({ version: oneOf([1] as const), id: workflowIdCheck, contentHash: hash }, { strict: true });
export interface BackgroundBuildRetrySource {
  projectId: string; ideaId: string; runId?: string; runRevision: number; proposalRevision: string; stepId: string;
  sourceKind: 'workspace' | 'repository'; sourceWorkspaceId?: string; sourceJobId?: string; sourceAttemptId?: string;
  projectPath: string; expectedIncrement?: Increment;
  sourceRunHash?: string;
  sourceIdentity?: string;
  sourceMaterializationId?: string;
  executorJobId?: string; executorAttemptId?: string;
  executorCandidates?: Array<{ jobId: string; attemptId: string }>;
}
const incrementCheck = (value: unknown): Increment => {
  const increment = durableBuildResultCheck({ increment: value }).increment;
  if (!increment) throw new Error('A real increment is required.');
  return increment;
};
const sourceCheck = shape({ projectId: workflowIdCheck, ideaId: workflowIdCheck, runId: optional(workflowIdCheck), runRevision: number({ integer: true, min: 0 }),
  executorCandidates: optional(list(shape({ jobId: workflowIdCheck, attemptId: workflowIdCheck }, { strict: true }), { max: 100 })),
  proposalRevision: workflowIdCheck, stepId: workflowIdCheck, sourceKind: oneOf(['workspace', 'repository'] as const), sourceWorkspaceId: optional(workflowIdCheck),
  sourceJobId: optional(workflowIdCheck), sourceAttemptId: optional(workflowIdCheck), projectPath: text({ min: 1, max: 4096 }), expectedIncrement: optional(incrementCheck), sourceRunHash: optional(workflowIdCheck), sourceIdentity: optional(workflowIdCheck), sourceMaterializationId: optional(workflowIdCheck), executorJobId: optional(workflowIdCheck), executorAttemptId: optional(workflowIdCheck) }, { strict: true });
export function backgroundBuildRetrySourceCheck(value: unknown): BackgroundBuildRetrySource {
  const checked = sourceCheck(value);
  if (checked.sourceKind === 'workspace' && !checked.sourceWorkspaceId || checked.sourceKind === 'repository' && checked.sourceWorkspaceId) throw new Error('The source must identify its attributed workspace or explicitly use a verified clean repository.');
  if (checked.sourceKind === 'workspace' && !checked.runId) throw new Error('The attributed workspace requires its original run identity.');
  if (!!checked.sourceJobId !== !!checked.sourceAttemptId) throw new Error('The original job and attempt must be identified together.');
  if (!!checked.executorJobId !== !!checked.executorAttemptId) throw new Error('The latest executor job and attempt must be identified together.');
  if (new Set(checked.executorCandidates?.map(item => item.jobId)).size !== (checked.executorCandidates?.length ?? 0) || new Set(checked.executorCandidates?.map(item => item.attemptId)).size !== (checked.executorCandidates?.length ?? 0)) throw new Error('Executor candidates must have unique job and attempt identities.');
  return checked;
}
export interface BackgroundBuildRetryInspection {
  captureScope?: 'coforge-source-code/v1';
  excludedPaths?: Array<{ path: string; reason: 'git-ignored-agent-denied-directory' | 'git-ignored-agent-denied-link' }>;
  version: 1; snapshot: BackgroundBuildSnapshotRef; evidenceHash: string; sourceKind: 'workspace' | 'repository'; sourceWorkspaceId?: string;
  baseCommit: string; increment: Increment | null; fileCount: number; totalBytes: number; observedAt: string; humanCessationRequired: boolean;
  sourceOwner?: { kind: 'attempt'; jobId: string; attemptId: string } | { kind: 'materialization'; id: string };
}
const sourceOwnerCheck = (value: unknown) => record(value).kind === 'attempt'
  ? shape({ kind: oneOf(['attempt'] as const), jobId: workflowIdCheck, attemptId: workflowIdCheck }, { strict: true })(value)
  : shape({ kind: oneOf(['materialization'] as const), id: workflowIdCheck }, { strict: true })(value);
const excludedPathCheck = (value: unknown): string => {
  const path = text({ min: 1, max: 4096 })(value);
  if (path.includes('\\') || path.includes(':') || path.split('/').some(part => !part || part === '.' || part === '..') || [...path].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) throw new Error('Snapshot exclusions must be relative source paths.');
  return path;
};
export const snapshotExcludedPathsCheck = list(shape({ path: excludedPathCheck, reason: oneOf(['git-ignored-agent-denied-directory', 'git-ignored-agent-denied-link'] as const) }, { strict: true }), { max: 10000 });
const inspectionCheck = shape({ version: oneOf([1] as const), snapshot: backgroundBuildSnapshotRefCheck, evidenceHash: hash,
  captureScope: optional(oneOf(['coforge-source-code/v1'] as const)), excludedPaths: optional(snapshotExcludedPathsCheck),
  sourceOwner: optional(sourceOwnerCheck),
  sourceKind: oneOf(['workspace', 'repository'] as const), sourceWorkspaceId: optional(workflowIdCheck), baseCommit: text({ pattern: /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u }),
  increment: (value: unknown) => value === null ? null : incrementCheck(value), fileCount: number({ integer: true, min: 0, max: 10000 }),
  totalBytes: number({ integer: true, min: 0, max: Number.MAX_SAFE_INTEGER }), observedAt: timestamp, humanCessationRequired: boolean }, { strict: true });
export function backgroundBuildRetryInspectionCheck(value: unknown): BackgroundBuildRetryInspection {
  const checked = inspectionCheck(value);
  if (!!checked.captureScope !== (checked.excludedPaths !== undefined)) throw new Error('A scoped snapshot must disclose its exclusion list.');
  return checked;
}
export interface BackgroundBuildRetryConsent { oldExecutorStopped: boolean; changesReviewed: boolean; releaseStopHold: boolean }
export interface BackgroundBuildRetryPolicySource { kind: 'saved' | 'default'; definitionRevision: string }
export interface BackgroundBuildRetryApproval {
  sourceMaterializationId?: string;
  previousAttemptId?: string; previousJobId?: string;
  id: string; stepId: string; sourceAttemptId?: string; sourceJobId?: string; attemptId: string; jobId: string; approvedAt: string;
  fromRunRevision: number; proposalRevision: string; policy: DurableBuildPolicy; policySource: BackgroundBuildRetryPolicySource;
  snapshot: BackgroundBuildSnapshotRef; sourceKind: 'workspace' | 'repository'; priorWorkspaceId?: string; priorAttemptCount: number;
  baseCommit: string; evidenceHash: string; oldExecutorStopped: boolean; changesReviewed: true; releasedStopHold: boolean;
}
const policySourceCheck = shape({ kind: oneOf(['saved', 'default'] as const), definitionRevision: workflowIdCheck }, { strict: true });
export const backgroundBuildRetryApprovalsCheck = list(shape({ id: workflowIdCheck, stepId: workflowIdCheck, sourceAttemptId: optional(workflowIdCheck), sourceJobId: optional(workflowIdCheck),
  sourceMaterializationId: optional(workflowIdCheck),
  previousAttemptId: optional(workflowIdCheck), previousJobId: optional(workflowIdCheck),
  attemptId: workflowIdCheck, jobId: workflowIdCheck, approvedAt: timestamp, fromRunRevision: number({ integer: true, min: 0 }), proposalRevision: workflowIdCheck,
  policy: durableBuildPolicyCheck, policySource: policySourceCheck, snapshot: backgroundBuildSnapshotRefCheck, sourceKind: oneOf(['workspace', 'repository'] as const),
  priorWorkspaceId: optional(workflowIdCheck), priorAttemptCount: number({ integer: true, min: 0, max: 99 }), baseCommit: text({ pattern: /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u }),
  evidenceHash: hash, oldExecutorStopped: boolean, changesReviewed: (value: unknown): true => { if (value !== true) throw new Error('Review the actual changes before retrying.'); return true; }, releasedStopHold: boolean }, { strict: true }), { max: 100 });
/** Runtime-only operator receipt; never an automatic or agent/MCP execution command. */
export interface BackgroundBuildRetryPreview {
  purpose: 'retry' | 'improvement'; sourceRunHash?: string; sourceArtifacts?: WorkflowArtifact[];
  previousAttemptId?: string; previousJobId?: string;
  id: string; ideaId: string; runId: string; runRevision: number; proposalRevision: string; stepId: string; source: BackgroundBuildRetrySource;
  inspection: BackgroundBuildRetryInspection; step: AiWorkflowStep; coworker?: WorkflowCoworkerProfile; policy: DurableBuildPolicy;
  policySource: BackgroundBuildRetryPolicySource; inheritedLimits: { maxTurns: number; maxBudgetUsd: number }; effectiveLimits: { maxTurns: number; maxBudgetUsd: number };
  stopHold: boolean; readiness: DurableBuildReadiness; createdAt: string;
}
