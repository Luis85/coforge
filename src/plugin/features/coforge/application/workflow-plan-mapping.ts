import { planOutput } from "./agent-prompts";
import { workflowPlanCheck } from "../domain/configured-workflow-run";
import { planMarkdown, type ImplementationPlan } from "../domain/types";
import type { ExecutionRun, ExecutionSubject } from "../domain/execution-run";

/** A model must return the structured plan contract; prose can never acquire plan authority by renaming it. */
export function validatedWorkflowPlan(
  value: unknown,
  createdAt: string,
): ImplementationPlan {
  const plan = planOutput(value);
  return workflowPlanCheck({
    ...plan,
    markdown: planMarkdown(plan),
    createdAt,
  });
}
export interface ValidatedWorkflowPlanMapping {
  runId: string;
  artifactId: string;
  sourceArtifactIds: string[];
  subject: ExecutionSubject;
  projectId: string;
  teamId: string;
  plan: ImplementationPlan;
}
export function workflowPlanMapping(
  run: ExecutionRun,
  artifactId: string,
): ValidatedWorkflowPlanMapping {
  if (run.state !== "completed")
    throw new Error(
      "Complete the workflow and its manual decisions before mapping a plan to another process.",
    );
  const artifact = run.artifacts.find((item) => item.id === artifactId);
  const invocation = run.invocations.find(
    (item) => item.id === artifact?.invocationId,
  );
  if (
    !artifact?.plan ||
    artifact.skipped ||
    invocation?.output !== "plan" ||
    !run.attempts.some(
      (attempt) =>
        attempt.artifactId === artifact.id && attempt.status === "published",
    )
  )
    throw new Error(
      "Select a published artifact with a validated plan contract. Council prose and synthesis are proposals.",
    );
  if (
    artifact.inputArtifactIds.some(
      (id) =>
        !run.artifacts.some(
          (input) =>
            input.id === id &&
            run.attempts.some(
              (attempt) =>
                attempt.artifactId === id && attempt.status === "published",
            ),
        ),
    )
  )
    throw new Error(
      "The plan mapping contains unavailable or unpublished source artifacts.",
    );
  const checked = workflowPlanCheck(artifact.plan);
  return {
    runId: run.id,
    artifactId,
    sourceArtifactIds: [...artifact.inputArtifactIds],
    subject: structuredClone(run.subject),
    projectId: run.projectId,
    teamId: run.teamId,
    plan: {
      ...checked,
      markdown: planMarkdown(checked),
      createdAt: artifact.createdAt,
    },
  };
}
