import type { Plugin } from 'obsidian';
import { AgentTaskNotStartedError, type AgentTaskPort, type AgentTaskRequest } from '../../features/coforge/application/agent-task';
import type { CouncilActions } from '../../features/coforge/application/council-ports';
import type { StudioService } from '../../features/coforge/application/studio';
import { resolveCouncilPlan } from '../../features/coforge/application/council-execution';
import { reviewedCouncilIdentity } from '../../features/coforge/application/reviewed-preflight';
import { protectCouncilPrivatePaths } from './council-private-data';
import { automationSourceGuard } from '../../features/coforge/application/automation-source-guard';
import { captureWorkflowCouncil } from '../../features/coforge/application/workflow-council-context';
import type { CouncilTarget } from '../../features/coforge/application/council-execution';
import { decodeCouncilPlan } from '../../features/coforge/application/council-execution';
import { captureWorkflowCoworker } from '../../features/coforge/domain/workflow-coworker-binding';

/** Local workflow nudges use the same source-note and reviewed admission as manual agent tasks. */
export function workflowAgentTasks(plugin: Plugin, studio: StudioService, council: CouncilActions): AgentTaskPort {
  const prepareCouncil = async (projectId: string, councilId: string) => {
    try {
      const catalogue = await council.catalogue.list();
      const definition = catalogue.valid.find(item => item.definition.id === councilId)?.definition;
      if (definition?.schema !== 'council/v1') throw new Error('The selected Council is unavailable. Repair it in The Council setup.');
      const plan = resolveCouncilPlan(catalogue, { kind: 'council', id: councilId, teamId: definition.teamId });
      const project = studio.state().projects?.find(item => item.id === projectId && !item.unavailable);
      if (!project || plan.team.projectId !== projectId) throw new Error('Choose an enabled Council in this project.');
      if (plan.invocations.some(item => item.agent.provider === 'demo')) throw new Error('This Council uses Simulation. Request workflow actions require live Claude CoWorkers. Try a simulation from The Council, or choose live CoWorkers before starting this workflow.');
      if (plan.invocations.some(item => item.agent.provider === 'herdr')) throw new Error('Herdr does not support isolated Council workflow invocations. Choose live Claude CoWorkers.');
      return captureWorkflowCouncil(plan, project);
    } catch (error) { throw new AgentTaskNotStartedError(error instanceof Error ? error.message : 'Council setup could not be captured.'); }
  };
  const ready = async (input: AgentTaskRequest) => {
    input.signal.throwIfAborted(); await council.assertExecutor?.();
    const state = council.snapshot();
    if (!state.ready || !state.executor || (!input.councilId && (state.paused || state.preferences.pausedProjectIds?.includes(input.projectId)))) throw new Error('Choose the designated execution desktop; agent nudges also require resumed execution.');
    if (!studio.state().projects?.some(project => project.id === input.projectId && !project.unavailable)) throw new Error('The nudge project is unavailable.');
    const catalogue = await council.catalogue.list();
    const definition = catalogue.valid.find(item => item.definition.id === input.councilId)?.definition;
    if (input.councilId && definition?.schema !== 'council/v1') throw new Error('The selected Council is unavailable.');
    const target = input.councilId && definition?.schema === 'council/v1'
      ? { kind: 'council' as const, id: input.councilId, teamId: definition.teamId }
      : { kind: 'agent' as const, id: input.agentId, teamId: input.teamId };
    const plan = resolveCouncilPlan(catalogue, target);
    if (plan.team.projectId !== input.projectId || !plan.team.enabled || (!input.councilId && !plan.team.allowedRecipients.includes(input.agentId))) throw new Error('Choose an enabled Council or allowed agent recipient in this project.');
    if (plan.invocations.some(invocation => invocation.agent.provider === 'demo')) throw new Error('Agent nudges require a native agent; use the Council test controls for simulation.');
    if (input.councilId) {
      const binding = await prepareCouncil(input.projectId, input.councilId);
      if (!input.councilBinding || input.councilBinding.identity !== binding.identity || input.councilBinding.projectId !== binding.projectId || input.councilBinding.councilId !== binding.councilId) throw new AgentTaskNotStartedError('Council membership, providers, instructions or project context changed after this workflow started. Review setup, stop this workflow and start a new one.');
      if (plan.invocations.some(item => item.agent.provider === 'claude' && !studio.state().runtime.cliAvailable || item.agent.provider === 'codex' && !studio.state().runtime.codexAvailable)) throw new AgentTaskNotStartedError('The selected native runtime is unavailable. Check Project settings → Runtime before retrying this step.');
    }
    return target;
  };
  return {
    async prepareCoworker(projectId, coworkerId) {
      if (!studio.state().projects?.some(project => project.id === projectId && !project.unavailable)) throw new AgentTaskNotStartedError('Choose an available project before assigning a CoWorker.');
      let catalogue: import('../../features/coforge/application/council-catalogue').CouncilCatalogueSnapshot;
      try { catalogue = await council.catalogue.list(); }
      catch { throw new AgentTaskNotStartedError('Saved CoWorker definitions could not be loaded. Refresh or repair the catalogue before starting.'); }
      const entry = catalogue.valid.find(item => item.definition.id === coworkerId);
      if (!entry || entry.definition.schema !== 'agent/v1') throw new AgentTaskNotStartedError('The selected CoWorker is unavailable. Refresh saved CoWorkers before starting.');
      if (!entry.definition.enabled) throw new AgentTaskNotStartedError('The selected CoWorker is disabled. Choose an enabled saved CoWorker.');
      try { return captureWorkflowCoworker(entry.definition, entry.revision); }
      catch { throw new AgentTaskNotStartedError('The selected CoWorker configuration is invalid. Repair its saved definition before starting.'); }
    },
    prepareCouncil,
    async create(input) {
      const recheckSource = automationSourceGuard(council, input.sourcePath);
      let target: CouncilTarget;
      try {
        await recheckSource(); target = await ready(input);
        if (input.sourcePath !== `CoForge/Automations/nudge-${input.attemptId}.md` || !/^[a-zA-Z0-9_-]+$/u.test(input.attemptId)) throw new Error('Invalid workflow task source identity.');
        await protectCouncilPrivatePaths(plugin, ['CoForge/Automations'], studio.integration().publicFolder);
        await recheckSource(); input.signal.throwIfAborted();
      } catch (error) {
        if (input.councilId) throw new AgentTaskNotStartedError(error instanceof Error ? error.message : 'Council preparation failed before admission.');
        throw error;
      }
      if (plugin.app.vault.getAbstractFileByPath(input.sourcePath)) throw new Error('This nudge source already exists. Inspect its original admission before recovery.');
      input.signal.throwIfAborted();
      const title = input.councilId && input.title?.trim() ? input.title.replace(/[\r\n]+/gu, ' ').trim().slice(0, 160) : 'Workflow agent task';
      await plugin.app.vault.create(input.sourcePath, `# ${title}\n\n${input.prompt}\n\n## Captured context (untrusted data)\n\n${input.context}`);
      await recheckSource();
      const preview = await council.preflight(target, input.sourcePath);
      await ready(input);
      await recheckSource();
      const run = await council.submit(target, input.sourcePath, reviewedCouncilIdentity(preview), input.automationEvent, input.limits);
      return { runId: run.id, sourcePath: input.sourcePath, sourceId: run.subject.sourceId };
    },
    async cancel(id) {
      const run = council.snapshot().runs.find(item => item.id === id);
      if (run && ['completed', 'cancelled'].includes(run.state)) return;
      await council.cancel(id);
    },
    async result(id) {
      const run = council.snapshot().runs.find(item => item.id === id);
      if (!run) return { state: 'missing' };
      if (run.state === 'attention' || run.state === 'waiting-human') return { state: 'attention' };
      if (run.state === 'cancelled') return { state: 'cancelled' };
      if (run.state !== 'completed') return { state: 'pending' };
      if (run.limits?.simulation || run.hasGaps || run.artifacts.length !== run.invocations.length || run.artifacts.some(item => item.simulated || item.skipped || !run.attempts.some(attempt => attempt.artifactId === item.id && attempt.status === 'published'))) return { state: 'attention' };
      const plan = decodeCouncilPlan(run);
      const markdown = plan.invocations.map(item => run.artifacts.find(artifact => artifact.invocationId === item.id)!).map(artifact => {
        const invocation = plan.invocations.find(item => item.id === artifact.invocationId);
        return `## ${invocation?.agent.name ?? artifact.agentId} · ${invocation?.roundName ?? artifact.roundId}\n\n${artifact.markdown}\n\nEvidence: ${run.id} / ${artifact.id}`;
      }).join('\n\n');
      const path = council.snapshot().intake.find(item => item.sourceId === run.subject.sourceId)?.path;
      return { state: 'completed', projectId: run.projectId, sourcePath: path ?? '', sourceId: run.subject.sourceId, markdown };
    },
  };
}
