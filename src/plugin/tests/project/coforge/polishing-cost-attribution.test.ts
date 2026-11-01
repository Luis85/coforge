import { expect, it } from 'vitest';
import { collectCostTasks } from '../../../features/coforge/domain/ai-cost-snapshot';
import { createSeed } from '../../../features/coforge/domain/seed';
import type { WorkflowCoworkerProfile } from '../../../features/coforge/domain/workflow-coworker-binding';
import { completedPolish } from './polishing-amendment-fixture';
import { ai } from './configured-workflow-fixture';

it('attributes the actual polishing attempt and captured CoWorker workflow without exposing private instructions or adding charges', () => {
  const state = createSeed(); const idea = state.ideas.find(item => item.status === 'inbox')!;
  const pass = completedPolish(idea, { markdown: 'A clearer current request.' }); pass.workflow.definition.name = 'Improve & polish';
  const step = { ...ai('polish'), provider: 'claude' as const };
  const coworker: WorkflowCoworkerProfile = { format: 'coforge-workflow-coworker/v1', id: 'editor', name: 'Saved editor', revision: 'profile-one', role: 'Edit', instructions: 'Private saved instructions.', provider: 'claude', model: 'sonnet' };
  const attempt = pass.workflow.attempts[0]!;
  state.jobs = [{ id: 'actual-polish-job', ideaId: idea.id, projectId: idea.projectId, stage: 'plan', provider: 'claude', model: 'sonnet', status: 'succeeded', startedAt: pass.createdAt, logs: [], costUsd: 0.25,
    usage: { inputTokens: 20, outputTokens: 5 }, workflow: { runId: pass.id, definitionRevision: pass.workflow.definition.revision, proposalRevision: pass.workflow.proposalRevision,
      attemptId: attempt.id, step, inputArtifacts: [], coworker, polishingId: pass.id } }];
  const costs = collectCostTasks(state, []);
  expect(costs).toHaveLength(1); expect(costs[0]).toMatchObject({ reportedUsd: 0.25, usage: { inputTokens: 20, outputTokens: 5 },
    attribution: { agentId: coworker.id, agentRevision: coworker.revision, workflowName: 'Improve & polish', runId: pass.id }, workflow: { attemptId: attempt.id } });
  expect(JSON.stringify(costs)).not.toContain('Private saved instructions.');
});
