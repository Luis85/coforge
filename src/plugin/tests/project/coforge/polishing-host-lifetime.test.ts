// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import { WorkflowEngine } from '../../../features/coforge/application/engine';
import { StudioStore } from '../../../features/coforge/application/studio-store';
import { PolishingCopyRetainedError, type PolishingCodePort } from '../../../features/coforge/application/polishing-ports';
import { VaultStudioStorage } from '../../../infrastructure/coforge/vault-storage';
import type { PolishingCodeBinding } from '../../../features/coforge/domain/polishing';
import { retryNoteFixture } from './background-build-retry-note-fixture';
import { consent } from './background-build-retry-fixture';
import { increment } from './configured-workflow-fixture';
import { nodeTimers } from './memory-storage';

async function ready() {
  const f = await retryNoteFixture({ frozen: false }); await f.engine.stop();
  await f.store.transaction(state => { state.settings.workflow!.improvementPass = { provider: 'claude', model: 'sonnet', instructions: 'Polish current code.', limits: { timeoutSeconds: 60, maxTurns: 4, maxBudgetUsd: 0.8 } }; });
  let copies = 0; const receipts = new Map<string, PolishingCodeBinding>();
  const materialize: PolishingCodePort['materialize'] = async request => {
    const old = receipts.get(request.id); if (old) return structuredClone(old);
    copies++; const binding: PolishingCodeBinding = { id: request.id, ownerRunId: request.target.runId, workspaceId: 'wf-after-review', workspaceEpoch: request.target.workspaceEpoch,
      mode: request.target.mode, increment: { ...increment, simulated: false, branch: 'reviewed-primary', worktree: '/synthetic/reviewed-primary' }, evidenceHash: 'e'.repeat(64) };
    receipts.set(request.id, binding); return structuredClone(binding);
  };
  const code: PolishingCodePort = { materialize: vi.fn(materialize) };
  const options = { backgroundBuildRetries: f.resources, durableBuilds: f.worker, polishingCode: code, runners: { demo: f.runner, claude: f.runner }, timers: nodeTimers() };
  const engine = new WorkflowEngine(f.store, options);
  const preview = await engine.previewPolishingPass(f.ideaId, 'Polish without losing existing changes.');
  await engine.confirmPolishingPass(f.ideaId, preview.id, consent); await engine.waitUntilIdle();
  const job = f.store.snapshot().jobs.at(-1)!; f.worker.complete(job.id); await engine.reconcileDurableBuild(f.ideaId, job.workflow!.runId);
  return { ...f, engine, code, options, materialize, copies: () => copies, pass: () => f.current().polishingRuns![0]! };
}

it.each([{ failure: false, restart: false }, { failure: true, restart: false }, { failure: false, restart: true }, { failure: true, restart: true }])('does not publish late copy outcome after host shutdown ($failure / restart=$restart)', async ({ failure, restart }) => {
  const f = await ready(); let reopened: WorkflowEngine | undefined;
  try {
    let release!: () => Promise<void>;
    vi.mocked(f.code.materialize).mockImplementationOnce(request => new Promise((resolve, reject) => {
      release = async () => { if (failure) reject(new PolishingCopyRetainedError()); else resolve(await f.materialize(request)); };
    }));
    const pass = f.pass(); const applying = f.engine.applyPolishingResult(f.ideaId, pass.id, pass.workflow.revision).then(() => undefined, error => error);
    await vi.waitFor(() => expect(f.code.materialize).toHaveBeenCalledTimes(1));
    const id = f.pass().applyIntent!.id;
    await f.engine.stop();
    if (restart) f.engine.start();
    const note = f.kit.read(f.file.path); const data = f.kit.read(f.storage.dataPath); const previous = f.store.snapshot();
    const observer = vi.fn(); const events = vi.fn(); const unsub = f.store.subscribe(observer); const unEvents = f.store.subscribeEvents(events); observer.mockClear();
    await release(); expect(await applying).toBeInstanceOf(Error); await f.store.flush();
    expect(f.kit.read(f.file.path) === note).toBe(true); expect(f.kit.read(f.storage.dataPath) === data).toBe(true); expect(f.store.snapshot()).toEqual(previous);
    expect(observer).not.toHaveBeenCalled(); expect(events).not.toHaveBeenCalled(); unsub(); unEvents();
    await f.engine.stop();
    const store = new StudioStore(new VaultStudioStorage(f.plugin)); await store.init(); reopened = new WorkflowEngine(store, f.options);
    const restored = store.snapshot().ideas.find(idea => idea.id === f.ideaId)!.polishingRuns![0]!;
    expect(restored.applyIntent?.id).toBe(id); expect(restored.review).toBe('pending'); expect(restored.applyFailure).toBeUndefined();
    if (failure) {
      vi.mocked(f.code.materialize).mockRejectedValueOnce(new PolishingCopyRetainedError());
      await expect(reopened.applyPolishingResult(f.ideaId, restored.id, restored.workflow.revision)).rejects.toBeInstanceOf(PolishingCopyRetainedError);
    } else await reopened.applyPolishingResult(f.ideaId, restored.id, restored.workflow.revision);
    expect(vi.mocked(f.code.materialize).mock.calls.map(call => call[0].id)).toEqual([id, id]);
    expect(f.copies()).toBe(failure ? 0 : 1); expect(f.worker.providerLaunches).toHaveLength(1);
  } finally { await f.engine.stop(); await reopened?.stop(); }
});

it('settles a canonical intent write admitted before shutdown, then detaches before any private copy', async () => {
  const f = await ready();
  try {
    const write = f.app.vault.adapter.write.bind(f.app.vault.adapter); let release!: () => void; let admitted!: () => void;
    const admittedWrite = new Promise<void>(resolve => { admitted = resolve; }); let held = true;
    vi.spyOn(f.app.vault.adapter, 'write').mockImplementation(async (path, bytes) => {
      if (path === f.storage.dataPath && held) { held = false; admitted(); await new Promise<void>(resolve => { release = resolve; }); }
      await write(path, bytes);
    });
    const pass = f.pass(); const applying = f.engine.applyPolishingResult(f.ideaId, pass.id, pass.workflow.revision).then(() => undefined, error => error);
    await admittedWrite; let stopped = false; const stopping = f.engine.stop().then(() => { stopped = true; });
    await Promise.resolve(); expect(stopped).toBe(false); release(); await stopping;
    expect(await applying).toBeInstanceOf(Error); expect(f.pass().applyIntent).toBeDefined(); expect(f.code.materialize).not.toHaveBeenCalled();
    expect(f.kit.read(f.file.path)).toContain(f.pass().applyIntent!.id);
  } finally { await f.engine.stop(); vi.restoreAllMocks(); }
});
