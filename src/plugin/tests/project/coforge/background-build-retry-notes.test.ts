// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import { StudioStore } from '../../../features/coforge/application/studio-store';
import { VaultStudioStorage, readIdeaNote, splitNote } from '../../../infrastructure/coforge/vault-storage';
import { consent } from './background-build-retry-fixture';
import { retryNoteFixture as fixture } from './background-build-retry-note-fixture';
it('persists only a fresh retry approval/attempt while retaining canonical request bytes and original history across reload', async () => {
  const f = await fixture();
  try {
    const before = f.kit.read(f.file.path); const original = f.store.snapshot().ideas.find(idea => idea.id === f.ideaId)!.workflowRun!;
    const jobs = f.store.snapshot().jobs;
    const preview = await f.engine.previewBackgroundBuildRetry(f.ideaId);
    expect(f.kit.read(f.file.path)).toBe(before); expect(f.worker.prepare).not.toHaveBeenCalled();
    await f.engine.confirmBackgroundBuildRetry(f.ideaId, preview.id, consent);
    const after = f.kit.read(f.file.path);
    expect(splitNote(after).body).toBe(splitNote(before).body); expect(after).toContain('custom-owner: "Keep  exact spacing"');
    const parsed = readIdeaNote(after)!; const current = parsed.workflowRun!;
    expect(parsed.id).toBe(f.ideaId); expect(current.id).toBe(original.id); expect(current.cursor).toBe(original.cursor);
    expect(current.definition).toEqual(original.definition); expect(current.artifacts).toEqual(original.artifacts);
    expect(current.attempts.slice(0, original.attempts.length)).toEqual(original.attempts); expect(current.backgroundRetries).toHaveLength(1);
    const reloaded = new StudioStore(new VaultStudioStorage(f.plugin)); await reloaded.init();
    const persisted = reloaded.snapshot().ideas.find(idea => idea.id === f.ideaId)!.workflowRun!;
    expect(persisted.backgroundRetries).toEqual(current.backgroundRetries); expect(persisted.definition).toEqual(original.definition);
    for (const job of jobs) expect(reloaded.snapshot().jobs.find(candidate => candidate.id === job.id)).toEqual(job);
    expect(f.worker.prepare).not.toHaveBeenCalled();
  } finally { await f.engine.stop(); }
});
it('rolls back the owned note update if the private approval/job write fails, without any worker admission', async () => {
  const f = await fixture();
  try {
    const before = f.kit.read(f.file.path); const data = f.kit.read(f.storage.dataPath);
    const preview = await f.engine.previewBackgroundBuildRetry(f.ideaId);
    const write = f.app.vault.adapter.write.bind(f.app.vault.adapter); let fail = true;
    vi.spyOn(f.app.vault.adapter, 'write').mockImplementation(async (path, content) => {
      if (path === f.storage.dataPath && fail) { fail = false; throw new Error('Synthetic private storage failure'); }
      await write(path, content);
    });
    await expect(f.engine.confirmBackgroundBuildRetry(f.ideaId, preview.id, consent)).rejects.toThrow();
    expect(f.kit.read(f.file.path)).toBe(before); expect(f.kit.read(f.storage.dataPath)).toBe(data);
    expect(f.store.snapshot().ideas.find(idea => idea.id === f.ideaId)?.workflowRun?.backgroundRetries).toBeUndefined();
    expect(f.worker.prepare).not.toHaveBeenCalled(); expect(f.worker.start).not.toHaveBeenCalled();
  } finally { await f.engine.stop(); vi.restoreAllMocks(); }
});
it('retains the prior canonical epoch when result projection cannot commit, then applies the original worker result once', async () => {
  const f = await fixture({ frozen: false });
  try {
    const preview = await f.engine.previewBackgroundBuildRetry(f.ideaId); await f.engine.confirmBackgroundBuildRetry(f.ideaId, preview.id, consent); await f.engine.waitUntilIdle();
    const job = f.store.snapshot().jobs.at(-1)!; expect(f.worker.providerLaunches).toEqual([job.id]);
    const before = f.kit.read(f.file.path); const data = f.kit.read(f.storage.dataPath); const run = structuredClone(f.current().workflowRun);
    const write = f.app.vault.adapter.write.bind(f.app.vault.adapter); let fail = true;
    vi.spyOn(f.app.vault.adapter, 'write').mockImplementation(async (path, content) => {
      if (path === f.storage.dataPath && fail) { fail = false; throw new Error('Synthetic result-ledger failure'); } await write(path, content);
    });
    f.worker.complete(job.id); await expect(f.engine.reconcileDurableBuild(f.ideaId, job.workflow!.runId)).rejects.toThrow('original background Build');
    expect(f.kit.read(f.file.path) === before).toBe(true); expect(f.kit.read(f.storage.dataPath) === data).toBe(true);
    expect(f.current().workflowRun).toEqual(run); expect(f.worker.acknowledge).not.toHaveBeenCalled();
    await f.engine.reconcileDurableBuild(f.ideaId, job.workflow!.runId);
    expect(f.current().workflowRun?.state).toBe('awaiting-review'); expect(f.current().workflowRun?.attempts).toHaveLength(run!.attempts.length);
    expect(f.worker.acknowledge).toHaveBeenCalledTimes(1); expect(f.worker.providerLaunches).toEqual([job.id]);
    expect(splitNote(f.kit.read(f.file.path)).body).toBe(splitNote(before).body);
  } finally { await f.engine.stop(); vi.restoreAllMocks(); }
});
