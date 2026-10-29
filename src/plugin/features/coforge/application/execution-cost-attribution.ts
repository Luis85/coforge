import type { AICostAttribution } from '../domain/ai-cost-attribution';
import type { ExecutionRun, ExecutionInvocation } from '../domain/execution-run';
import type { MessageOutboxEntry } from '../domain/team-messages';
import { decodeCouncilPlan } from './council-execution';
import { decodeWorkflowV2Plan, isWorkflowV2Run } from './workflow-v2-execution';

/** Only the captured plan supplies historical entity names; absent evidence stays unidentified. */
export function costAttributionForRun(run: ExecutionRun, messages: readonly MessageOutboxEntry[]) {
  const origin = messages.find(entry => entry.message.id === run.subject.sourceId)?.message;
  const base: AICostAttribution = {
    kind: 'execution', runId: run.id, teamId: run.teamId, subjectKind: run.subject.kind,
    rootRunId: origin?.rootId ?? run.id,
    ...(origin ? { parentRunId: origin.runId, messageId: origin.id } : {}),
  };
  const names = new Map<string, string>();
  const councils = new Map<string, { id: string; name: string }>();
  try {
    if (isWorkflowV2Run(run)) {
      const plan = decodeWorkflowV2Plan(run);
      base.kind = 'workflow'; base.teamName = plan.catalogue.team.name;
      base.workflowName = plan.definition.name; base.workflowRevision = plan.definition.revision;
      for (const agent of plan.catalogue.agents) names.set(agent.id, agent.name);
      for (const invocation of run.invocations) {
        const owner = plan.councils.find(item => plan.producerInvocationIds[item.stepId]?.includes(invocation.id));
        if (owner) councils.set(invocation.id, { id: owner.plan.definition.id, name: owner.plan.definition.name });
      }
    } else {
      const plan = decodeCouncilPlan(run);
      base.kind = plan.targetKind === 'agent' ? 'agent' : 'council';
      base.teamName = plan.team.name;
      for (const item of plan.invocations) names.set(item.agent.id, item.agent.name);
      if (base.kind === 'council') {
        base.councilId = plan.definition.id; base.councilName = plan.definition.name;
      }
    }
  } catch { /* Old journals retain IDs and costs without invented names or target kind. */ }
  return (invocation: ExecutionInvocation): AICostAttribution => {
    const council = councils.get(invocation.id);
    const agentName = names.get(invocation.agentId);
    return { ...base, agentId: invocation.agentId, agentNamespace: 'reusable', agentRevision: invocation.agentRevision,
      invocationId: invocation.id, ...(agentName ? { agentName } : {}),
      ...(council ? { councilId: council.id, councilName: council.name } : {}) };
  };
}
