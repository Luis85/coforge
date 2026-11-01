import { vi } from 'vitest';
import { WorkflowEngine } from '../../../features/coforge/application/engine';
import type { PolishingCodePort } from '../../../features/coforge/application/polishing-ports';
import { retryFixture, consent } from './background-build-retry-fixture';
import { increment } from './configured-workflow-fixture';
import { nodeTimers } from './memory-storage';

export async function polishingCodeFixture(backgroundFirst = false) {
  const f = await retryFixture(); await f.engine.stop();
  await f.store.transaction(state => { state.settings.workflow!.improvementPass = { provider: 'claude', model: 'sonnet', instructions: 'Polish the current code.', limits: { timeoutSeconds: 60, maxTurns: 4, maxBudgetUsd: 0.8 } }; });
  const code: PolishingCodePort = { materialize: vi.fn(async request => ({ id: request.id, workspaceId: 'wf-polished', ownerRunId: request.target.runId, mode: request.target.mode,
    workspaceEpoch: request.target.workspaceEpoch, increment: { ...increment, simulated: false, branch: 'polished-primary', worktree: '/synthetic/polished-primary' }, evidenceHash: 'f'.repeat(64) })) };
  const engine = new WorkflowEngine(f.store, { runners: { demo: f.runner, claude: f.runner }, timers: nodeTimers(), durableBuilds: f.worker, backgroundBuildRetries: f.resources, polishingCode: code });
  if (backgroundFirst) {
    const retry = await engine.previewBackgroundBuildRetry(f.ideaId); await engine.confirmBackgroundBuildRetry(f.ideaId, retry.id, consent); await engine.waitUntilIdle();
    const job = f.store.snapshot().jobs.at(-1)!; const snapshot = f.worker.snapshots.get(job.id)!;
    snapshot.phase = 'failed'; snapshot.sequence++; snapshot.workspaceId = 'bg-prior'; snapshot.workspaceCaptured = true; snapshot.increment = { ...increment, simulated: false };
    await engine.reconcileDurableBuild(f.ideaId, job.workflow!.runId);
  }
  const preview = await engine.previewPolishingPass(f.ideaId, 'Improve the partial code and preserve completed design.');
  await engine.confirmPolishingPass(f.ideaId, preview.id, consent); await engine.waitUntilIdle();
  const job = f.store.snapshot().jobs.at(-1)!;
  return { ...f, engine, code, preview, job };
}
