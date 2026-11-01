import type { Increment } from '../../features/coforge/domain/types';
import { agentGit, captureIncrement } from './agent-worktree';
import { snapshotTree } from './background-build-seed/tree';
import { completeSnapshotPreview } from './background-build-seed/preview';
/** Actual cumulative evidence includes allowed ignored files; no preview or hash substitutes for the retained bytes. */
export async function captureWorkflowIncrement(worktree: string, branch: string, summary: string, signal?: AbortSignal,
  options: { allowEmpty?: boolean; baseCommit?: string } = {}): Promise<Increment> {
  signal?.throwIfAborted(); const baseCommit = options.baseCommit ?? (await agentGit(worktree, ['rev-parse', '--verify', 'HEAD'], signal)).trim();
  const increment = await captureIncrement(worktree, branch, summary, signal, { ...options, allowEmpty: true, baseCommit });
  const tree = await snapshotTree(worktree, baseCommit); signal?.throwIfAborted();
  completeSnapshotPreview(increment, tree.changes);
  increment.snapshotHash = tree.treeHash;
  if (!increment.files.length && !options.allowEmpty) throw new Error('No changed files were captured. Inspect the worktree before retrying.');
  return increment;
}
