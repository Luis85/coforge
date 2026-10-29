import { defaultCouncilDefinition, type AgentDefinition, type TeamDefinition } from '../../../features/coforge/domain/council-definitions';
import { compileCouncil } from '../../../features/coforge/domain/council-protocol';
import { councilAdmission } from '../../../features/coforge/application/council-execution';
import { compileWorkflowV2 } from '../../../features/coforge/application/workflow-v2-compiler';
import { workflowV2Admission } from '../../../features/coforge/application/workflow-v2-execution';
import type { ExecutionRun } from '../../../features/coforge/domain/execution-run';
export const costAgent: AgentDefinition = { schema: 'agent/v1', id: 'reviewer', name: 'Pinned reviewer', enabled: true, role: 'Review', instructions: 'Private instructions stay private.', provider: 'claude', model: 'sonnet', contextSources: [], requestedCapabilities: { project: 'none', messaging: false } };
export const costTeam: TeamDefinition = { schema: 'team/v1', id: 'team', name: 'Pinned studio team', enabled: true, projectId: 'CFP-001', members: [costAgent.id], pinnedContext: [], recentMessages: 10, allowedRecipients: [] };
export const costCouncil = defaultCouncilDefinition('design', 'Pinned design council', costTeam, [costAgent.id]);
const source = { sourceId: 'question-one', revision: 'source-revision', generation: 1, markdown: '# Lighting options\n\nPrivate question body.' };
const limits = { timeoutSeconds: 180, maxTurns: 12, maxBudgetUsd: 1, simulation: false };
export function attributedRun(id: string, kind: 'agent' | 'council' | 'workflow' = 'council'): ExecutionRun {
  const plan = compileCouncil(costCouncil, costTeam, [costAgent]);
  const admission = kind === 'workflow'
    ? workflowV2Admission({ plan: compileWorkflowV2({ format: 'coforge-workflow/v2', revision: 'proposal-v2', name: 'Pinned proposal workflow', subjectMode: 'note', teamId: costTeam.id, limits: { timeoutSeconds: 180, maxTurns: 12, maxBudgetUsd: 1, maxInvocations: 10 }, collections: [], steps: [{ id: 'discuss', name: 'Discuss options', instructions: '', kind: 'council', councilId: costCouncil.id, inputs: [] }] }, { kind: 'note', sourceId: source.sourceId, revision: source.revision, markdown: source.markdown }, { projectId: costTeam.projectId, team: costTeam, agents: [costAgent], councils: [costCouncil] }), source, context: '', invocations: 2, warnings: [] }, id, `${id}-submission`, false)
    : councilAdmission({ plan: { ...plan, targetKind: kind }, source, context: '', invocations: plan.invocations.length, warnings: [] }, id, `${id}-submission`, limits);
  return { ...admission, cursor: 0, state: 'attention', createdAt: '2026-10-28T10:00:00Z', updatedAt: '2026-10-28T10:00:01Z', artifacts: [], attempts: [{ id: `${id}-attempt`, invocationId: admission.invocations[0]!.id, status: 'unknown', startedAt: '2026-10-28T10:00:00Z', dispatch: { prompt: 'Private dispatch', inputArtifactIds: [] }, costUsd: 0.1, usage: { inputTokens: 10, outputTokens: 2 } }] };
}

export function fanOutCostRun(): ExecutionRun {
  const peer = { ...costAgent, id: 'peer', name: 'Pinned peer' };
  const team = { ...costTeam, members: [costAgent.id, peer.id] };
  const council = defaultCouncilDefinition(costCouncil.id, costCouncil.name, team, team.members);
  council.rounds = council.rounds.map(round => ({ ...round, promptOrder: 'fan-out' as const }));
  const plan = compileCouncil(council, team, [costAgent, peer]);
  const admission = councilAdmission({ plan, source, context: '', invocations: plan.invocations.length, warnings: [] }, 'fan-out-run', 'fan-out-key', limits);
  const first = admission.invocations[0]!; const second = admission.invocations[1]!;
  return { ...admission, cursor: 0, state: 'attention', createdAt: '2026-10-28T10:00:00Z', updatedAt: '2026-10-28T10:00:01Z',
    attempts: [second, first].map((invocation, index) => ({ id: `peer-attempt-${index}`, invocationId: invocation.id, status: 'unknown' as const, startedAt: '2026-10-28T10:00:00Z', dispatch: { prompt: 'Private peer dispatch', inputArtifactIds: [] }, costUsd: index === 0 ? 0.2 : 0.1 })), artifacts: [] };
}
