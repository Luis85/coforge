import { computed, reactive } from "vue";
import type { WorkflowRun } from "../../../features/coforge/domain/configured-workflow-run";

/** Provenance comes entirely from the selected run; current definitions are never read. */
export function useCapturedWorkflowConfiguration(run: () => WorkflowRun) {
  const providers = { demo: 'Simulation', claude: 'Claude Code', codex: 'Codex', herdr: 'Herdr · Claude Code' };
  return reactive({
    workflowName: computed(() => run().definition.name),
    workflowRevision: computed(() => run().definition.revision),
    startedAt: computed(() =>
      new Date(run().createdAt).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    ),
    templates: computed(() =>
      (run().outputTemplates ?? []).map((template) => ({
        ...template,
        steps: run()
          .definition.steps.filter(
            (step) =>
              step.kind === "ai" && step.outputTemplateId === template.id,
          )
          .map((step) => step.name)
          .join(", "),
      })),
    ),
    coworkers: computed(() => (run().coworkerBindings ?? []).map(binding => ({
      ...binding.profile,
      stepId: binding.stepId,
      stepName: run().definition.steps.find(step => step.id === binding.stepId)?.name ?? binding.stepId,
      execution: `${providers[binding.profile.provider]} · ${binding.profile.model}${binding.profile.effort ? ` · ${binding.profile.effort} effort` : ''}`,
    }))),
  });
}
