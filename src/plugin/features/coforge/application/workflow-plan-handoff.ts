import { workflowDefinitionCheck, workflowIdCheck } from '../domain/configured-workflow';
import { workflowArtifactCheck, workflowArtifactHash, workflowPlanCheck, type WorkflowRun } from '../domain/configured-workflow-run';
import type { ImplementationPlan } from '../domain/types';

export interface WorkflowPlanHandoff {
  plan: ImplementationPlan; sourceRunId: string; sourceArtifactId: string; expectedProposalRevision: string;
}

/** An explicit human selection seeds a typed input; the existing workflow retains all execution/review gates. */
export function attachWorkflowPlan(run: WorkflowRun, handoff: WorkflowPlanHandoff, id: () => string): void {
  const plan = workflowPlanCheck(handoff.plan);
  workflowIdCheck(handoff.sourceRunId); workflowIdCheck(handoff.sourceArtifactId);
  if (run.proposalRevision !== handoff.expectedProposalRevision) throw new Error('The target request changed. Review its current revision before handing off a plan.');
  const stepId = `council-${id()}`; const attemptId = id();
  run.definition = workflowDefinitionCheck({ ...run.definition, revision: id(), steps: [{
    id: stepId, name: 'Council plan selected by streamer', kind: 'approval',
    instructions: `Explicitly selected typed plan from private run ${handoff.sourceRunId}, artifact ${handoff.sourceArtifactId}. This selection is not code approval or publication permission.`,
  }, ...run.definition.steps] });
  run.attempts.push({ id: attemptId, stepId, stepName: 'Council plan selected by streamer', kind: 'approval', status: 'succeeded', inputs: [],
    startedAt: run.createdAt, finishedAt: run.createdAt, note: 'The operator explicitly selected this validated proposal for the existing request workflow.' });
  const artifact = { id: id(), runId: run.id, stepId, attemptId, proposalRevision: run.proposalRevision, output: 'plan' as const, plan, createdAt: run.createdAt };
  run.artifacts.push(workflowArtifactCheck({ ...artifact, contentHash: workflowArtifactHash(artifact) }));
  run.cursor = 1;
}
