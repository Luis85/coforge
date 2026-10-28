import { describe, expect, it } from 'vitest';
import { workflowV2DefinitionCheck, type WorkflowV2Definition } from '../../../features/coforge/domain/configured-workflow-v2';
import { compileWorkflowV2, resolveWorkflowV2Inputs } from '../../../features/coforge/application/workflow-v2-compiler';
import { defaultCouncilDefinition, type AgentDefinition, type TeamDefinition } from '../../../features/coforge/domain/council-definitions';
import type { ExecutionArtifact } from '../../../features/coforge/domain/execution-run';

const agent = (id: string): AgentDefinition => ({ schema: 'agent/v1', id, name: id, enabled: true, role: 'Reviewer', instructions: `Role ${id}`, provider: 'demo', model: 'sonnet', contextSources: [], requestedCapabilities: { project: 'none', messaging: false } });
const team: TeamDefinition = { schema: 'team/v1', id: 'team', name: 'Team', enabled: true, projectId: 'project', members: ['a', 'b', 'c'], pinnedContext: [], recentMessages: 10, allowedRecipients: [] };
const council = defaultCouncilDefinition('design', 'Design council', team, ['a', 'b', 'c']);
const subject = { kind: 'note' as const, sourceId: 'note', revision: 'r1', markdown: 'Proposal' };
const catalogue = { projectId: 'project', team, agents: ['a', 'b', 'c'].map(agent), councils: [council] };
const definition = (): WorkflowV2Definition => ({ format: 'coforge-workflow/v2', revision: 'v2-1', name: 'Council proposal', subjectMode: 'note', teamId: 'team',
  limits: { timeoutSeconds: 180, maxTurns: 12, maxBudgetUsd: 1, maxInvocations: 20 }, collections: [{ id: 'discussion', producers: ['council'] }],
  steps: [{ id: 'council', name: 'Design', instructions: 'Discuss proposal', kind: 'council', councilId: 'design', inputs: [] },
    { id: 'review', name: 'Choose proposal', instructions: 'Read the proposals', kind: 'approval' },
    { id: 'summary', name: 'Summary', instructions: 'Preserve disagreement', kind: 'agent', agentId: 'a', output: 'markdown', access: 'none', inputs: [{ kind: 'collection', collectionId: 'discussion' }] }] });
function artifact(invocationId: string, roundId: string, index: number): ExecutionArtifact {
  return { id: `artifact-${index}`, runId: 'run', invocationId, attemptId: `attempt-${index}`, roundId, agentId: 'a', agentRevision: 'r1', provider: 'demo', model: 'sonnet', inputArtifactIds: [], createdAt: '2026-10-28T12:00:00.000Z', markdown: `Result ${index}`, simulated: true };
}
describe('explicit v2 workflows', () => {
  it('compiles councils into the shared invocation lane and places checkpoints at action boundaries', () => {
    const plan = compileWorkflowV2(definition(), subject, catalogue);
    expect(plan.invocations).toHaveLength(7); expect(plan.invocations.slice(0, 3).map(item => item.inputRoundIds)).toEqual([[], [], []]);
    expect(plan.checkpoints).toEqual([{ id: 'review', name: 'Choose proposal', instructions: 'Read the proposals', beforeCursor: 6, kind: 'approval', items: [], order: 1 }]);
    expect(plan.invocations.at(-1)?.agentId).toBe('a');
  });
  it('retains all six contributions in an explicitly ordered collection and seals dependent inputs', () => {
    const plan = compileWorkflowV2(definition(), subject, catalogue);
    const results = plan.invocations.slice(0, 6).map((item, index) => artifact(item.id, item.roundId, index));
    expect(resolveWorkflowV2Inputs(plan, plan.invocations[6]!.id, results).map(item => item.markdown)).toEqual(['Result 0', 'Result 1', 'Result 2', 'Result 3', 'Result 4', 'Result 5']);
    expect(() => resolveWorkflowV2Inputs(plan, plan.invocations[6]!.id, results.slice(0, 5))).toThrow('incomplete');
    expect(resolveWorkflowV2Inputs(plan, plan.invocations[1]!.id, results)).toEqual([]);
    expect(resolveWorkflowV2Inputs(plan, plan.invocations[3]!.id, results).map(item => item.markdown)).toEqual(['Result 0', 'Result 1', 'Result 2']);
  });
  it('rejects forward producers, unknown schema fields and relabeling council prose as code', () => {
    const forward = definition(); forward.collections = []; forward.steps[0] = { id: 'early', name: 'Early', instructions: 'Read', kind: 'agent', agentId: 'a', output: 'markdown', access: 'none', inputs: [{ kind: 'producer', stepId: 'summary' }] };
    expect(() => workflowV2DefinitionCheck(forward)).toThrow('earlier');
    expect(() => workflowV2DefinitionCheck({ ...definition(), permission: 'accept-code' })).toThrow();
    expect(() => workflowV2DefinitionCheck({ ...definition(), steps: [{ ...definition().steps[2], output: 'codechange' }] })).toThrow();
  });
  it('keeps generic notes distinct from Ideas and pins resolved agent definitions', () => {
    expect(() => compileWorkflowV2({ ...definition(), subjectMode: 'idea' }, subject, catalogue)).toThrow('subject');
    const input = definition(); const plan = compileWorkflowV2(input, subject, catalogue); catalogue.agents[0]!.instructions = 'Changed';
    expect(plan.invocations[0]?.instructions).toContain('Role a'); expect(plan.invocations[0]?.instructions).not.toContain('Changed');
    catalogue.agents[0]!.instructions = 'Role a';
  });
});
