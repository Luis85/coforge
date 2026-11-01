import type { Idea } from '../../../features/coforge/domain/types';
import type { WorkflowArtifact, WorkflowRun } from '../../../features/coforge/domain/configured-workflow-run';
import { workflowArtifactCheck, workflowArtifactHash, workflowProposalRevision } from '../../../features/coforge/domain/configured-workflow-run';
import { selectPolishingTarget } from '../../../features/coforge/domain/polishing-target';
import { workflowRunHistoryHash } from '../../../features/coforge/domain/workflow-run-history-hash';
import type { PolishingRun } from '../../../features/coforge/domain/polishing';
import { ideaProjectId } from '../../../features/coforge/domain/projects';
import { ai, definition } from './configured-workflow-fixture';
import { consent } from './background-build-retry-fixture';

export function completedPolish(idea: Idea, payload: Partial<Pick<WorkflowArtifact, 'markdown' | 'plan' | 'rice' | 'screening' | 'increment' | 'summary'>>): PolishingRun {
  const target = selectPolishingTarget(idea); const id = crypto.randomUUID(); const attemptId = crypto.randomUUID(); const now = new Date().toISOString();
  const output = target.kind === 'request' ? 'markdown' : target.kind;
  const value = { id: crypto.randomUUID(), runId: id, stepId: 'polish', attemptId, proposalRevision: workflowProposalRevision(idea), output, createdAt: now, ...payload };
  const artifact = workflowArtifactCheck({ ...value, contentHash: workflowArtifactHash(value) });
  const workflow: WorkflowRun = { id, ideaId: idea.id, projectId: ideaProjectId(idea), definition: definition([{ ...ai('polish', output), automatic: false }]),
    proposalRevision: workflowProposalRevision(idea), revision: 4, cursor: 1, state: 'awaiting-review', createdAt: now, updatedAt: now,
    attempts: [{ id: attemptId, stepId: 'polish', stepName: 'Polish', kind: 'ai', status: 'succeeded', inputs: [], startedAt: now, finishedAt: now }], artifacts: [artifact] };
  const primary = idea.workflowRun;
  const pass: PolishingRun = { id, workflow, target, feedback: 'Make the current result clearer.', sourceHash: 'ctx-test-source', consent,
    ...(primary ? { primaryCheckpoint: { runId: primary.id, revision: primary.revision, cursor: primary.cursor, state: primary.state, contentHash: workflowRunHistoryHash(primary) } } : {}),
    sourceArtifacts: [], policySourceRevision: 'test-policy', createdAt: now, review: 'pending', previousStatus: idea.status };
  (idea.polishingRuns ??= []).push(pass); return pass;
}
