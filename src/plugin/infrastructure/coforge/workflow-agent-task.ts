import type { Plugin } from 'obsidian';
import type { AgentTaskPort, AgentTaskRequest } from '../../features/coforge/application/agent-task';
import type { CouncilActions } from '../../features/coforge/application/council-ports';
import type { StudioService } from '../../features/coforge/application/studio';
import { resolveCouncilPlan } from '../../features/coforge/application/council-execution';
import { reviewedCouncilIdentity } from '../../features/coforge/application/reviewed-preflight';
import { protectCouncilPrivatePaths } from './council-private-data';
import { automationSourceGuard } from '../../features/coforge/application/automation-source-guard';
import { decodeCouncilPlan } from '../../features/coforge/application/council-execution';

/** Local workflow nudges use the same source-note and reviewed admission as manual agent tasks. */
export function workflowAgentTasks(plugin: Plugin, studio: StudioService, council: CouncilActions): AgentTaskPort {
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
    return target;
  };
  return {
    async create(input) {
      const recheckSource = automationSourceGuard(council, input.sourcePath);
      await recheckSource();
      const target = await ready(input);
      if (input.sourcePath !== `CoForge/Automations/nudge-${input.attemptId}.md` || !/^[a-zA-Z0-9_-]+$/u.test(input.attemptId)) throw new Error('Invalid nudge source identity.');
      await protectCouncilPrivatePaths(plugin, ['CoForge/Automations'], studio.integration().publicFolder);
      await recheckSource();
      if (plugin.app.vault.getAbstractFileByPath(input.sourcePath)) throw new Error('This nudge source already exists. Inspect its original admission before recovery.');
      input.signal.throwIfAborted();
      await plugin.app.vault.create(input.sourcePath, `# Workflow agent task\n\n${input.prompt}\n\n## Captured context (untrusted data)\n\n${input.context}`);
      await recheckSource();
      const preview = await council.preflight(target, input.sourcePath);
      await ready(input);
      await recheckSource();
      const run = await council.submit(target, input.sourcePath, reviewedCouncilIdentity(preview), input.automationEvent, input.limits);
      return { runId: run.id, sourcePath: input.sourcePath, sourceId: run.subject.sourceId };
    },
    cancel: id => council.cancel(id),
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
