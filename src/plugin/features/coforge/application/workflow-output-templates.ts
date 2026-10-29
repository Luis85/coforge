import {
  outputTemplateIdCheck,
  workflowOutputTemplateCheck,
  type WorkflowOutputTemplate,
  type WorkflowOutputTemplateInput,
} from "../domain/workflow-output-templates";
export type {
  WorkflowOutputTemplate,
  WorkflowOutputTemplateInput,
} from "../domain/workflow-output-templates";

export interface WorkflowOutputTemplateCatalogue {
  templates: WorkflowOutputTemplate[];
  invalid: { path: string; reason: string }[];
}
/** Safe admission feedback; underlying vault/provider errors are never persisted. */
export class WorkflowOutputTemplateUnavailableError extends Error {
  constructor(
    message = "The workflow could not read its output templates. Refresh templates in Workflow settings, repair the selection, then explicitly retry starting the workflow.",
  ) {
    super(message);
    this.name = "WorkflowOutputTemplateUnavailableError";
  }
}
/** Canonical Markdown authoring and immutable snapshot reads; no execution capability. */
export interface WorkflowOutputTemplateActions {
  references?(
    projectId: string,
    id: string,
  ): Promise<
    import("./workflow-output-template-usage").WorkflowOutputTemplateUsage
  >;
  list(projectId: string): Promise<WorkflowOutputTemplateCatalogue>;
  save(
    projectId: string,
    value: WorkflowOutputTemplateInput,
    expectedRevision?: string,
  ): Promise<WorkflowOutputTemplate>;
  remove(
    projectId: string,
    id: string,
    expectedRevision: string,
  ): Promise<void>;
  open(projectId: string, id: string): Promise<void>;
}
export async function captureWorkflowOutputTemplates(
  projectId: string,
  steps: readonly { outputTemplateId?: string }[],
  source?: Pick<WorkflowOutputTemplateActions, "list">,
): Promise<WorkflowOutputTemplate[]> {
  const ids = [
    ...new Set(
      steps.flatMap((step) =>
        step.outputTemplateId
          ? [outputTemplateIdCheck(step.outputTemplateId)]
          : [],
      ),
    ),
  ];
  if (!ids.length) return [];
  if (!source)
    throw new WorkflowOutputTemplateUnavailableError(
      "Output templates are unavailable in this host. Clear the template selection or restore the template service before running.",
    );
  const catalogue = await source.list(projectId).catch(() => {
    throw new WorkflowOutputTemplateUnavailableError();
  });
  return ids.map((id) => {
    const matching = catalogue.templates.filter((item) => item.id === id);
    if (matching.length !== 1)
      throw new WorkflowOutputTemplateUnavailableError(
        "An output template is missing or invalid. Refresh templates and clear or replace the selection before starting a new run.",
      );
    const template = workflowOutputTemplateCheck(matching[0]);
    if (template.projectId !== projectId)
      throw new WorkflowOutputTemplateUnavailableError(
        "The output template belongs to another project. Select a template owned by this project.",
      );
    return structuredClone(template);
  });
}
