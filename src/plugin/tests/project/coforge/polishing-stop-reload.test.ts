import { expect, it, vi } from 'vitest';
import { StudioStore } from '../../../features/coforge/application/studio-store';
import { WorkflowEngine } from '../../../features/coforge/application/engine';
import { projectHasPendingWorkflow } from '../../../features/coforge/application/workflow-configuration';
import { polishingCodeFixture } from './polishing-code-fixture';
import { retryFixture, consent } from './background-build-retry-fixture';
import { nodeTimers } from './memory-storage';

it('stops only the active auxiliary attempt, preserving the main checkpoint and a durable per-card Stop hold', async () => {
  const f = await retryFixture(false);
  try {
    await f.store.transaction(state => { state.settings.workflow!.improvementPass = { provider: 'demo', model: 'sonnet', instructions: 'Polish.', limits: { timeoutSeconds: 60, maxTurns: 3, maxBudgetUsd: 0.5 } }; });
    const main = f.current().workflowRun;
    f.runner.mockImplementationOnce(input => new Promise((_resolve, reject) => input.signal!.addEventListener('abort', () => reject(new Error('Stopped')), { once: true })));
    const preview = await f.engine.previewPolishingPass(f.ideaId, 'Clarify the design.');
    await f.engine.confirmPolishingPass(f.ideaId, preview.id, consent); await vi.waitFor(() => expect(f.runner).toHaveBeenCalledTimes(2));
    await f.engine.stopWorkflow(f.ideaId); await f.engine.waitUntilIdle();
    const pass = f.current().polishingRuns![0]!;
    expect(f.current().workflowRun).toEqual(main); expect(f.current().status).toBe('inbox'); expect(f.store.snapshot().workflowStopHolds).toContain(f.ideaId);
    expect(pass.workflow.state).toBe('stopped'); expect(pass.workflow.attempts[0]?.status).toBe('cancelled');
    await f.engine.rejectPolishingResult(f.ideaId, pass.id, pass.workflow.revision);
    await expect(f.engine.runWorkflowStep(f.ideaId)).rejects.toThrow('stopped'); expect(f.current().workflowRun).toEqual(main);
  } finally { await f.engine.stop(); }
});

it('scopes original worker inspection/recovery to the auxiliary run without cancelling or rewriting the primary', async () => {
  const f = await polishingCodeFixture();
  try {
    const main = f.current().workflowRun; const snapshot = f.worker.snapshots.get(f.job.id)!;
    snapshot.phase = 'attention'; snapshot.sequence++; await f.engine.reconcileDurableBuild(f.ideaId, f.job.workflow!.runId);
    const pass = f.current().polishingRuns![0]!;
    await expect(f.engine.inspectDurableBuildEvidence(f.ideaId, main!.revision)).rejects.toThrow('no unresolved');
    await f.engine.inspectDurableBuildEvidence(f.ideaId, pass.workflow.revision, pass.id);
    await f.engine.recoverDurableBuild(f.ideaId, pass.workflow.revision, true, pass.id);
    expect(f.current().workflowRun).toEqual(main); expect(f.current().polishingRuns![0]?.workflow.state).toBe('stopped');
    expect(f.store.snapshot().workflowStopHolds).toContain(f.ideaId); expect(f.worker.providerLaunches).toHaveLength(1);
    expect(f.store.snapshot().jobs.find(job => job.id === f.job.id)?.status).toBe('cancelled');
  } finally { await f.engine.stop(); }
});

it('reattaches a running auxiliary Build after reload without another provider launch or primary recovery mutation', async () => {
  const f = await polishingCodeFixture(); const main = f.current().workflowRun;
  await f.engine.stop();
  const store = new StudioStore(f.storage); await store.init();
  const engine = new WorkflowEngine(store, { runners: { demo: f.runner, claude: f.runner }, timers: nodeTimers(), durableBuilds: f.worker, backgroundBuildRetries: f.resources, polishingCode: f.code });
  try {
    const current = () => store.snapshot().ideas.find(idea => idea.id === f.ideaId)!;
    expect(current().workflowRun).toEqual(main); expect(current().polishingRuns![0]?.workflow.state).toBe('running');
    await engine.reconcileDurableBuild(f.ideaId, f.job.workflow!.runId);
    expect(f.worker.providerLaunches).toHaveLength(1); expect(current().workflowRun).toEqual(main);
    expect(projectHasPendingWorkflow(store.snapshot(), f.job.projectId!)).toBe(true);
  } finally { await engine.stop(); }
});
