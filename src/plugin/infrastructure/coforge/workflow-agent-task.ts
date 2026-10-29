import type { Plugin } from 'obsidian';
import type { AgentTaskPort, AgentTaskRequest } from '../../features/coforge/application/agent-task';
import type { CouncilActions } from '../../features/coforge/application/council-ports';
import type { StudioService } from '../../features/coforge/application/studio';
import { resolveCouncilPlan } from '../../features/coforge/application/council-execution';
import { reviewedCouncilIdentity } from '../../features/coforge/application/reviewed-preflight';
import { protectCouncilPrivatePaths } from './council-private-data';
import { automationSourceGuard } from '../../features/coforge/application/automation-source-guard';

/** Local workflow nudges use the same source-note and reviewed admission as manual agent tasks. */
export function workflowAgentTasks(plugin: Plugin, studio: StudioService, council: CouncilActions): AgentTaskPort {
  const ready = async (input: AgentTaskRequest) => {
    input.signal.throwIfAborted(); await council.assertExecutor?.();
    const state = council.snapshot();
    if (!state.ready || !state.executor || state.paused || state.preferences.pausedProjectIds?.includes(input.projectId)) throw new Error('Resume execution on the designated desktop before nudging an agent.');
    if (!studio.state().projects?.some(project => project.id === input.projectId && !project.unavailable)) throw new Error('The nudge project is unavailable.');
    const target = { kind: 'agent' as const, id: input.agentId, teamId: input.teamId };
    const plan = resolveCouncilPlan(await council.catalogue.list(), target);
    if (plan.team.projectId !== input.projectId || !plan.team.enabled || !plan.team.allowedRecipients.includes(input.agentId)) throw new Error('Choose an enabled team in this project and an allowed agent recipient.');
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
      return { runId: run.id, sourcePath: input.sourcePath };
    },
    cancel: id => council.cancel(id),
  };
}
