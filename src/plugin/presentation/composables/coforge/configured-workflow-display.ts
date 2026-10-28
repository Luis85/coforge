import type {
  AiWorkflowStep,
  WorkflowStep,
} from "../../../features/coforge/domain/configured-workflow";
import type {
  Idea,
  RuntimeInfo,
  StudioProject,
} from "../../../features/coforge/domain/types";
import type { WorkflowRun } from "../../../features/coforge/domain/configured-workflow-run";
export const CONFIGURED_RUN_LABELS = {
  ready: "Ready for next step",
  running: "AI step running",
  "waiting-human": "Waiting for your decision",
  attention: "Needs attention",
  finished: "Workflow finished",
  "awaiting-review": "Code changes await review",
  stopped: "Workflow stopped",
} as const;
export function configuredAgentLabel(step: WorkflowStep): string {
  return step.kind !== "ai"
    ? step.kind === "approval"
      ? "Streamer approval"
      : "Streamer checklist"
    : step.provider === "demo"
      ? "Simulation · no model call"
      : `${step.provider === "herdr" ? "Herdr · Claude Code" : "Claude Code"} · ${step.model}`;
}
/** Advisory UI feedback mirrors execution constraints; it never grants permission to dispatch. */
export function configuredStepProblem(
  step: AiWorkflowStep,
  project: StudioProject | undefined,
  runtime: RuntimeInfo | undefined,
  idea?: Idea,
  run?: WorkflowRun,
): string {
  if (!project || project.unavailable)
    return "Choose an available project before running this step.";
  if (idea && new Set(idea.voters).size < (step.minVotes ?? 0))
    return `Needs ${step.minVotes} votes before this step can run.`;
  if (step.provider === "demo") return "";
  if (step.access !== "none" && !project.projectPath)
    return "Set the project path in Project settings before running this step.";
  if (step.access === "editworktree" && !project.allowImplementation)
    return "Enable real implementation in Project settings → Agent workspace before running an editing step.";
  if (step.provider === "claude" && !runtime?.cliAvailable)
    return "Claude Code is not detected. Check the native CLI connection in Project settings.";
  if (step.provider === "herdr") {
    if (!runtime?.herdrWorkflow?.ready)
      return (
        runtime?.herdrWorkflow?.message ||
        "Herdr workflow is unavailable. Check the Herdr connection in Agent workflow."
      );
    if (runtime.herdrWorkflow.busy)
      return "Herdr is handling another interaction. Wait before dispatching.";
  }
  if (
    run &&
    step.inputs?.some(
      (role) =>
        !run.artifacts.some(
          (artifact) =>
            artifact.output === role &&
            !run.invalidatedArtifactIds?.includes(artifact.id),
        ),
    )
  )
    return "A required result from an earlier step is missing. Review this run before retrying.";
  return "";
}
