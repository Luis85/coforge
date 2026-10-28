import type {
  AgentStage,
  RuntimeInfo,
  Settings,
  StudioProject,
} from "../../../features/coforge/domain/types";
import { stageAgent } from "../../../features/coforge/domain/stage-agents";
/** Shared presentation gate; the application still validates again at dispatch. */
export function workflowStageProblem(
  settings: Settings,
  stage: AgentStage,
  project: StudioProject | undefined,
  runtime: RuntimeInfo | undefined,
): string {
  if (!project || project.unavailable)
    return "Restore this project before dispatching work.";
  const agent = stageAgent(settings, stage);
  if (agent.provider === "demo") return "";
  if (agent.provider === "herdr") {
    if (!project.projectPath)
      return "Set this project’s workspace in Studio settings before running a Herdr step.";
    if (!runtime?.herdrWorkflow?.ready)
      return (
        runtime?.herdrWorkflow?.message ||
        "Herdr workflow is unavailable. Check the Herdr connection in Agent workflow."
      );
    if (runtime.herdrWorkflow.busy)
      return "Herdr is handling another workflow attempt. Wait before dispatching.";
  } else {
    if (!runtime?.cliAvailable)
      return "Claude Code is not detected. Check the CLI in project settings before enabling this step.";
    if ((stage === "plan" || stage === "implement") && !project.projectPath)
      return "Set this project’s workspace in Studio settings before running this step.";
  }
  return stage === "implement" && !project.allowImplementation
    ? "Implementation permission is required for this project. Enable it in Studio settings → Agent workspace."
    : "";
}
