import { expect, it, vi } from 'vitest';
import { consent, retryFixture } from './background-build-retry-fixture';
import { ai } from './configured-workflow-fixture';

it('requires independent changes/executor/Stop-release acknowledgments and retains the hold on a failed canonical write', async () => {
  const f = await retryFixture();
  try {
    await f.engine.stopWorkflow(f.ideaId); const before = f.current(); const jobs = f.store.snapshot().jobs;
    const preview = await f.engine.previewBackgroundBuildRetry(f.ideaId);
    expect(preview.stopHold).toBe(true);
    for (const missing of ['changesReviewed', 'oldExecutorStopped', 'releaseStopHold'] as const) await expect(f.engine.confirmBackgroundBuildRetry(f.ideaId, preview.id, { ...consent, [missing]: false })).rejects.toThrow('Review');
    expect(f.resources.verify).not.toHaveBeenCalled();
    f.storage.failNextSave = true;
    await expect(f.engine.confirmBackgroundBuildRetry(f.ideaId, preview.id, consent)).rejects.toThrow('Disk full');
    expect(f.current()).toEqual(before); expect(f.store.snapshot().jobs).toEqual(jobs); expect(f.store.snapshot().workflowStopHolds).toContain(f.ideaId);
    expect(f.worker.prepare).not.toHaveBeenCalled(); expect(f.worker.providerLaunches).toHaveLength(0);
    await f.engine.confirmBackgroundBuildRetry(f.ideaId, preview.id, consent); await f.engine.waitUntilIdle();
    expect(f.store.snapshot().workflowStopHolds).not.toContain(f.ideaId); expect(f.worker.providerLaunches).toHaveLength(1);
  } finally { await f.engine.stop(); }
});

it('does not admit a retry when Stop commits during unpaid native snapshot verification', async () => {
  const f = await retryFixture();
  try {
    const preview = await f.engine.previewBackgroundBuildRetry(f.ideaId);
    let release!: () => void;
    vi.mocked(f.resources.verify).mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve; }));
    const pending = f.engine.confirmBackgroundBuildRetry(f.ideaId, preview.id, consent); const rejected = expect(pending).rejects.toThrow('changed');
    await vi.waitFor(() => expect(f.resources.verify).toHaveBeenCalledTimes(1));
    await f.engine.stopWorkflow(f.ideaId); const held = f.current(); release(); await rejected;
    expect(f.current()).toEqual(held); expect(f.store.snapshot().workflowStopHolds).toContain(f.ideaId); expect(f.worker.prepare).not.toHaveBeenCalled();
  } finally { await f.engine.stop(); }
});

it('uses only the saved matching background execution policy while preserving captured provider, prompt and original limits', async () => {
  const f = await retryFixture();
  try {
    const captured = f.current().workflowRun!.definition.steps[1]!;
    await f.store.transaction(state => {
      const saved = state.settings.workflow!; saved.revision = 'saved-policy'; saved.limits.maxTurns = 30; saved.limits.maxBudgetUsd = 9;
      const build = saved.steps[1]!; if (build.kind !== 'ai') throw new Error('Expected AI');
      build.execution = { mode: 'background', maxTurns: 123, maxBudgetUsd: 4 }; build.instructions = 'New prompt must not replace capture'; build.provider = 'codex'; build.model = 'gpt-5.5';
    });
    const preview = await f.engine.previewBackgroundBuildRetry(f.ideaId);
    expect(preview.step).toEqual(captured); expect(preview.policySource).toEqual({ kind: 'saved', definitionRevision: 'saved-policy' });
    expect(preview.inheritedLimits).toEqual({ maxTurns: 7, maxBudgetUsd: 1.5 }); expect(preview.effectiveLimits).toEqual({ maxTurns: 123, maxBudgetUsd: 4 });
    await f.engine.confirmBackgroundBuildRetry(f.ideaId, preview.id, consent); await f.engine.waitUntilIdle();
    expect(f.worker.requests[0]?.input.workflow.step).toEqual({ ...captured, execution: preview.policy });
    expect(f.worker.requests[0]?.input.settings).toMatchObject({ provider: 'claude', maxTurns: 7, maxBudgetUsd: 1.5 });
  } finally { await f.engine.stop(); }
});

it('invalidates a preview when the saved future policy changes, without dispatching or modifying old evidence', async () => {
  const f = await retryFixture();
  try {
    const before = f.current(); const preview = await f.engine.previewBackgroundBuildRetry(f.ideaId);
    await f.store.transaction(state => { state.settings.workflow!.revision = 'later-policy'; });
    await expect(f.engine.confirmBackgroundBuildRetry(f.ideaId, preview.id, consent)).rejects.toThrow('stale');
    expect(f.current()).toEqual(before); expect(f.resources.verify).not.toHaveBeenCalled(); expect(f.worker.prepare).not.toHaveBeenCalled();
  } finally { await f.engine.stop(); }
});

it('refuses a clean-base substitution when old real changes lose their attributed workspace', async () => {
  const f = await retryFixture();
  try {
    await f.store.transaction(state => { delete state.ideas.find(idea => idea.id === f.ideaId)!.workflowRun!.workspaceId; });
    await expect(f.engine.previewBackgroundBuildRetry(f.ideaId)).rejects.toThrow('attributed original workspace');
    expect(f.resources.inspect).not.toHaveBeenCalled(); expect(f.worker.prepare).not.toHaveBeenCalled();
  } finally { await f.engine.stop(); }
});

it('blocks a later foreground editing step and a worker without reviewed-import capability before any paid admission', async () => {
  const f = await retryFixture();
  try {
    f.worker.readiness.mockResolvedValueOnce({ ready: true, message: 'Older healthy worker' });
    await expect(f.engine.previewBackgroundBuildRetry(f.ideaId)).rejects.toThrow('does not support reviewed snapshots');
    await f.store.transaction(state => { state.ideas.find(idea => idea.id === f.ideaId)!.workflowRun!.definition.steps.push({ ...ai('later-edit', 'codechange', 'editworktree'), provider: 'claude' }); });
    await expect(f.engine.previewBackgroundBuildRetry(f.ideaId)).rejects.toThrow('later foreground editing step');
    expect(f.resources.inspect).not.toHaveBeenCalled(); expect(f.worker.prepare).not.toHaveBeenCalled();
  } finally { await f.engine.stop(); }
});
