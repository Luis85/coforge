import type { BackgroundBuildRetryPreview } from '../../../features/coforge/api';
import type { WorkflowRun } from '../../../features/coforge/domain/configured-workflow-run';
import { workflowArtifactHash, workflowProposalRevision } from '../../../features/coforge/domain/configured-workflow-run';
import { defaultWorkflowDefinition, type AiWorkflowStep } from '../../../features/coforge/domain/configured-workflow';
import { createSeed } from '../../../features/coforge/domain/seed';
import type { StudioProject } from '../../../features/coforge/domain/types';

/** Typed synthetic review data shared by DOM, browser and contained-native presentation proofs. */
export function retryUiData(project: StudioProject) {
  const at = '2026-10-31T10:00:00Z';
  const step: AiWorkflowStep = { id: 'build', kind: 'ai', output: 'codechange', access: 'editworktree', automatic: false,
    name: 'Captured Build', provider: 'claude', model: 'sonnet', effort: 'high', instructions: 'Keep the captured implementation task.' };
  const idea = { ...createSeed().ideas[0]!, id: 'CF-901', number: 901, projectId: project.id, status: 'planned' as const };
  const run: WorkflowRun = { id: 'original-run', ideaId: idea.id, projectId: project.id,
    definition: { ...defaultWorkflowDefinition(project.settings), revision: 'custom-v1', name: 'Custom workflow',
      steps: [{ id: 'plan', name: 'Plan', kind: 'ai', output: 'markdown', access: 'none', provider: 'demo', model: 'sonnet', instructions: 'Plan', automatic: false }, step] },
    proposalRevision: workflowProposalRevision(idea), revision: 7, cursor: 1, state: 'attention', createdAt: at, updatedAt: at,
    workspaceId: 'original-workspace', attempts: [{ id: 'earlier', stepId: 'plan', stepName: 'Plan', kind: 'ai', status: 'succeeded', inputs: [], startedAt: at },
      { id: 'failed-build', stepId: step.id, stepName: step.name, kind: 'ai', status: 'failed', inputs: [], startedAt: at, jobId: 'old-job', error: 'Old foreground timeout' }],
    artifacts: [{ id: 'retained-plan', runId: 'original-run', stepId: 'plan', attemptId: 'earlier', proposalRevision: workflowProposalRevision(idea),
      output: 'markdown', createdAt: at, contentHash: 'plan-hash', markdown: 'Retained completed plan.' }], error: 'Old foreground timeout' };
  run.artifacts[0]!.contentHash = workflowArtifactHash(run.artifacts[0]!);
  const preview: BackgroundBuildRetryPreview = { purpose: 'retry', id: 'reviewed-receipt', ideaId: idea.id, runId: run.id, runRevision: run.revision,
    proposalRevision: run.proposalRevision, stepId: step.id, step,
    source: { projectId: run.projectId, ideaId: idea.id, runId: run.id, runRevision: run.revision, proposalRevision: run.proposalRevision,
      stepId: step.id, sourceKind: 'workspace', sourceWorkspaceId: run.workspaceId, sourceJobId: 'old-job', sourceAttemptId: 'failed-build', projectPath: '/fixture/repo' },
    inspection: { captureScope: 'coforge-source-code/v1', excludedPaths: [{ path: 'node_modules', reason: 'git-ignored-agent-denied-directory' }], sourceOwner: { kind: 'attempt', jobId: 'old-job', attemptId: 'failed-build' },
      version: 1, snapshot: { version: 1, id: 'reviewed-snapshot', contentHash: 'a'.repeat(64) }, evidenceHash: 'b'.repeat(64),
      sourceKind: 'workspace', sourceWorkspaceId: run.workspaceId, baseCommit: 'c'.repeat(40),
      increment: { summary: 'Actual reviewed partial changes', files: [{ path: 'game.ts', additions: 1, deletions: 0 }],
        tests: ['Not run'], createdAt: at, simulated: false, diff: '+actual reviewed partial code' },
      fileCount: 1, totalBytes: 42, observedAt: at, humanCessationRequired: true },
    policy: { mode: 'background', idleWarningSeconds: 1800 }, policySource: { kind: 'default', definitionRevision: 'current-saved-policy' },
    inheritedLimits: { maxTurns: 12, maxBudgetUsd: 1 }, effectiveLimits: { maxTurns: 12, maxBudgetUsd: 1 },
    stopHold: false, readiness: { ready: true, message: 'Native worker ready; no provider call made.', reviewedSnapshots: true }, createdAt: at };
  return { idea: { ...idea, workflowRun: run }, run, preview };
}
