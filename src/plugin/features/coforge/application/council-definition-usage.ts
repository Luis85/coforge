import type {
  CouncilDependency,
  CouncilDependencySnapshot,
} from "./council-catalogue";
import type { WorkflowV2Actions } from "./workflow-v2-ports";
import type { StudioProject } from "../domain/types";
import type { IntakeBinding } from "../domain/intake-bindings";

/** Canonical workflow/route impact is read-only and separate from execution authority. */
export async function readCouncilDefinitionUsage(
  projects: readonly StudioProject[],
  workflows: Pick<WorkflowV2Actions, "load">,
  bindings: readonly IntakeBinding[],
  definitionId: string,
): Promise<CouncilDependencySnapshot> {
  const items: CouncilDependency[] = bindings
    .filter(
      (binding) =>
        binding.target.id === definitionId || binding.teamId === definitionId,
    )
    .map((binding) => ({
      kind: "inbox",
      id: binding.id,
      name: binding.path,
      enabled: binding.enabled,
    }));
  let complete = true;
  for (const project of projects) {
    try {
      const { definition } = await workflows.load(project.id);
      if (!definition) continue;
      const matches =
        definition.teamId === definitionId ||
        definition.steps.some(
          (step) =>
            (step.kind === "agent" && step.agentId === definitionId) ||
            (step.kind === "council" && step.councilId === definitionId) ||
            (step.kind === "message" && step.recipientId === definitionId),
        );
      if (matches)
        items.push({
          kind: "workflow",
          id: project.id,
          name: `${project.settings.projectName} / ${definition.name}`,
          enabled: !project.unavailable,
        });
    } catch {
      complete = false;
    }
  }
  return { items, complete };
}
