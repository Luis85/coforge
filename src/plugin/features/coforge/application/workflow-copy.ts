import { workflowDefinitionCheck, workflowIdCheck, type WorkflowDefinition } from '../domain/configured-workflow';

export interface WorkflowCopyPreview { definition: WorkflowDefinition; warnings: string[] }

/** Reuse only an authored definition. Project-owned references require new explicit selections. */
export function prepareWorkflowCopy(source: WorkflowDefinition, revision: string): WorkflowCopyPreview {
  const definition = structuredClone(workflowDefinitionCheck(source));
  definition.revision = workflowIdCheck(revision);
  const warnings: string[] = [];
  for (const step of definition.steps) {
    if (step.kind === 'ai' && step.outputTemplateId) {
      delete step.outputTemplateId;
      warnings.push(`${step.name}: choose an answer template from this project if one is needed. The source project's template selection is cleared.`);
    }
    if (step.kind === 'council') {
      step.councilId = '';
      warnings.push(`${step.name}: select a Council belonging to this project before saving.`);
    }
    if (step.kind === 'nudge') {
      step.teamId = ''; step.agentId = '';
      warnings.push(`${step.name}: select this project's team and an allowed CoWorker recipient before saving.`);
    }
  }
  return { definition, warnings };
}
