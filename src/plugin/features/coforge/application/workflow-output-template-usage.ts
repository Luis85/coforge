import type { WorkflowDefinition } from "../domain/configured-workflow";
import type { WorkflowV2Definition } from "../domain/configured-workflow-v2";
import { outputTemplateIdCheck } from "../domain/workflow-output-templates";
import type { WorkflowOutputTemplateActions } from "./workflow-output-templates";

export interface WorkflowOutputTemplateReference {
  workflow: "request" | "proposal";
  workflowName: string;
  stepId: string;
  stepName: string;
}
export interface WorkflowOutputTemplateUsage {
  references: WorkflowOutputTemplateReference[];
  unavailable?: string;
}
export interface WorkflowTemplateDefinitions {
  request?: WorkflowDefinition;
  proposal?: WorkflowV2Definition;
  unavailable?: string;
}

/** Read saved definition dependencies without changing drafts, runs or template notes. */
export function withWorkflowOutputTemplateUsage(
  source: WorkflowOutputTemplateActions,
  read: (projectId: string) => Promise<WorkflowTemplateDefinitions>,
): WorkflowOutputTemplateActions {
  return {
    list: (id) => source.list(id),
    save: (projectId, value, expected) =>
      source.save(projectId, value, expected),
    remove: (projectId, id, expected) => source.remove(projectId, id, expected),
    open: (projectId, id) => source.open(projectId, id),
    references: async (projectId, id) => {
      outputTemplateIdCheck(projectId);
      outputTemplateIdCheck(id);
      const definitions = await read(projectId);
      const references: WorkflowOutputTemplateReference[] = [];
      for (const [kind, definition] of [
        ["request", definitions.request],
        ["proposal", definitions.proposal],
      ] as const) {
        if (!definition) continue;
        for (const step of definition.steps) {
          if (
            (step.kind === "ai" ||
              step.kind === "agent" ||
              step.kind === "council") &&
            step.outputTemplateId === id
          )
            references.push({
              workflow: kind,
              workflowName: definition.name,
              stepId: step.id,
              stepName: step.name,
            });
        }
      }
      return {
        references,
        ...(definitions.unavailable
          ? { unavailable: definitions.unavailable }
          : {}),
      };
    },
  };
}
