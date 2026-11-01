import { expect, it, vi } from 'vitest';
import { retryFixture, consent } from './background-build-retry-fixture';
import { increment } from './configured-workflow-fixture';
import { WorkflowEngine } from '../../../features/coforge/application/engine';
import { defaultImprovementPass } from '../../../features/coforge/domain/polishing-pass-configuration';
import type { StageInput } from '../../../features/coforge/application/ports';
import { nodeTimers } from './memory-storage';

it('previews and dispatches attached code polishing without a Node worker or execution-limit setup', async () => {
  const f = await retryFixture(); await f.engine.stop();
  await f.store.transaction(state => {
    state.settings.workflow!.improvementPass = { ...defaultImprovementPass(state.settings), provider: 'claude', model: 'sonnet' };
    state.runtime.durableBuild = { ready: false, message: 'No standalone Node worker installed' };
    const source = state.jobs.find(job => job.workflow?.workspaceId === 'fg-original')!;
    const owner = { runId: source.workflow!.runId, attemptId: source.workflow!.attemptId, projectId: source.projectId! };
    source.nativeProcess = { ...owner, phase: 'terminated', observedAt: new Date().toISOString(), identity: { pid: 123, platform: 'win32', birth: 'original', image: 'a'.repeat(64) },
      lifetime: { ...owner, version: 1, kind: 'windows-job', directory: '/owned', ownerToken: 'b'.repeat(64), sourceHash: 'c'.repeat(64) } };
  });
  const runner = vi.fn(async (input: StageInput) => {
    expect(input.workflow?.lifecycle?.mode).toBe('managed-session'); expect(input.workflow?.step.execution).toBeUndefined();
    await input.onWorkspace?.('fg-attached-polish'); const changed = { ...increment, simulated: false };
    await input.onChanges?.(changed); return { summary: changed.summary, increment: changed };
  });
  const engine = new WorkflowEngine(f.store, { polishingSources: f.resources, runners: { demo: runner, claude: runner }, timers: nodeTimers() });
  try {
    const preview = await engine.previewPolishingPass(f.ideaId, 'Improve this code without a worker service.');
    expect(preview.step.execution).toBeUndefined(); expect(preview.readiness).toBeUndefined(); expect(preview.oldExecutorAcknowledgementRequired).toBe(false);
    await engine.confirmPolishingPass(f.ideaId, preview.id, { ...consent, oldExecutorStopped: false }); await engine.waitUntilIdle();
    expect(runner).toHaveBeenCalledOnce(); expect(f.worker.prepare).not.toHaveBeenCalled(); expect(f.worker.readiness).not.toHaveBeenCalled();
    const job = f.store.snapshot().jobs.at(-1)!; expect(job.status).toBe('succeeded'); expect(job.durable).toBeUndefined();
    expect(f.current().polishingRuns?.at(-1)?.review).toBe('pending');
  } finally { await engine.stop(); }
});
