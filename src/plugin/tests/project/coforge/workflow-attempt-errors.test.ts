import { expect, it } from 'vitest';
import type { AgentJob } from '../../../features/coforge/domain/types';
import type { WorkflowRun } from '../../../features/coforge/domain/configured-workflow-run';
import { createSeed } from '../../../features/coforge/domain/seed';
import { workflowAttemptRows } from '../../../presentation/composables/coforge/configured-workflow-history';
import { ai, definition } from './configured-workflow-fixture';

it('retains the linked job failure alongside the workflow attempt failure in original attempt evidence', () => {
  const idea = createSeed().ideas[0]!; const step = ai('build', 'codechange', 'editworktree');
  const at = '2026-11-01T13:00:00Z';
  const run: WorkflowRun = { id: 'captured-run', ideaId: idea.id, projectId: idea.projectId!, definition: definition([step]),
    proposalRevision: 'captured-proposal', revision: 1, cursor: 0, state: 'attention', createdAt: at, updatedAt: at, artifacts: [],
    attempts: [{ id: 'captured-attempt', jobId: 'captured-job', stepId: step.id, stepName: 'Build', kind: 'ai', status: 'failed', inputs: [], startedAt: at, error: 'The workflow did not complete.' }] };
  idea.workflowRun = run;
  const job: AgentJob = { id: 'captured-job', ideaId: idea.id, projectId: idea.projectId, stage: 'implement', provider: 'codex', status: 'failed', startedAt: at,
    error: 'The provider exited before producing a final result.', logs: ['Captured admission completed.'],
    workflow: { runId: run.id, attemptId: 'captured-attempt', definitionRevision: run.definition.revision, proposalRevision: run.proposalRevision, step, inputArtifacts: [] } };
  const [row] = workflowAttemptRows([idea], [job]);
  expect(row?.jobId).toBe(job.id);
  expect(row?.log).toContain(job.error);
  expect(row?.log).toContain(run.attempts[0]!.error);
  expect(row?.log).toContain('Captured admission completed.');
});
