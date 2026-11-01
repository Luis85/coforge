import { expect, it, vi } from 'vitest';
import { polishingCodeFixture } from './polishing-code-fixture';

it.each(['changed', 'missing'] as const)('rejects %s actual tree attestation even when binary size, file counts and visible diff are identical', async actual => {
  const f = await polishingCodeFixture();
  try {
    f.worker.complete(f.job.id); const snapshot = f.worker.snapshots.get(f.job.id)!;
    snapshot.increment = { ...snapshot.increment!, files: [{ path: 'asset.bin', additions: 0, deletions: 0 }], diff: 'Binary files a/asset.bin and b/asset.bin differ', snapshotHash: 'a'.repeat(64) };
    snapshot.result!.increment = structuredClone(snapshot.increment);
    await f.engine.reconcileDurableBuild(f.ideaId, f.job.workflow!.runId); const pass = f.current().polishingRuns![0]!; const before = f.current().workflowRun;
    const inspect = vi.mocked(f.resources.inspect).getMockImplementation()!;
    vi.mocked(f.resources.inspect).mockImplementation(async source => { const result = await inspect(source); result.increment = structuredClone(snapshot.increment!); if (actual === 'changed') result.increment.snapshotHash = 'b'.repeat(64); else delete result.increment.snapshotHash; return result; });
    await expect(f.engine.applyPolishingResult(f.ideaId, pass.id, pass.workflow.revision)).rejects.toThrow('changed');
    expect(f.code.materialize).not.toHaveBeenCalled(); expect(f.current().workflowRun).toEqual(before); expect(f.current().polishingRuns![0]?.review).toBe('pending');
  } finally { await f.engine.stop(); }
});

it('requires the copied tree to retain a verified hash and permits legacy artifacts without inventing an old attestation', async () => {
  const f = await polishingCodeFixture();
  try {
    f.worker.complete(f.job.id); await f.engine.reconcileDurableBuild(f.ideaId, f.job.workflow!.runId);
    const pass = f.current().polishingRuns![0]!; expect(pass.workflow.artifacts.at(-1)?.increment?.snapshotHash).toBeUndefined();
    const inspect = vi.mocked(f.resources.inspect).getMockImplementation()!;
    vi.mocked(f.resources.inspect).mockImplementation(async source => { const result = await inspect(source); if (result.increment) result.increment.snapshotHash = 'a'.repeat(64); return result; });
    const copy = vi.mocked(f.code.materialize).getMockImplementation()!;
    vi.mocked(f.code.materialize).mockImplementationOnce(async request => { const binding = await copy(request); binding.increment.snapshotHash = 'b'.repeat(64); return binding; });
    await expect(f.engine.applyPolishingResult(f.ideaId, pass.id, pass.workflow.revision)).rejects.toThrow('hash');
    expect(f.current().polishingRuns![0]?.review).toBe('pending');
    vi.mocked(f.code.materialize).mockImplementationOnce(async request => { const binding = await copy(request); binding.increment.snapshotHash = 'a'.repeat(64); return binding; });
    await f.engine.applyPolishingResult(f.ideaId, pass.id, pass.workflow.revision);
    expect(f.current().polishingRuns![0]?.review).toBe('applied'); expect(f.current().workflowRun?.workspaceId).toBe('wf-polished');
    expect(f.current().polishingRuns![0]?.workflow.artifacts.at(-1)?.increment?.snapshotHash).toBeUndefined();
  } finally { await f.engine.stop(); }
});
