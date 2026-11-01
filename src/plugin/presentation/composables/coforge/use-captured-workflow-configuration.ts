import { computed, reactive } from "vue";
import type { WorkflowRun } from "../../../features/coforge/domain/configured-workflow-run";
import { buildDuration } from './durable-build-display';
import { CODEX_PROVIDER_CONTEXT_HELP } from './codex-provider-context';
import { codingProfileDisplay } from './coding-profile-display';
import { useStudioStore } from '../../stores/coforge-studio';

/** Provenance comes entirely from the selected run; current definitions are never read. */
export function useCapturedWorkflowConfiguration(run: () => WorkflowRun) {
  const store = useStudioStore();
  const providers = { demo: 'Simulation', claude: 'Claude Code', codex: 'Codex', herdr: 'Herdr · Claude Code' };
  return reactive({
    workflowName: computed(() => run().definition.name),
    workflowRevision: computed(() => run().definition.revision),
    providerContextHelp: computed(() => !run().external && run().definition.steps.some(step => step.kind === 'ai' && step.provider === 'codex') ? CODEX_PROVIDER_CONTEXT_HELP : ''),
    nativePolicies: computed(() => run().definition.steps.flatMap(step => step.kind === 'ai' && step.nativeTools ? [{ id: step.id, name: step.name, tools: step.nativeTools }] : [])),
    codingProfiles: computed(() => store.state?.activeProjectId === run().projectId ? (store.state.jobs ?? []).flatMap(job => {
      const execution = job.workflow;
      const attempt = run().attempts.find(attempt => attempt.id === execution?.attemptId);
      if (!execution || job.ideaId !== run().ideaId || job.projectId && job.projectId !== run().projectId || execution.runId !== run().id
        || !attempt || attempt.jobId && attempt.jobId !== job.id || attempt.stepId !== execution.step.id
        || execution.definitionRevision !== run().definition.revision || execution.proposalRevision !== run().proposalRevision
        || !['claude', 'codex', 'mcp'].includes(job.provider) || job.conversation?.simulated || execution.step.output !== 'codechange' || execution.step.access !== 'editworktree') return [];
      const profile = execution.worktreeCoding ? codingProfileDisplay(execution.worktreeCoding) : undefined;
      return [{ id: job.id, attemptId: execution.attemptId, stepName: execution.step.name, provider: job.provider === 'mcp' ? 'External MCP client' : job.provider === 'codex' ? 'Codex' : 'Claude Code',
        profile: profile?.profile ?? 'legacy', title: profile?.title ?? 'Legacy scoped tools', help: profile?.help ?? 'No worktree coding profile was captured for this admitted attempt. Its original tool contract is retained.',
        assistants: profile?.assistants ?? '', boundary: profile?.boundary ?? '' }];
    }) : []),
    executionPolicies: computed(() => run().definition.steps.flatMap(step => step.kind === 'ai' && step.output === 'codechange' ? [{
      id: step.id, name: step.name,
      execution: run().external ? 'External MCP client lifecycle' : step.provider === 'herdr' ? 'External Herdr lifecycle' : step.execution ? 'Background Build' : 'Foreground',
      deadline: run().external ? 'Native deadline not applied by CoForge' : step.execution ? step.execution.maxRuntimeSeconds === undefined ? 'No elapsed deadline' : buildDuration(step.execution.maxRuntimeSeconds) : `${run().definition.limits.timeoutSeconds} seconds ${step.provider === 'herdr' ? 'CoForge wait' : 'timeout'}`,
      turns: step.execution?.maxTurns ?? run().definition.limits.maxTurns,
      budget: step.execution?.maxBudgetUsd ?? run().definition.limits.maxBudgetUsd,
    }] : [])),
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
