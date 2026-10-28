import type { CouncilCatalogueActions } from "../../src/plugin/features/coforge/application/council-catalogue";
import type { CouncilSource } from "../../src/plugin/features/coforge/application/council-execution";
import type {
  WorkflowV2Actions,
  WorkflowV2Preview,
} from "../../src/plugin/features/coforge/application/workflow-v2-ports";
import { compileWorkflowV2 } from "../../src/plugin/features/coforge/application/workflow-v2-compiler";
import type { WorkflowV2Definition } from "../../src/plugin/features/coforge/domain/configured-workflow-v2";
import type { ExecutionRun } from "../../src/plugin/features/coforge/domain/execution-run";
import { assertReviewedWorkflowIdentity } from "../../src/plugin/features/coforge/application/reviewed-preflight";

export function createCouncilPreviewWorkflows(
  catalogue: CouncilCatalogueActions,
  initial: WorkflowV2Definition,
  source: (path: string) => CouncilSource,
  start: (
    preview: WorkflowV2Preview,
    destination: string,
  ) => Promise<ExecutionRun>,
): WorkflowV2Actions {
  let definition = structuredClone(initial);
  let revision = "example-workflow";
  const preflight: WorkflowV2Actions["preflight"] = async (projectId, path) => {
    if (definition.subjectMode !== "note")
      throw new Error(
        "The browser example supplies a generic note. Existing Idea mappings require desktop Obsidian.",
      );
    const entries = (await catalogue.list()).valid.map(
      (item) => item.definition,
    );
    const team = entries.find(
      (item) => item.schema === "team/v1" && item.id === definition.teamId,
    );
    if (!team || team.schema !== "team/v1")
      throw new Error("Select the example project team.");
    const captured = source(path);
    const plan = compileWorkflowV2(
      definition,
      {
        kind: "note",
        sourceId: captured.sourceId,
        revision: captured.revision,
        markdown: captured.markdown,
      },
      {
        projectId,
        team,
        agents: entries.filter((item) => item.schema === "agent/v1"),
        councils: entries.filter((item) => item.schema === "council/v1"),
      },
    );
    return {
      plan,
      source: captured,
      context:
        "Explicit browser example. No vault, provider, credentials or filesystem access.",
      invocations: plan.invocations.length,
      warnings: [
        "Browser example: all generated output is fake and remains in memory.",
      ],
    };
  };
  return {
    load: async () => ({ definition: structuredClone(definition), revision }),
    save: async (_projectId, value, expected) => {
      if (expected !== revision)
        throw new Error(
          "The example definition changed. Reload before saving.",
        );
      definition = structuredClone(value);
      revision = crypto.randomUUID();
      return { definition: structuredClone(definition), revision };
    },
    preflight,
    start: async (
      projectId,
      path,
      simulation,
      destination,
      expectedIdentity,
    ) => {
      if (!simulation || !destination)
        throw new Error(
          "The browser example runs explicit simulation only. Choose a simulation destination.",
        );
      const preview = await preflight(projectId, path, true);
      assertReviewedWorkflowIdentity(preview, expectedIdentity);
      return start(preview, destination);
    },
  };
}
