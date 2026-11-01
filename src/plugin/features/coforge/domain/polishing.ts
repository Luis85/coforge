import type { AiWorkflowStep, WorkflowOutput } from './configured-workflow';
import type { WorkflowArtifact, WorkflowRun } from './configured-workflow-run';
import type { BackgroundBuildRetryInspection, BackgroundBuildRetryConsent } from './background-build-retry';
import type { DurableBuildReadiness } from './durable-build';
import type { ImplementationPlan, Increment, RiceScore, Screening, IdeaStatus } from './types';
import type { WorkflowCoworkerProfile } from './workflow-coworker-binding';

export type PolishingTargetKind = 'request' | WorkflowOutput;
/** Captured current result, not a manufactured completed workflow step. */
export interface PolishingTarget {
  kind: PolishingTargetKind; identity: string; contentHash: string; proposalRevision: string;
  sourceRunId?: string; sourceRunRevision?: number; sourceArtifactId?: string; sourceJobId?: string; sourceAttemptId?: string; workspaceId?: string;
  workspaceOwnerRunId?: string; sourceMaterializationId?: string;
  value: { request?: { title: string; description: string }; markdown?: string; screening?: Screening; rice?: RiceScore; plan?: ImplementationPlan; increment?: Increment; summary?: string };
}
export interface PolishingCheckpoint { runId: string; revision: number; cursor: number; state: WorkflowRun['state']; contentHash: string }
/** An independent one-step run. The primary run and its checkpoint stay in place. */
export interface PolishingRun {
  sourceHash: string; consent: PolishingConsent;
  stopVersion?: number;
  id: string; feedback: string; target: PolishingTarget; primaryCheckpoint?: PolishingCheckpoint; workflow: WorkflowRun;
  sourceArtifacts: WorkflowArtifact[]; policySourceRevision: string; createdAt: string;
  review: 'pending' | 'applied' | 'rejected'; reviewedAt?: string;
  previousStatus: IdeaStatus; applyIntent?: PolishingApplyIntent;
  applyIntentHistory?: PolishingApplyIntent[];
  applyFailure?: { intentId: string; code: 'POLISHING_COPY_RETAINED'; message: string; at: string };
  reviewedSnapshot?: import('./background-build-retry').BackgroundBuildSnapshotRef;
  reviewedSource?: import('./background-build-retry').BackgroundBuildRetrySource;
}
/** Approved references always point to genuine auxiliary output with its original identity/hash. */
export interface PolishingAmendment {
  id: string; polishingRunId: string; artifactId: string; artifactHash: string; targetIdentity: string; proposalRevision: string; approvedAt: string;
  resourceBinding?: PolishingCodeBinding;
}
export interface PolishingCodeBinding { id: string; workspaceId: string; ownerRunId: string; mode: 'foreground' | 'background'; workspaceEpoch: string; increment: Increment; evidenceHash: string }
export interface PolishingApplyIntent {
  id: string; sourceArtifactId: string; sourceArtifactHash: string; createdAt: string;
  targetRunId: string; mode: 'foreground' | 'background'; workspaceEpoch: string; primaryCheckpointHash: string;
  snapshot: import('./background-build-retry').BackgroundBuildSnapshotRef; sourceHash: string;
  baseline: import('./background-build-retry').BackgroundBuildSnapshotRef;
}
export interface PolishingPreview {
  sourceHash: string;
  id: string; ideaId: string; feedback: string; target: PolishingTarget; primaryCheckpoint?: PolishingCheckpoint; step: AiWorkflowStep;
  coworker?: WorkflowCoworkerProfile; sourceArtifacts: WorkflowArtifact[]; policySourceRevision: string;
  inheritedLimits: { maxTurns: number; maxBudgetUsd: number }; effectiveLimits: { maxTurns: number; maxBudgetUsd: number };
  inspection?: BackgroundBuildRetryInspection; readiness?: DurableBuildReadiness; stopHold: boolean; createdAt: string;
  oldExecutorAcknowledgementRequired: boolean;
}
export type PolishingConsent = BackgroundBuildRetryConsent;
