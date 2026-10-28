import type { StoredWorkflowV2 } from "../../features/coforge/application/workflow-v2-ports";
import {
  compileWorkflowV2,
  type WorkflowV2Catalogue,
} from "../../features/coforge/application/workflow-v2-compiler";
import type { WorkflowV2Definition } from "../../features/coforge/domain/configured-workflow-v2";
import type { MessageRecipient } from "../../features/coforge/domain/team-messages";
/** A generic message can enter only a compatible note workflow, with its full expansion reserved first. */
export async function workflowMessageRecipient(
  projectId: string,
  teamId: string,
  load: (id: string) => Promise<StoredWorkflowV2>,
  catalogueFor: (
    id: string,
    definition: WorkflowV2Definition,
  ) => Promise<WorkflowV2Catalogue>,
): Promise<MessageRecipient | null> {
  try {
    const saved = await load(projectId);
    if (
      !saved.definition ||
      saved.definition.subjectMode !== "note" ||
      saved.definition.teamId !== teamId
    )
      return null;
    const catalogue = await catalogueFor(projectId, saved.definition);
    const plan = compileWorkflowV2(
      saved.definition,
      {
        kind: "note",
        sourceId: "preflight",
        revision: "preflight",
        markdown: "Preflight only",
      },
      catalogue,
    );
    return {
      id: projectId,
      kind: "workflow",
      projectId,
      teamId,
      enabled: true,
      expectedInvocations: plan.invocations.length,
    };
  } catch {
    return null;
  }
}
