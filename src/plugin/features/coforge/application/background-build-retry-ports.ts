import type { BackgroundBuildRetryInspection, BackgroundBuildRetrySource, BackgroundBuildSnapshotRef } from '../domain/background-build-retry';

export interface BackgroundBuildRetryTarget { kind: 'retry' | 'improvement'; runId: string; retryId: string; jobId: string; attemptId: string }
export interface BackgroundBuildRetryPort {
  /** Inspect and privately stage actual immutable files; no model, canonical note, or worker admission. */
  inspect(source: BackgroundBuildRetrySource): Promise<BackgroundBuildRetryInspection>;
  /** Recheck original identity/content and authorize only this new target; still no provider launch. */
  verify(source: BackgroundBuildRetrySource, snapshot: BackgroundBuildSnapshotRef, target: BackgroundBuildRetryTarget): Promise<void>;
}
