import { backgroundBuildRetryInspectionCheck, type BackgroundBuildRetryApproval, type BackgroundBuildRetryConsent, type BackgroundBuildRetryPreview } from '../domain/background-build-retry';
import type { BackgroundBuildRetryPort } from './background-build-retry-ports';
import type { DurableBuildPort } from './durable-build-ports';
import type { StudioStore } from './studio-store';
import type { InternalState } from './ports';
import { backgroundBuildRetryContext } from './background-build-retry-policy';
import { recordOperation } from './population';
import { resolvedWorkflowSource } from './workflow-source-executors';

/** Explicit operator transaction. Preview stages no worker admission and confirm never mutates old entries. */
export class BackgroundBuildRetries {
  private readonly receipts = new Map<string, { preview: BackgroundBuildRetryPreview; identity: string }>();
  constructor(private readonly store: StudioStore, private readonly resources: BackgroundBuildRetryPort | undefined, private readonly worker: DurableBuildPort | undefined,
    private readonly busy: (ideaId: string) => boolean, private readonly queue: (state: InternalState, ideaId: string, approval: BackgroundBuildRetryApproval) => void) {}
  private context(ideaId: string) { return backgroundBuildRetryContext(this.store.internalSnapshot(), ideaId, this.busy(ideaId)); }
  async preview(ideaId: string): Promise<BackgroundBuildRetryPreview> {
    this.receipts.delete(ideaId);
    if (!this.resources || !this.worker) throw new Error('The native background Build inspection service is unavailable. No execution was started.');
    const context = this.context(ideaId);
    const readiness = await this.worker.readiness();
    if (readiness.reviewedSnapshots !== true) throw new Error('This background worker does not support reviewed snapshots. Finish its original jobs, then upgrade the worker before retrying.');
    const inspection = backgroundBuildRetryInspectionCheck(await this.resources.inspect(context.source));
    if (this.context(ideaId).identity !== context.identity) throw new Error('The request or workflow changed during inspection. Preview it again.');
    if (inspection.sourceKind !== context.source.sourceKind || inspection.sourceWorkspaceId !== context.source.sourceWorkspaceId || inspection.humanCessationRequired !== !!(context.source.sourceAttemptId || context.source.executorAttemptId || context.source.executorCandidates?.length)) throw new Error('The inspected original workspace or executor identity changed.');
    const preview: BackgroundBuildRetryPreview = { purpose: 'retry', id: crypto.randomUUID(), ideaId, runId: context.run.id, runRevision: context.run.revision, proposalRevision: context.run.proposalRevision, stepId: context.step.id,
      ...(context.previousAttemptId ? { previousAttemptId: context.previousAttemptId, previousJobId: context.previousJobId } : {}),
      source: resolvedWorkflowSource(context.source, inspection), inspection, step: context.step, ...(context.coworker ? { coworker: context.coworker } : {}), policy: context.policy, policySource: context.policySource,
      inheritedLimits: context.inheritedLimits, effectiveLimits: context.effectiveLimits, stopHold: context.stopHold, readiness, createdAt: new Date().toISOString() };
    this.receipts.set(ideaId, { preview: structuredClone(preview), identity: context.identity }); return structuredClone(preview);
  }
  async confirm(ideaId: string, previewId: string, consent: BackgroundBuildRetryConsent): Promise<void> {
    const receipt = this.receipts.get(ideaId); const preview = receipt?.preview;
    if (!receipt || !preview || preview.id !== previewId || this.context(ideaId).identity !== receipt.identity) throw new Error('This Build preview is stale. Inspect the current files again.');
    if (consent.changesReviewed !== true || preview.inspection.humanCessationRequired && consent.oldExecutorStopped !== true || preview.stopHold && consent.releaseStopHold !== true) throw new Error('Review the actual changes, confirm any old executor is stopped, and explicitly release the Stop hold before retrying.');
    const readiness = await this.worker!.readiness();
    if (!preview.readiness.ready || !readiness.ready || readiness.reviewedSnapshots !== true) throw new Error('Check the background worker and reviewed-snapshot support before confirming this retry.');
    if (this.context(ideaId).identity !== receipt.identity) throw new Error('The Build changed while checking readiness. Preview it again.');
    const target = { kind: 'retry' as const, runId: preview.runId, retryId: crypto.randomUUID(), jobId: crypto.randomUUID(), attemptId: crypto.randomUUID() };
    await this.resources!.verify(preview.source, preview.inspection.snapshot, target);
    await this.store.transaction(state => {
      const current = backgroundBuildRetryContext(state, ideaId, this.busy(ideaId));
      if (current.identity !== receipt.identity || this.receipts.get(ideaId) !== receipt) throw new Error('The Build or reviewed policy changed before admission. Preview it again.');
      const approval: BackgroundBuildRetryApproval = { id: target.retryId, stepId: current.step.id, attemptId: target.attemptId, jobId: target.jobId, approvedAt: new Date().toISOString(),
        ...(current.previousAttemptId ? { previousAttemptId: current.previousAttemptId, previousJobId: current.previousJobId } : {}),
        fromRunRevision: current.run.revision, proposalRevision: current.run.proposalRevision, policy: preview.policy, policySource: preview.policySource, snapshot: preview.inspection.snapshot,
        sourceKind: preview.source.sourceKind, ...(preview.source.sourceWorkspaceId ? { priorWorkspaceId: preview.source.sourceWorkspaceId } : {}), priorAttemptCount: current.run.attempts.length,
        ...(preview.source.sourceAttemptId ? { sourceAttemptId: preview.source.sourceAttemptId, sourceJobId: preview.source.sourceJobId } : {}), baseCommit: preview.inspection.baseCommit, evidenceHash: preview.inspection.evidenceHash,
        ...(preview.source.sourceMaterializationId ? { sourceMaterializationId: preview.source.sourceMaterializationId } : {}),
        oldExecutorStopped: consent.oldExecutorStopped, changesReviewed: true, releasedStopHold: preview.stopHold };
      current.run.backgroundRetries = [...(current.run.backgroundRetries ?? []), approval];
      delete current.run.activeAttemptId; delete current.run.error;
      current.run.state = 'ready'; delete current.idea.increment;
      current.idea.status = current.idea.plan ? 'planned' : current.idea.rice ? 'ranked' : current.idea.screening?.verdict === 'clear' ? 'screened' : 'inbox';
      if (preview.stopHold) state.workflowStopHolds = state.workflowStopHolds?.filter(id => id !== ideaId);
      this.queue(state, ideaId, approval);
      recordOperation(state, 'workflow-background-retry-approved', 'committed', undefined, 1, approval.id);
    }, { atomicCommand: true });
    this.receipts.delete(ideaId);
  }
  clear(): void { this.receipts.clear(); }
}
