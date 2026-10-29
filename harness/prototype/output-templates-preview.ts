import type { WorkflowOutputTemplateActions } from "../../src/plugin/features/coforge/application/workflow-output-templates";
import {
  outputTemplateIdCheck,
  workflowOutputTemplateInputCheck,
  type WorkflowOutputTemplate,
} from "../../src/plugin/features/coforge/domain/workflow-output-templates";
import { contextEventId } from "../../src/plugin/features/coforge/domain/integrity";

/** Explicit browser preview only: authored templates stay in memory, never in a vault. */
export function createOutputTemplatesPreview(
  assertProject: (id: string) => void,
): WorkflowOutputTemplateActions {
  const templates = new Map<string, WorkflowOutputTemplate>();
  const project = (id: string) => {
    outputTemplateIdCheck(id);
    assertProject(id);
  };
  const existing = (projectId: string, id: string, revision?: string) => {
    project(projectId);
    const current = templates.get(outputTemplateIdCheck(id));
    if (!current || current.projectId !== projectId)
      throw new Error(
        "The output template is missing from this project. Refresh before continuing.",
      );
    if (current.revision !== revision)
      throw new Error(
        "The output template changed. Refresh before saving; your draft is preserved.",
      );
    return current;
  };
  return {
    list: async (projectId) => {
      project(projectId);
      return {
        templates: structuredClone(
          [...templates.values()]
            .filter((item) => item.projectId === projectId)
            .sort((a, b) => a.name.localeCompare(b.name)),
        ),
        invalid: [],
      };
    },
    save: async (projectId, value, expectedRevision) => {
      project(projectId);
      const input = workflowOutputTemplateInputCheck(value);
      if (input.id) existing(projectId, input.id, expectedRevision);
      else if (expectedRevision !== undefined)
        throw new Error(
          "The output template is missing. Refresh before saving.",
        );
      const authored = {
        id: input.id ?? crypto.randomUUID(),
        projectId,
        name: input.name,
        markdown: input.markdown,
      };
      const saved = {
        ...authored,
        revision: contextEventId(JSON.stringify(authored)),
      };
      templates.set(saved.id, saved);
      return structuredClone(saved);
    },
    remove: async (projectId, id, expectedRevision) => {
      existing(projectId, id, expectedRevision);
      templates.delete(id);
    },
    open: async () => {
      throw new Error(
        "Canonical Markdown notes open in Obsidian. Browser preview templates remain temporary in memory.",
      );
    },
  };
}
