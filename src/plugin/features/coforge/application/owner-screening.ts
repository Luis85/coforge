import type { Idea } from '../domain/types';
import type { WorkflowRun } from '../domain/configured-workflow-run';
import { appendWorkflowArtifact } from './configured-workflow-policy';
import { ownerScreeningExempt } from '../domain/owner-screening';

/** Retain the captured definition and an honest skip, without a job, model invocation or charge. */
export function skipOwnerScreening(idea: Idea, run: WorkflowRun): void {
  if (!run.ownerScreeningExempt || !ownerScreeningExempt(idea)) return;
  let step = run.definition.steps[run.cursor];
  while (step?.kind === 'ai' && step.output === 'screening') {
    if (run.attempts.length >= 100) throw new Error('The run reached its attempt limit. Preserve it and start a new run.');
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    appendWorkflowArtifact(run, { runId: run.id, definitionRevision: run.definition.revision,
      proposalRevision: run.proposalRevision, attemptId: id, step, inputArtifacts: [] },
    { output: 'screening', screening: idea.screening }, now);
    run.attempts.push({ id, stepId: step.id, stepName: step.name, kind: 'ai', status: 'skipped',
      inputs: [], startedAt: now, finishedAt: now, note: 'Owner request · screening not required. No agent was invoked.' });
    run.cursor++; run.revision++; run.updatedAt = now;
    step = run.definition.steps[run.cursor];
  }
}
