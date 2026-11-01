// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import { StudioStore } from '../../../features/coforge/application/studio-store';
import { VaultStudioStorage, readIdeaNote, splitNote } from '../../../infrastructure/coforge/vault-storage';
import { selectPolishingTarget } from '../../../features/coforge/domain/polishing-target';
import { retryNoteFixture } from './background-build-retry-note-fixture';
import { consent } from './background-build-retry-fixture';

async function ready(frozen = false) {
  const f = await retryNoteFixture({ partial: false, frozen });
  await f.store.transaction(state => { state.settings.workflow!.improvementPass = { provider: 'demo', model: 'sonnet', instructions: 'Polish the current result.', limits: { timeoutSeconds: 60, maxTurns: 3, maxBudgetUsd: 0.5 } }; });
  await f.app.vault.process(f.file, bytes => bytes.replace(/^custom-owner:.*$/mu, 'custom-owner: "Keep  exact spacing"'));
  f.runner.mockImplementationOnce(async () => ({ markdown: '# Reviewed current design' })); return f;
}
it('preserves canonical body/unrelated properties through auxiliary execution, explicit Apply and metadata reload', async () => {
  const f = await ready();
  try {
    const before = f.kit.read(f.file.path); const original = structuredClone(f.current().workflowRun);
    const preview = await f.engine.previewPolishingPass(f.ideaId, 'Clarify the recovery details.'); expect(f.kit.read(f.file.path)).toBe(before);
    await f.engine.confirmPolishingPass(f.ideaId, preview.id, consent); await f.engine.waitUntilIdle();
    const pass = f.current().polishingRuns![0]!;
    expect(pass.workflow.state).toBe('awaiting-review'); expect(f.current().workflowRun).toEqual(original);
    expect(splitNote(f.kit.read(f.file.path)).body).toBe(splitNote(before).body); expect(f.kit.read(f.file.path)).toContain('custom-owner: "Keep  exact spacing"');
    await f.engine.applyPolishingResult(f.ideaId, pass.id, pass.workflow.revision);
    const note = f.kit.read(f.file.path); const parsed = readIdeaNote(note)!;
    expect(parsed.polishingRuns?.[0]?.review).toBe('applied'); expect(parsed.workflowRun).toEqual(original);
    expect(splitNote(note).body).toBe(splitNote(before).body); expect(note).toContain('custom-owner: "Keep  exact spacing"');
    const reloaded = new StudioStore(new VaultStudioStorage(f.plugin)); await reloaded.init(); const idea = reloaded.snapshot().ideas.find(item => item.id === f.ideaId)!;
    expect(f.kit.read(f.file.path).includes('custom-owner: "Keep  exact spacing"')).toBe(true);
    expect(splitNote(f.kit.read(f.file.path)).body).toBe(splitNote(before).body);
    expect(idea.workflowRun).toEqual(original); expect(idea.polishingRuns?.[0]?.review).toBe('applied');
    expect(selectPolishingTarget(idea).value.markdown).toBe('# Reviewed current design'); expect(f.worker.prepare).not.toHaveBeenCalled();
  } finally { await f.engine.stop(); }
});
it('persists interrupted auxiliary recovery into the canonical note without corrupting its next reload', async () => {
  const f = await ready(true);
  try {
    const main = structuredClone(f.current().workflowRun); const calls = f.runner.mock.calls.length;
    const preview = await f.engine.previewPolishingPass(f.ideaId, 'Clarify the design.'); await f.engine.confirmPolishingPass(f.ideaId, preview.id, consent);
    expect(f.current().polishingRuns?.[0]?.workflow.state).toBe('running'); expect(f.runner).toHaveBeenCalledTimes(calls);
    const reloaded = new StudioStore(new VaultStudioStorage(f.plugin)); await reloaded.init(); const idea = reloaded.snapshot().ideas.find(item => item.id === f.ideaId)!;
    expect(idea.workflowRun).toEqual(main); expect(idea.polishingRuns?.[0]?.workflow.state).toBe('attention');
    expect(idea.polishingRuns?.[0]?.workflow.attempts[0]?.status).toBe('failed');
    const bytes = f.kit.read(f.file.path); expect(readIdeaNote(bytes)?.polishingRuns).toEqual(idea.polishingRuns);
    expect(bytes.includes('custom-owner: "Keep  exact spacing"')).toBe(true);
    const again = new StudioStore(new VaultStudioStorage(f.plugin)); await again.init();
    expect(again.snapshot().ideas.find(item => item.id === f.ideaId)?.polishingRuns).toEqual(idea.polishingRuns);
  } finally { await f.engine.stop(); }
});
it('rolls back a failed private Apply write, retaining the pending review and its exact note bytes', async () => {
  const f = await ready();
  try {
    const preview = await f.engine.previewPolishingPass(f.ideaId, 'Clarify the design.'); await f.engine.confirmPolishingPass(f.ideaId, preview.id, consent); await f.engine.waitUntilIdle();
    const pass = f.current().polishingRuns![0]!; const note = f.kit.read(f.file.path); const data = f.kit.read(f.storage.dataPath);
    const write = f.app.vault.adapter.write.bind(f.app.vault.adapter); let fail = true;
    vi.spyOn(f.app.vault.adapter, 'write').mockImplementation(async (path, content) => {
      if (path === f.storage.dataPath && fail) { fail = false; throw new Error('Synthetic private write failure'); } await write(path, content);
    });
    const observer = vi.fn(); const unsubscribe = f.store.subscribe(observer); observer.mockClear();
    await expect(f.engine.applyPolishingResult(f.ideaId, pass.id, pass.workflow.revision)).rejects.toThrow();
    expect(f.kit.read(f.file.path)).toBe(note); expect(f.kit.read(f.storage.dataPath)).toBe(data); expect(f.current().polishingRuns?.[0]?.review).toBe('pending'); expect(observer).not.toHaveBeenCalled(); unsubscribe();
  } finally { await f.engine.stop(); vi.restoreAllMocks(); }
});
