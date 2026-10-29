import { expect, it } from 'vitest';
import { executionCostTasks } from '../../../features/coforge/application/execution-costs';
import { AICostService } from '../../../features/coforge/application/ai-cost-service';
import { aiCostTaskCheck, costSummary, type AICostTask } from '../../../features/coforge/domain/ai-costs';
import type { MessageOutboxEntry } from '../../../features/coforge/domain/team-messages';
import { attributedRun, fanOutCostRun, costAgent, costTeam, costCouncil } from './cost-attribution-fixture';
import { costAttributionGroups } from '../../../features/coforge/domain/ai-cost-groups';
import { emptyStore, nodeTimers } from './memory-storage';

it('attributes direct, council and nested workflow attempts from their pinned definitions without exposing prompts', () => {
  const direct = attributedRun('direct', 'agent');
  const council = attributedRun('council');
  const workflow = attributedRun('workflow', 'workflow');
  const tasks = executionCostTasks([direct, council, workflow], []);
  expect(tasks[0]).toMatchObject({ attribution: { kind: 'agent', agentId: costAgent.id, agentName: costAgent.name, teamId: costTeam.id, teamName: costTeam.name } });
  expect(tasks[0]?.attribution?.councilId).toBeUndefined();
  expect(tasks[1]).toMatchObject({ featureTitle: 'Lighting options', attribution: { kind: 'council', councilId: costCouncil.id, councilName: costCouncil.name, agentId: costAgent.id } });
  expect(tasks[2]).toMatchObject({ attribution: { kind: 'workflow', workflowName: 'Pinned proposal workflow', workflowRevision: 'proposal-v2', councilId: costCouncil.id, agentId: costAgent.id, teamId: costTeam.id } });
  expect(JSON.stringify(tasks)).not.toMatch(/Private|instructions|dispatch/);
});

it('combines partial provider counters once and accepts canonical analytical source IDs at their existing boundary', () => {
  const run = attributedRun('partial');
  run.subject.sourceId = `task-${'x'.repeat(100)}`;
  const attempt = run.attempts[0]!; const invocation = run.invocations[0]!;
  attempt.usage = { inputTokens: 10, cacheReadInputTokens: 3 };
  run.artifacts.push({ id: 'artifact', runId: run.id, invocationId: invocation.id, attemptId: attempt.id, roundId: invocation.roundId, agentId: invocation.agentId, agentRevision: invocation.agentRevision, provider: invocation.provider, model: invocation.model, inputArtifactIds: [], createdAt: '2026-10-28T10:00:01Z', markdown: 'Private artifact', simulated: false, costUsd: 0.15, usage: { outputTokens: 4 } });
  const tasks = executionCostTasks([run], []);
  expect(tasks).toHaveLength(1);
  expect(tasks[0]).toMatchObject({ featureId: run.subject.sourceId, reportedUsd: 0.15, usage: { inputTokens: 10, outputTokens: 4, cacheReadInputTokens: 3 } });
  expect(costSummary(tasks).nanos).toBe(150000000n);
  expect(() => aiCostTaskCheck(tasks[0])).not.toThrow();
  expect(() => aiCostTaskCheck({ ...tasks[0], featureId: 'x'.repeat(201) })).toThrow();
  expect(() => aiCostTaskCheck({ ...tasks[0], attribution: { ...tasks[0]?.attribution, extraAuthority: true } })).toThrow();
});

it('labels forced host simulation honestly while retaining paid ordinary runs and captured actor identity', () => {
  const simulation = attributedRun('forced-simulation');
  simulation.limits = { ...simulation.limits!, simulation: true };
  simulation.attempts[0]!.costUsd = undefined; simulation.attempts[0]!.usage = undefined;
  const invocation = simulation.invocations[0]!;
  expect(invocation.provider).toBe('claude');
  simulation.artifacts.push({ id: 'simulated-artifact', runId: simulation.id, invocationId: invocation.id, attemptId: simulation.attempts[0]!.id, roundId: invocation.roundId, agentId: invocation.agentId, agentRevision: invocation.agentRevision, provider: invocation.provider, model: invocation.model, inputArtifactIds: [], createdAt: '2026-10-28T10:00:01Z', markdown: 'Illustrative output.', simulated: true });
  const task = executionCostTasks([simulation], [])[0]!;
  expect(task).toMatchObject({ provider: 'demo', model: 'sonnet', attribution: { agentName: costAgent.name, teamName: costTeam.name, councilName: costCouncil.name } });
  expect(task.reportedUsd).toBeUndefined(); expect(task.usage).toBeUndefined();
  expect(costSummary([task])).toMatchObject({ simulations: 1, reported: 0, missing: 0, nanos: 0n });
  const ordinary = executionCostTasks([attributedRun('paid')], [])[0]!;
  expect(ordinary).toMatchObject({ provider: 'claude', reportedUsd: 0.1 });
  expect(costSummary([ordinary])).toMatchObject({ reported: 1, simulations: 0, nanos: 100000000n });
});

it('attributes interleaved fan-out peer outcomes once and regroups the same exact USD without parent charges', () => {
  const run = fanOutCostRun();
  expect(run.invocations.slice(0, 2).every(invocation => invocation.promptOrder === 'fan-out')).toBe(true);
  const tasks = executionCostTasks([run], []);
  expect(tasks).toHaveLength(2);
  expect(costSummary(tasks).nanos).toBe(300000000n);
  const agents = costAttributionGroups(tasks, 'agent');
  expect(agents.map(group => [group.name, group.summary.nanos])).toEqual([['Pinned peer', 200000000n], ['Pinned reviewer', 100000000n]]);
  expect(costAttributionGroups(tasks, 'team')[0]?.summary.nanos).toBe(300000000n);
  expect(costAttributionGroups(tasks, 'council')[0]?.summary.nanos).toBe(300000000n);
  expect(tasks.every(task => task.attribution?.rootRunId === run.id)).toBe(true);
});

it('retains failed/retry and delegated attempts once, with real lineage and unchanged provider telemetry', () => {
  const run = attributedRun('child', 'agent'); run.subject.sourceId = 'delegated-message';
  run.attempts.push({ ...run.attempts[0]!, id: 'child-retry', status: 'responded', costUsd: 0.2 });
  const messages: MessageOutboxEntry[] = [{ status: 'delivered', attempts: 1, message: { id: 'delegated-message', purpose: 'request', recipientId: costAgent.id, body: 'Private delegated message.', rootId: 'root-run', runId: 'parent-run', attemptId: 'parent-attempt', senderId: 'other-agent', projectId: costTeam.projectId, teamId: costTeam.id, threadId: 'root-run', createdAt: '2026-10-28T09:59:00Z', depth: 1, startsRun: true, reservedInvocations: 1 } }];
  const tasks = executionCostTasks([run], [], messages);
  expect(tasks).toHaveLength(2);
  expect(new Set(tasks.map(task => task.id)).size).toBe(2);
  expect(tasks[0]).toMatchObject({ status: 'unknown', usageSource: 'provider', usage: { inputTokens: 10, outputTokens: 2 }, attribution: { rootRunId: 'root-run', parentRunId: 'parent-run', messageId: 'delegated-message' } });
  expect(costSummary(tasks).nanos).toBe(300000000n);
});

it('archives attribution and exact cost through source pruning, reload and manual fallback edits', async () => {
  const { store } = await emptyStore();
  let incoming = executionCostTasks([attributedRun('retained')], []);
  incoming[0] = { ...incoming[0]!, reportedUsd: undefined };
  let saved: AICostTask[] = [];
  const storage = { load: async () => structuredClone(saved), save: async (tasks: AICostTask[]) => { saved = structuredClone(tasks); } };
  const service = new AICostService(store, storage, () => incoming, nodeTimers());
  await service.start();
  const original = service.snapshot().tasks[0]!;
  await service.setManual(original.id, '0.125', 'Verified provider receipt', JSON.stringify(original));
  incoming = []; await service.refresh(); await service.dispose();
  const reopened = new AICostService(store, storage, () => [], nodeTimers());
  try {
    await reopened.start();
    expect(reopened.snapshot().tasks[0]).toMatchObject({ manualUsd: '0.125', attribution: { agentName: costAgent.name, teamName: costTeam.name, councilName: costCouncil.name } });
  } finally { await reopened.dispose(); store.disposeObservers(); }
});
