import { expect, it, vi } from 'vitest';
import { WorkflowEngine } from '../../../features/coforge/application/engine';
import { StudioStore } from '../../../features/coforge/application/studio-store';
import { AICostService } from '../../../features/coforge/application/ai-cost-service';
import type { AICostStorage } from '../../../features/coforge/application/ai-cost-ports';
import { collectCostTasks } from '../../../features/coforge/domain/ai-cost-snapshot';
import { costSummary, taskCost, type AICostTask } from '../../../features/coforge/domain/ai-costs';
import { consent } from './background-build-retry-fixture';
import { standalonePolishingFixture } from './polishing-standalone-fixture';
import { nodeTimers } from './memory-storage';

function costLedger() {
  let saved: AICostTask[] = [];
  const storage: AICostStorage = {
    load: async () => structuredClone(saved),
    save: async tasks => { saved = structuredClone(tasks); },
  };
  return storage;
}
function costsFor(store: StudioStore, storage: AICostStorage) {
  return new AICostService(store, storage, () => collectCostTasks(store.snapshot(), []), nodeTimers());
}

it('admits a repeated text polishing confirmation once through the shared runner and automatically records its actual cost', async () => {
  const f = await standalonePolishingFixture();
  await f.store.transaction(state => { state.settings.workflow!.improvementPass!.provider = 'claude'; });
  const costs = costsFor(f.store, costLedger()); await costs.start();
  const original = f.current(); const beforeJobs = f.store.snapshot().jobs.length;
  const beforeCosts = costSummary(costs.snapshot().tasks);
  f.runner.mockImplementationOnce(async input => {
    await input.onUsage?.(0.1); await input.onUsage?.(0.1);
    await input.onTokenUsage?.({ inputTokens: 25 });
    return { markdown: 'A clearer request.', costUsd: 0.25, usage: { outputTokens: 10 } };
  });
  try {
    const preview = await f.engine.previewPolishingPass(f.ideaId, 'Clarify this request without restarting it.');
    await costs.refresh();
    expect(f.store.snapshot().jobs).toHaveLength(beforeJobs); expect(f.current().polishingRuns).toBeUndefined();
    expect(f.runner).not.toHaveBeenCalled(); expect(costSummary(costs.snapshot().tasks)).toEqual(beforeCosts);
    const confirmations = await Promise.allSettled([
      f.engine.confirmPolishingPass(f.ideaId, preview.id, consent),
      f.engine.confirmPolishingPass(f.ideaId, preview.id, consent),
    ]);
    expect(confirmations.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    await f.engine.waitUntilIdle();
    const pass = f.current().polishingRuns![0]!;
    const job = f.store.snapshot().jobs.find(item => item.workflow?.polishingId === pass.id)!;
    expect(f.current().polishingRuns).toHaveLength(1); expect(pass.workflow.attempts).toHaveLength(1);
    expect(f.store.snapshot().jobs).toHaveLength(beforeJobs + 1); expect(f.runner).toHaveBeenCalledTimes(1);
    expect(f.worker.prepare).not.toHaveBeenCalled(); expect(f.copies.materialize).not.toHaveBeenCalled();
    expect(job).toMatchObject({ ideaId: f.ideaId, provider: 'claude', status: 'succeeded', costUsd: 0.25 });
    expect(job.workflow).toMatchObject({ runId: pass.workflow.id, attemptId: pass.workflow.attempts[0]!.id });
    expect(pass.workflow.artifacts).toHaveLength(1);
    expect(f.current().description).toBe(original.description); expect(f.current().workflowRun).toEqual(original.workflowRun);
    await vi.waitFor(() => expect(costs.snapshot().tasks.find(task => task.id === `job:${job.id}`)).toMatchObject({
      reportedUsd: 0.25, projectId: job.projectId, featureId: f.ideaId,
      usage: { inputTokens: 25, outputTokens: 10 }, workflow: { runId: pass.id, stepName: 'Improve & polish' },
    }));
    await costs.refresh(); await costs.refresh();
    expect(costs.snapshot().tasks.filter(task => task.id === `job:${job.id}`)).toHaveLength(1);
    const summary = costSummary(costs.snapshot().tasks);
    expect(summary.nanos - beforeCosts.nanos).toBe(250000000n); expect(summary.reported - beforeCosts.reported).toBe(1);
    expect(costs.snapshot().tasks.find(task => task.id === `job:${job.id}`)!.projectName).not.toBe('');
  } finally { await f.engine.stop(); await costs.dispose(); }
});

it('retains the real provider charge for a failed polishing pass without charging for its absent result', async () => {
  const f = await standalonePolishingFixture();
  await f.store.transaction(state => { state.settings.workflow!.improvementPass!.provider = 'claude'; });
  const costs = costsFor(f.store, costLedger()); await costs.start();
  f.runner.mockImplementationOnce(async input => {
    await input.onUsage?.(0.12); await input.onTokenUsage?.({ inputTokens: 12, outputTokens: 3 });
    throw new Error('The provider stopped before producing a result.');
  });
  try {
    const preview = await f.engine.previewPolishingPass(f.ideaId, 'Improve the current wording.');
    await f.engine.confirmPolishingPass(f.ideaId, preview.id, consent); await f.engine.waitUntilIdle();
    const pass = f.current().polishingRuns![0]!;
    const job = f.store.snapshot().jobs.find(item => item.workflow?.polishingId === pass.id)!;
    expect(job.status).toBe('failed'); expect(pass.workflow.state).toBe('attention'); expect(pass.workflow.artifacts).toHaveLength(0);
    await vi.waitFor(() => expect(costs.snapshot().tasks.find(task => task.id === `job:${job.id}`)).toMatchObject({
      status: 'failed', reportedUsd: 0.12, projectId: job.projectId, usage: { inputTokens: 12, outputTokens: 3 },
    }));
    const rows = costs.snapshot().tasks.filter(task => task.workflow?.runId === pass.id);
    expect(rows).toHaveLength(1); expect(costSummary(rows)).toMatchObject({ nanos: 120000000n, reported: 1, missing: 0 });
    expect(f.runner).toHaveBeenCalledTimes(1); expect(f.worker.prepare).not.toHaveBeenCalled();
  } finally { await f.engine.stop(); await costs.dispose(); }
});

it.each(['claude', 'codex'] as const)('reconciles a %s polishing Build across reload without duplicating execution, results or cost rows', async provider => {
  const f = await standalonePolishingFixture(true);
  await f.store.transaction(state => {
    state.settings.workflow!.improvementPass!.provider = provider;
    state.settings.workflow!.improvementPass!.model = provider === 'codex' ? 'gpt-5.3-codex' : 'sonnet';
    state.runtime.codexAvailable = true;
  });
  const ledger = costLedger(); const costs = costsFor(f.store, ledger); await costs.start();
  let reloadedEngine: WorkflowEngine | undefined; let reloadedCosts: AICostService | undefined;
  const original = f.current(); const initialJobs = f.store.snapshot().jobs.length;
  try {
    const preview = await f.engine.previewPolishingPass(f.ideaId, 'Polish the reviewed code once.');
    const confirmations = await Promise.allSettled([
      f.engine.confirmPolishingPass(f.ideaId, preview.id, consent),
      f.engine.confirmPolishingPass(f.ideaId, preview.id, consent),
    ]);
    expect(confirmations.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    await f.engine.waitUntilIdle();
    const job = f.store.snapshot().jobs.find(item => item.workflow?.polishingId)!;
    expect(f.worker.requests).toHaveLength(1); expect(f.worker.providerLaunches).toEqual([job.id]);
    expect(f.runner).not.toHaveBeenCalled(); expect(f.copies.materialize).not.toHaveBeenCalled();
    expect(f.worker.requests[0]).toMatchObject({ jobId: job.id, ideaId: f.ideaId, projectId: job.projectId, runId: job.workflow!.runId,
      input: { workflow: { step: { provider }, polishingId: job.workflow!.polishingId } } });
    await f.engine.stop(); await costs.dispose();

    const store = new StudioStore(f.storage); await store.init();
    reloadedEngine = new WorkflowEngine(store, { runners: { demo: f.runner, claude: f.runner }, timers: nodeTimers(),
      backgroundBuildRetries: f.resources, durableBuilds: f.worker, polishingCode: f.copies });
    reloadedCosts = costsFor(store, ledger); await reloadedCosts.start();
    await reloadedEngine.reconcileDurableBuild(f.ideaId, job.workflow!.runId);
    expect(f.worker.providerLaunches).toEqual([job.id]);
    f.worker.complete(job.id);
    const snapshot = f.worker.snapshots.get(job.id)!;
    snapshot.usage = { inputTokens: 100, outputTokens: 30 };
    if (provider === 'claude') snapshot.costUsd = 0.75;
    await reloadedEngine.reconcileDurableBuild(f.ideaId, job.workflow!.runId);
    const first = store.snapshot().ideas.find(idea => idea.id === f.ideaId)!;
    const pass = first.polishingRuns![0]!;
    expect(pass.workflow.state).toBe('awaiting-review'); expect(pass.review).toBe('pending');
    expect(pass.workflow.attempts).toHaveLength(1); expect(pass.workflow.artifacts.length).toBeGreaterThan(0);
    await reloadedEngine.reconcileDurableBuild(f.ideaId, job.workflow!.runId);
    await reloadedEngine.reconcileDurableBuild(f.ideaId, job.workflow!.runId);
    await reloadedCosts.refresh(); await reloadedCosts.refresh();
    const after = store.snapshot(); const idea = after.ideas.find(item => item.id === f.ideaId)!;
    expect(idea.polishingRuns).toEqual(first.polishingRuns);
    expect(idea.workflowRun).toEqual(original.workflowRun); expect(idea.increment).toEqual(original.increment);
    expect(after.jobs).toHaveLength(initialJobs + 1); expect(idea.polishingRuns).toHaveLength(1);
    expect(f.worker.requests).toHaveLength(1); expect(f.worker.providerLaunches).toEqual([job.id]);
    const rows = reloadedCosts.snapshot().tasks.filter(task => task.id === `job:${job.id}`);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ provider, featureId: f.ideaId, projectId: job.projectId, status: 'succeeded',
      usage: { inputTokens: 100, outputTokens: 30 }, workflow: { runId: pass.id, attemptId: pass.workflow.attempts[0]!.id, stepName: 'Improve & polish' } });
    expect(rows[0]!.projectName).not.toBe('');
    expect(taskCost(rows[0]!)).toEqual(provider === 'claude' ? { source: 'reported', nanos: 750000000n } : { source: 'unavailable' });
    if (provider === 'codex') expect(rows[0]!.reportedUsd).toBeUndefined();
    await expect(reloadedEngine.confirmPolishingPass(f.ideaId, preview.id, consent)).rejects.toThrow('stale');
    expect(f.worker.providerLaunches).toEqual([job.id]);
  } finally {
    await f.engine.stop(); await costs.dispose(); await reloadedEngine?.stop(); await reloadedCosts?.dispose();
  }
});
