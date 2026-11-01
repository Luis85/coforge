import { vi } from 'vitest';
import type { BackgroundBuildRetryPreview } from '../../../features/coforge/api';
import type { BackgroundBuildRetryApproval } from '../../../features/coforge/domain/background-build-retry';
import type { WorkflowRun } from '../../../features/coforge/domain/configured-workflow-run';
import { workflowProposalRevision } from '../../../features/coforge/domain/configured-workflow-run';
import { createSeed } from '../../../features/coforge/domain/seed';
import { ai, definition, increment } from './configured-workflow-fixture';
import { workflowUiFixture } from './workflow-ui-fixture';

export async function retryUiFixture() {
  const f = await workflowUiFixture();
  if (!f.store.state) throw new Error('Missing UI state');
  const at = '2026-10-31T10:00:00Z';
  const step = { ...ai('build', 'codechange', 'editworktree'), name: 'Captured Build', provider: 'claude' as const,
    model: 'sonnet', effort: 'high' as const, instructions: 'Keep the captured implementation task.' };
  const idea = { ...createSeed().ideas[0]!, id: 'CF-901', number: 901, projectId: f.project.id, status: 'planned' as const };
  const run: WorkflowRun = { id: 'original-run', ideaId: idea.id, projectId: f.project.id, definition: definition([ai('plan'), step]),
    proposalRevision: workflowProposalRevision(idea), revision: 7, cursor: 1, state: 'attention', createdAt: at, updatedAt: at,
    workspaceId: 'original-workspace', attempts: [{ id: 'earlier', stepId: 'plan', stepName: 'Plan', kind: 'ai', status: 'succeeded', inputs: [], startedAt: at },
      { id: 'failed-build', stepId: step.id, stepName: step.name, kind: 'ai', status: 'failed', inputs: [], startedAt: at, jobId: 'old-job', error: 'Old foreground timeout' }],
    artifacts: [{ id: 'retained-plan', runId: 'original-run', stepId: 'plan', attemptId: 'earlier', proposalRevision: workflowProposalRevision(idea),
      output: 'markdown', createdAt: at, contentHash: 'plan-hash', markdown: 'Retained completed plan.' }], error: 'Old foreground timeout' };
  const configured = { ...idea, workflowRun: run };
  f.store.state.ideas = [configured];
  const saved = f.store.state.projects!.find(project => project.id === f.project.id)!;
  saved.settings.workflow = structuredClone({ ...run.definition, revision: 'current-saved-policy' });
  const preview: BackgroundBuildRetryPreview = { purpose: 'retry', id: 'reviewed-receipt', ideaId: idea.id, runId: run.id, runRevision: run.revision,
    proposalRevision: run.proposalRevision, stepId: step.id, step,
    source: { projectId: run.projectId, ideaId: idea.id, runId: run.id, runRevision: run.revision, proposalRevision: run.proposalRevision,
      stepId: step.id, sourceKind: 'workspace', sourceWorkspaceId: run.workspaceId, sourceJobId: 'old-job', sourceAttemptId: 'failed-build', projectPath: '/fixture/repo' },
    inspection: { version: 1, snapshot: { version: 1, id: 'reviewed-snapshot', contentHash: 'a'.repeat(64) }, evidenceHash: 'b'.repeat(64),
      sourceKind: 'workspace', sourceWorkspaceId: run.workspaceId, baseCommit: 'c'.repeat(40),
      increment: { ...increment, simulated: false, diff: '+actual reviewed partial code' }, fileCount: 1, totalBytes: 42, observedAt: at, humanCessationRequired: true },
    policy: { mode: 'background', idleWarningSeconds: 1800 }, policySource: { kind: 'default', definitionRevision: 'current-saved-policy' },
    inheritedLimits: { maxTurns: 12, maxBudgetUsd: 1 }, effectiveLimits: { maxTurns: 12, maxBudgetUsd: 1 },
    stopHold: false, readiness: { ready: true, message: 'Native worker ready; no provider call made.', reviewedSnapshots: true }, createdAt: at };
  const inspect = vi.spyOn(f.studio, 'previewBackgroundBuildRetry').mockImplementation(async () => structuredClone(preview));
  const confirm = vi.spyOn(f.studio, 'confirmBackgroundBuildRetry').mockResolvedValue();
  return { ...f, idea: f.store.state.ideas[0]!, run: f.store.state.ideas[0]!.workflowRun!, preview, inspect, confirm };
}
export function retryUiApproval(preview: BackgroundBuildRetryPreview): BackgroundBuildRetryApproval {
  return { id: 'approved-retry', stepId: preview.stepId, sourceAttemptId: preview.source.sourceAttemptId, sourceJobId: preview.source.sourceJobId,
    attemptId: 'new-attempt', jobId: 'new-job', approvedAt: preview.createdAt, fromRunRevision: preview.runRevision,
    proposalRevision: preview.proposalRevision, policy: preview.policy, policySource: preview.policySource,
    snapshot: preview.inspection.snapshot, sourceKind: preview.inspection.sourceKind, priorWorkspaceId: preview.source.sourceWorkspaceId,
    priorAttemptCount: 2, baseCommit: preview.inspection.baseCommit, evidenceHash: preview.inspection.evidenceHash,
    oldExecutorStopped: true, changesReviewed: true, releasedStopHold: false };
}
