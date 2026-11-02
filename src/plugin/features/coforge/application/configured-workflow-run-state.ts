import type { WorkflowRun } from '../domain/configured-workflow-run';
import type { InternalState } from './ports';
import { configuredIdea, projectWorkflowChanges } from './configured-workflow-policy';
import { recordOperation } from './population';

const time = () => new Date().toISOString();
export function touchConfiguredRun(run: WorkflowRun): void { run.revision++; run.updatedAt = time(); }
export function finishConfiguredRun(state: InternalState, ideaId: string): WorkflowRun {
  const idea = configuredIdea(state, ideaId);
  const run = idea.workflowRun!;
  projectWorkflowChanges(idea, run);
  run.state = idea.increment?.files.length ? 'awaiting-review' : 'finished';
  delete run.activeAttemptId;
  touchConfiguredRun(run);
  recordOperation(state, run.state === 'awaiting-review' ? 'workflow-run-awaiting-review' : 'workflow-run-finished', 'committed', undefined, 1, run.id);
  return run;
}
