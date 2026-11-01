import type { Increment } from '../../../features/coforge/domain/types';
import type { SnapshotChange } from './tree';
/** The file list covers the immutable aggregate; the bounded code view always discloses omitted bytes. */
export function completeSnapshotPreview(increment: Increment, changes: readonly SnapshotChange[]): Increment {
  const marker = '\n[Preview truncated. Inspect the full worktree before accepting.]';
  const truncated = increment.diff.length > 160000 && increment.diff.endsWith(marker); let extra = '';
  for (const change of changes) if (!increment.files.some(file => file.path === change.path)) {
    increment.files.push({ path: change.path, additions: 0, deletions: 0 });
    extra += '\nAdditional reviewed file: ' + change.path + ' (' + change.kind + ', ' + change.size + ' bytes).\n';
  }
  const combined = (truncated ? increment.diff.slice(0, -marker.length) : increment.diff) + extra;
  increment.diff = combined.slice(0, 160000) + (truncated || combined.length > 160000 ? marker : '');
  return increment;
}
