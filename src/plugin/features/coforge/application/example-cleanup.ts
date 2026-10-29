import { exampleCleanupPlan, exampleCleanupProblem, cleanupRequestIds, type ExampleCleanupPreview } from './example-cleanup-plan';
import { removeExampleState } from './example-cleanup-state';
import type { StudioStore } from './studio-store';

export async function previewExampleCleanup(store: StudioStore): Promise<ExampleCleanupPreview> {
  const preview = exampleCleanupPlan(store.internalSnapshot());
  preview.notes = await store.previewExampleNotes([...preview.automatic, ...preview.legacy, ...preview.ambiguous].map(idea => idea.id));
  if (preview.stateKey !== exampleCleanupPlan(store.internalSnapshot()).stateKey)
    throw new Error('Content changed while preparing the cleanup preview. Refresh the preview.');
  return preview;
}

export async function removeExampleContent(store: StudioStore, preview: ExampleCleanupPreview, additionalIds: readonly string[] = [], assertHost?: (ids: readonly string[]) => void | (() => void) | Promise<void | (() => void)>) {
  const current = exampleCleanupPlan(store.internalSnapshot());
  if (current.stateKey !== preview.stateKey) throw new Error('Content changed after the cleanup preview. Refresh and review the preview again.');
  const ids = cleanupRequestIds(current, additionalIds);
  const result = removeExampleState(store.internalSnapshot(), ids);
  if (!result.changed) return result;
  if (current.blocked) throw new Error(current.blocked);
  const notes = Object.fromEntries(ids.map(id => {
    const fingerprint = preview.notes[id];
    if (!fingerprint) throw new Error('A selected note is missing from the cleanup preview. Refresh the preview.');
    return [id, fingerprint];
  }));
  const release = await assertHost?.(ids);
  try {
    return await store.transaction(state => {
      const problem = exampleCleanupProblem(state);
      if (problem) throw new Error(problem);
      if (exampleCleanupPlan(state).stateKey !== preview.stateKey) throw new Error('Content changed after the cleanup preview. Refresh and review the preview again.');
      return removeExampleState(state, ids);
    }, { exampleCleanup: { notes } });
  } finally { if (typeof release === 'function') release(); }
}
