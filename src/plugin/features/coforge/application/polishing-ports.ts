import type { BackgroundBuildRetrySource, BackgroundBuildSnapshotRef } from '../domain/background-build-retry';
import type { PolishingCodeBinding } from '../domain/polishing';

export interface PolishingCodeApplyRequest {
  id: string; ideaId: string; projectId: string; source: BackgroundBuildRetrySource;
  reviewedSnapshot: BackgroundBuildSnapshotRef; evidenceHash: string; sourceArtifactHash: string;
  baseline: BackgroundBuildSnapshotRef;
  target: { runId: string; mode: 'foreground' | 'background'; workspaceEpoch: string; projectPath: string; worktreeFolder: string };
}
/** Explicit operator copy, never provider dispatch or adoption of another executor's workspace. */
export interface PolishingCodePort { materialize(request: PolishingCodeApplyRequest): Promise<PolishingCodeBinding> }
/** Only a verified settled, unbound copy can authorize a subsequent fresh operator epoch. */
export class PolishingCopyRetainedError extends Error {
  readonly code = 'POLISHING_COPY_RETAINED';
  constructor() { super('The incomplete copy was retained and is verified idle. Inspect the result, then apply again to create a fresh copy.'); this.name = 'PolishingCopyRetainedError'; }
}
