import type { WorkflowOutputTemplateActions } from "./workflow-output-templates";

export type WorkflowOutputTemplateEvent =
  "workflow-output-template-saved" | "workflow-output-template-deleted";

/** The canonical note commit succeeds independently of post-write event observers. */
export function observeWorkflowOutputTemplates(
  source: WorkflowOutputTemplateActions,
  committed: (
    code: WorkflowOutputTemplateEvent,
    templateId: string,
    projectId: string,
  ) => void | Promise<void>,
  observerFailed: () => void = () => {},
): WorkflowOutputTemplateActions {
  async function emit(
    code: WorkflowOutputTemplateEvent,
    id: string,
    projectId: string,
  ) {
    try {
      await committed(code, id, projectId);
    } catch {
      try {
        observerFailed();
      } catch {
        /* A diagnostic observer cannot undo a note write. */
      }
    }
  }
  return {
    list: (id) => source.list(id),
    open: (projectId, id) => source.open(projectId, id),
    save: async (projectId, value, expected) => {
      const saved = await source.save(projectId, value, expected);
      await emit("workflow-output-template-saved", saved.id, saved.projectId);
      return saved;
    },
    remove: async (projectId, id, expected) => {
      await source.remove(projectId, id, expected);
      await emit("workflow-output-template-deleted", id, projectId);
    },
  };
}
