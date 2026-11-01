import { expect, it, vi } from 'vitest';
import { configuredInputs } from '../../../features/coforge/application/configured-workflow-policy';
import { polishingCodeFixture } from './polishing-code-fixture';

it('keeps the main result unchanged until explicit code Apply, then binds a fresh primary-owned resource without advancing its cursor', async () => {
  const f = await polishingCodeFixture();
  try {
    const before = f.current();
    expect(f.worker.requests[0]?.input.settings).toMatchObject({ maxTurns: 4, maxBudgetUsd: 0.8 });
    expect(f.worker.requests[0]?.input.workflow.polishingId).toBe(before.polishingRuns![0]!.id);
    expect(f.worker.requests[0]?.reviewedSnapshot).toEqual(f.preview.inspection!.snapshot);
    f.worker.complete(f.job.id); await f.engine.reconcileDurableBuild(f.ideaId, f.job.workflow!.runId);
    const ready = f.current(); const pass = ready.polishingRuns![0]!;
    expect(ready.workflowRun).toEqual(before.workflowRun); expect(ready.increment).toEqual(before.increment);
    expect(pass.workflow.state).toBe('awaiting-review');
    await expect(f.engine.action(f.ideaId, 'approve')).rejects.toThrow('polish');
    await f.engine.applyPolishingResult(f.ideaId, pass.id, pass.workflow.revision);
    const applied = f.current(); const main = applied.workflowRun!;
    expect(main.cursor).toBe(before.workflowRun!.cursor); expect(main.state).toBe(before.workflowRun!.state);
    expect(main.definition).toEqual(before.workflowRun!.definition); expect(main.attempts).toEqual(before.workflowRun!.attempts); expect(main.artifacts).toEqual(before.workflowRun!.artifacts);
    expect(main.workspaceId).toBe('wf-polished'); expect(applied.increment?.worktree).toBe('/synthetic/polished-primary');
    expect(applied.polishingRuns![0]?.review).toBe('applied'); expect(f.code.materialize).toHaveBeenCalledTimes(1);
    const inputs = configuredInputs(main, { inputs: ['codechange'] }, applied.workflowHistory, applied);
    expect(inputs).toHaveLength(1); expect(inputs[0]?.runId).toBe(pass.id); expect(inputs[0]?.id).toBe(pass.workflow.artifacts.at(-1)?.id);
    await f.engine.runWorkflowStep(f.ideaId); await f.engine.waitUntilIdle();
    const next = f.runner.mock.calls.at(-1)![0];
    expect(next.workflow?.workspaceId).toBe('wf-polished'); expect(next.workflow?.step.execution).toBeUndefined();
  } finally { await f.engine.stop(); }
});

it('retains a durable unpaid materialization intent when binding persistence fails and retries the identical operation', async () => {
  const f = await polishingCodeFixture();
  try {
    f.worker.complete(f.job.id); await f.engine.reconcileDurableBuild(f.ideaId, f.job.workflow!.runId);
    const pass = f.current().polishingRuns![0]!; const before = f.current().workflowRun;
    const native = vi.mocked(f.code.materialize).getMockImplementation()!;
    vi.mocked(f.code.materialize).mockImplementationOnce(async request => { const binding = await native(request); f.storage.failNextSave = true; return binding; });
    await expect(f.engine.applyPolishingResult(f.ideaId, pass.id, pass.workflow.revision)).rejects.toThrow('Disk full');
    expect(f.current().workflowRun).toEqual(before); const intent = f.current().polishingRuns![0]!.applyIntent!;
    expect(intent.id).toBeTruthy(); expect(f.current().polishingRuns![0]?.review).toBe('pending');
    await f.engine.applyPolishingResult(f.ideaId, pass.id, pass.workflow.revision);
    expect(vi.mocked(f.code.materialize).mock.calls.map(call => call[0].id)).toEqual([intent.id, intent.id]);
    expect(f.current().polishingRuns![0]?.review).toBe('applied'); expect(f.worker.providerLaunches).toHaveLength(1);
  } finally { await f.engine.stop(); }
});
