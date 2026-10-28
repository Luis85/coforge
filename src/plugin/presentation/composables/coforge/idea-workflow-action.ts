import type {
  Idea,
  RuntimeInfo,
  StudioProject,
} from "../../../features/coforge/domain/types";
import { workflowDefinition } from "../../../features/coforge/domain/configured-workflow";
import {
  configuredAgentLabel,
  configuredStepProblem,
} from "./configured-workflow-display";
import { ideaFingerprint } from "../../../features/coforge/domain/integrity";
export interface IdeaWorkflowAction {
  kind: "run" | "open";
  label: string;
  description: string;
  blocked: string;
  demo: boolean;
}
export function ideaWorkflowAction(
  idea: Idea,
  project: StudioProject | undefined,
  runtime: RuntimeInfo | undefined,
): IdeaWorkflowAction | undefined {
  if (!project || ["shipped", "rejected", "flagged"].includes(idea.status))
    return;
  const run = idea.workflowRun;
  if (
    run?.state === "running" ||
    run?.state === "awaiting-review" ||
    (!run && idea.status === "review")
  )
    return;
  if (run && ["waiting-human", "finished", "stopped"].includes(run.state))
    return {
      kind: "open",
      label:
        run.state === "waiting-human"
          ? "Review manual workflow step"
          : "View workflow run",
      description:
        run.state === "finished"
          ? "This workflow finished without pending code changes."
          : "Inspect the saved run and its next action.",
      blocked: "",
      demo: false,
    };
  const step = (run?.definition ?? workflowDefinition(project.settings)).steps[
    run?.cursor ?? 0
  ];
  if (!step) return;
  return {
    kind: "run",
    label: `${run?.state === "attention" ? "Retry" : run ? "Run" : "Start"} · ${step.name}`,
    description: `${run?.external && step.kind === 'ai' ? 'External MCP client' : configuredAgentLabel(step)}. ${!run ? "Starts the saved workflow from its first step; prior legacy stages are not inferred." : "Uses this run’s captured definition."}`,
    blocked:
      step.kind === "ai"
        ? configuredStepProblem(step, project, runtime, idea, run)
        : "",
    demo: !run?.external && step.kind === "ai" && step.provider === "demo",
  };
}
export const ideaWorkflowActionIdentity = (
  idea: Idea,
  project: StudioProject | undefined,
): string =>
  JSON.stringify([
    ideaFingerprint(idea),
    idea.workflowRun?.id,
    idea.workflowRun?.revision,
    idea.workflowRun?.cursor,
    idea.workflowRun?.definition.revision ??
      project?.settings.workflow?.revision,
  ]);
