import type { AgentJob, Idea } from '../../../features/coforge/domain/types';
import type { PolishingRun } from '../../../features/coforge/domain/polishing';
import { workflowArtifactHash } from '../../../features/coforge/domain/configured-workflow-run';
import { createSeed } from '../../../features/coforge/domain/seed';
import { ai, definition } from './configured-workflow-fixture';

export function polishingCardFixture() {
  const idea: Idea = { ...createSeed().ideas[0]!, id: 'CF-135', status: 'review', lastError: 'Earlier Build timed out.' };
  const at = '2026-11-01T10:00:00Z'; const step = { ...ai('polish'), name: 'Improve & polish' };
  const pass: PolishingRun = {
    id: 'polishing-pass', feedback: 'Improve the current result', sourceHash: 'source', sourceArtifacts: [],
    target: { kind: 'request', identity: 'request', contentHash: 'source', proposalRevision: 'proposal', value: { request: { title: idea.title, description: idea.description } } },
    consent: { changesReviewed: true, oldExecutorStopped: false, releaseStopHold: false },
    policySourceRevision: 'saved-policy', createdAt: at, review: 'pending', previousStatus: idea.status,
    workflow: { id: 'polishing-pass', ideaId: idea.id, projectId: idea.projectId!, definition: definition([step]), proposalRevision: 'proposal',
      revision: 1, cursor: 0, state: 'running', activeAttemptId: 'polish-attempt', createdAt: at, updatedAt: at,
      attempts: [{ id: 'polish-attempt', jobId: 'polish-job', stepId: step.id, stepName: step.name, kind: 'ai', status: 'running', inputs: [], startedAt: at }], artifacts: [] },
  };
  const job: AgentJob = { id: 'polish-job', ideaId: idea.id, stage: 'implement', provider: 'demo', status: 'running', startedAt: at, logs: [],
    workflow: { runId: pass.workflow.id, polishingId: pass.id, definitionRevision: pass.workflow.definition.revision, proposalRevision: 'proposal', attemptId: 'polish-attempt', step, inputArtifacts: [] } };
  idea.polishingRuns = [pass];
  function complete() {
    pass.workflow.state = 'finished'; pass.workflow.cursor = 1; delete pass.workflow.activeAttemptId;
    pass.workflow.attempts[0]!.status = 'succeeded'; job.status = 'succeeded';
    const artifact = { id: 'polished-result', runId: pass.workflow.id, stepId: step.id, attemptId: 'polish-attempt', proposalRevision: 'proposal',
      output: 'markdown' as const, createdAt: at, contentHash: '', markdown: 'Reviewed polished description.' };
    artifact.contentHash = workflowArtifactHash(artifact); pass.workflow.artifacts = [artifact];
  }
  return { idea, pass, job, complete };
}
