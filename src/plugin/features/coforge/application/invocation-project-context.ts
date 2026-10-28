import type { AppState } from "../domain/types";

export interface InvocationProjectContext {
  name: string;
  brief: string;
  agentPrompt: string;
}
export interface InvocationExecutionLimits {
  timeoutSeconds: number;
  maxTurns: number;
  maxBudgetUsd: number;
}
/** Resolve the owning project, independently of whichever project the studio currently displays. */
export function captureInvocationProject(
  state: Pick<AppState, "projects">,
  projectId: string,
): InvocationProjectContext {
  const project = state.projects?.find(
    (item) => item.id === projectId && !item.unavailable,
  );
  if (!project) throw new Error("The owning project is unavailable.");
  return {
    name: project.settings.projectName,
    brief: project.settings.projectBrief,
    agentPrompt: project.settings.agentPrompt,
  };
}
export function projectInvocationInstructions(
  projectPrompt: string | undefined,
  instructions: string,
): string {
  const combined = projectPrompt
    ? `${projectPrompt}\n\n${instructions}`
    : instructions;
  if (combined.length > 16000)
    throw new Error(
      "The assembled project, agent and step instructions exceed 16,000 characters. Shorten the authored prompts before dispatch.",
    );
  return combined;
}
export function captureInvocationLimits(
  state: Pick<AppState, "projects">,
  projectId: string,
): InvocationExecutionLimits {
  const project = state.projects?.find(
    (item) => item.id === projectId && !item.unavailable,
  );
  if (!project) throw new Error("The owning project is unavailable.");
  return {
    timeoutSeconds: project.settings.timeoutSeconds,
    maxTurns: project.settings.maxTurns,
    maxBudgetUsd: project.settings.maxBudgetUsd,
  };
}
