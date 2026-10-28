import { describe, expect, it } from 'vitest';
import { ExecutionKernel } from '../../../features/coforge/application/execution-kernel';
import { compileWorkflowV2 } from '../../../features/coforge/application/workflow-v2-compiler';
import { workflowV2Admission, workflowV2Dispatch, workflowV2MessageDraft } from '../../../features/coforge/application/workflow-v2-execution';
import { validatedWorkflowPlan, workflowPlanMapping } from '../../../features/coforge/application/workflow-plan-mapping';
import { emptyExecutionJournal } from '../../../features/coforge/domain/execution-run';
import { commitExecutionMessages, emptyExecutionMessagingState } from '../../../features/coforge/domain/execution-outbox';
import type { AgentDefinition, TeamDefinition } from '../../../features/coforge/domain/council-definitions';

const now = '2026-10-28T12:00:00.000Z';
const agent: AgentDefinition = { schema: 'agent/v1', id: 'reviewer', name: 'Reviewer', enabled: true, role: 'Review', instructions: 'Analyze', provider: 'demo', model: 'sonnet', contextSources: [], requestedCapabilities: { project: 'none', messaging: false } };
const team: TeamDefinition = { schema: 'team/v1', id: 'team', name: 'Team', enabled: true, projectId: 'CFP-001', members: [agent.id], pinnedContext: [], recentMessages: 10, allowedRecipients: ['team'] };
describe('workflow messages and validated plan mapping', () => {
  it('keeps checkpoint/message order, atomically records one delivery without a provider call, and maps only structured plans', async () => {
    const source = { kind: 'note' as const, sourceId: 'source', revision: 'r1', markdown: 'Source text {{inputs}}' };
    const plan = compileWorkflowV2({ format: 'coforge-workflow/v2', revision: 'v2-1', name: 'Review and notify', subjectMode: 'note', teamId: team.id,
      limits: { timeoutSeconds: 180, maxTurns: 12, maxBudgetUsd: 1, maxInvocations: 10 }, collections: [],
      steps: [{ kind: 'agent', id: 'review', name: 'Review', instructions: 'Assess', agentId: agent.id, output: 'markdown', access: 'none', inputs: [] },
        { kind: 'approval', id: 'human', name: 'Human review', instructions: 'Review output' },
        { kind: 'message', id: 'notify', name: 'Notify team', instructions: 'Publish reviewed context', purpose: 'information', recipientId: team.id, body: 'Note: {{source}}\n\n{{inputs}}\n\nDecision: {{decisions}}', inputs: [{ kind: 'producer', stepId: 'review' }] },
        { kind: 'agent', id: 'plan', name: 'Plan', instructions: 'Return structured plan', agentId: agent.id, output: 'plan', access: 'none', inputs: [{ kind: 'producer', stepId: 'review' }] }] }, source, { projectId: team.projectId, team, agents: [agent], councils: [] });
    let journal = emptyExecutionJournal(); let calls = 0; let ids = 0;
    const kernel = new ExecutionKernel({ journal: { load: async () => journal, save: async next => { journal = structuredClone(next); } }, now: () => now, id: () => `attempt-${++ids}`,
      assertEligible: async () => undefined, assertLocalEligible: async () => undefined, resolveInvocation: workflowV2Dispatch, publish: async () => undefined,
      invoke: async (_run, invocation) => { calls++; if (invocation.output === 'plan') { const result = validatedWorkflowPlan({ summary: 'Validated proposal', steps: ['Implement safely'], acceptanceCriteria: ['Human reviews actual diff'], risks: ['Needs repository inspection'] }, now); return { markdown: result.markdown, plan: result, simulated: true }; } return { markdown: 'First result', simulated: true }; },
      commitLocalAction: (next, run, action) => {
        const draft = workflowV2MessageDraft(run, action);
        next.messaging = commitExecutionMessages(next.messaging ?? emptyExecutionMessagingState(), { rootId: run.id, runId: run.id, attemptId: `local-${action.id}`, senderId: 'workflow', projectId: run.projectId, teamId: run.teamId, threadId: run.id,
          now, deadline: '2026-10-28T13:00:00.000Z', depth: 0, activeAncestors: [], allowedRecipients: ['team'], stopped: false,
          limits: { depth: 3, descendants: 10, messages: 10, invocations: 10 }, usage: { descendants: 0, messages: 0, invocations: 2 }, recipients: [{ id: 'team', kind: 'team', projectId: run.projectId, teamId: run.teamId, enabled: true, expectedInvocations: 0 }] }, [draft]);
        return next.messaging.outbox.map(entry => entry.message.id);
      },
    });
    await kernel.load(); await kernel.admit(workflowV2Admission({ plan, source: { ...source, generation: 0 }, context: '', invocations: 2, warnings: [] }, 'run', 'key', true)); kernel.resume();
    await kernel.step('run'); await kernel.step('run'); expect(journal.runs[0]?.state).toBe('waiting-human'); expect(journal.messaging).toBeUndefined();
    await kernel.acknowledgeCheckpoint('run', 'human', [], 'Choose the accessible lantern proposal.'); await kernel.step('run'); expect(calls).toBe(1); expect(journal.messaging?.outbox).toHaveLength(1);
    expect(journal.messaging?.outbox[0]?.message).toMatchObject({ purpose: 'information', recipientId: 'team', startsRun: false });
    expect(journal.messaging?.outbox[0]?.message.body).toContain('Source text {{inputs}}'); expect(journal.messaging?.outbox[0]?.message.body).toContain('First result');
    expect(journal.messaging?.outbox[0]?.message.body).toContain('Choose the accessible lantern proposal.');
    expect(journal.messaging?.outbox[0]?.message.body).toContain('checkpoint-only');
    await kernel.step('run'); expect(calls).toBe(2); expect(journal.runs[0]?.state).toBe('completed'); expect(journal.messaging?.outbox).toHaveLength(1);
    const run = journal.runs[0]!; const typed = run.artifacts.find(item => item.plan)!;
    expect(workflowPlanMapping(run, typed.id)).toMatchObject({ subject: { kind: 'note' }, plan: { summary: 'Validated proposal' }, sourceArtifactIds: [run.artifacts[0]?.id] });
    expect(() => workflowPlanMapping(run, run.artifacts[0]!.id)).toThrow('validated plan');
    expect(() => validatedWorkflowPlan({ markdown: 'Pretend this is a plan' }, now)).toThrow();
  });
});
