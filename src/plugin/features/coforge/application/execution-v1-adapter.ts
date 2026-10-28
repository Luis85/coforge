import type { WorkflowRun } from "../domain/configured-workflow-run";

export interface LegacyExecutionSummary {
  kind: "workflow-v1";
  id: string;
  projectId: string;
  sourceId: string;
  definitionRevision: string;
  state:
    | "queued"
    | "running"
    | "waiting-human"
    | "attention"
    | "completed"
    | "cancelled"
    | "awaiting-review";
  contributions: number;
  currentAction: string;
  reason?: string;
}

/** Read projection only: v1 progress stays canonical in its existing Idea note. */
export function v1ExecutionSummary(run: WorkflowRun): LegacyExecutionSummary {
  const states = {
    ready: "queued",
    running: "running",
    "waiting-human": "waiting-human",
    attention: "attention",
    finished: "completed",
    stopped: "cancelled",
    "awaiting-review": "awaiting-review",
  } as const;
  return {
    kind: "workflow-v1",
    id: run.id,
    projectId: run.projectId,
    sourceId: run.ideaId,
    definitionRevision: run.definition.revision,
    state: states[run.state],
    contributions: run.artifacts.length,
    currentAction:
      run.definition.steps[run.cursor]?.name ?? "Workflow complete",
    ...(run.error ? { reason: run.error } : {}),
  };
}
