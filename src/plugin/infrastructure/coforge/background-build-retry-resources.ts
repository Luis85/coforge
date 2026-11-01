import { isAbsolute, relative, resolve, sep } from 'node:path';
import { realpath } from 'node:fs/promises';
import type { BackgroundBuildRetryPort, BackgroundBuildRetryTarget } from '../../features/coforge/application/background-build-retry-ports';
import type { WorkflowWorkspaceStorage } from '../../features/coforge/application/workflow-workspace-ports';
import type { BackgroundBuildRetryInspection, BackgroundBuildRetrySource, BackgroundBuildSnapshotRef } from '../../features/coforge/domain/background-build-retry';
import { inputHash } from './durable-worker/protocol';
import { canonicalPotentialPath, captureProjectProtection } from './durable-worker/protection';
import { captureRetrySource } from './background-build-seed/source';
import { checkSnapshotPaths, invalidSnapshot } from './background-build-seed/tree';
import { RetrySeedStore, retrySeedDirectory } from './background-build-seed/store';

export interface BackgroundBuildRetryResourceOptions {
  storage: WorkflowWorkspaceStorage; privateDirectory: string; vaultDirectory: string; protectedVaultFolders(): readonly string[];
  assertReady(): Promise<void>; validatePrivateDirectory?(): string;
  sourceStorage?(source: BackgroundBuildRetrySource): Promise<WorkflowWorkspaceStorage>;
}
const overlap = (a: string, b: string) => { const path = relative(a, b); return !path || path !== '..' && !path.startsWith('..' + sep) && !isAbsolute(path); };
/** Explicit inspection stages private immutable evidence; it never alters the original lease or starts a provider. */
export class BackgroundBuildRetryResources implements BackgroundBuildRetryPort {
  private readonly store: RetrySeedStore;
  constructor(private readonly options: BackgroundBuildRetryResourceOptions) { this.store = new RetrySeedStore(retrySeedDirectory(options.privateDirectory)); }
  private async location(projectRoot: string, sourceRoot: string) {
    if (this.options.validatePrivateDirectory && resolve(this.options.validatePrivateDirectory()) !== resolve(this.options.privateDirectory)) throw invalidSnapshot();
    const actual = await canonicalPotentialPath(this.store.files.directory); const requested = resolve(this.store.files.directory);
    if ((process.platform === 'win32' ? actual.toLowerCase() !== requested.toLowerCase() : actual !== requested)) throw invalidSnapshot();
    for (const root of [await realpath(this.options.vaultDirectory), projectRoot, sourceRoot])
      if (overlap(root, actual) || overlap(actual, root)) throw new Error('The private reviewed snapshot store must be outside the vault and project workspaces.');
  }
  async inspect(source: BackgroundBuildRetrySource): Promise<BackgroundBuildRetryInspection> {
    await this.options.assertReady(); const storage = await this.options.sourceStorage?.(source) ?? this.options.storage; const captured = await captureRetrySource(source, storage);
    await this.location(captured.identity.projectRoot, captured.identity.cwd);
    const protection = await captureProjectProtection(this.options.vaultDirectory, captured.identity.projectRoot, this.options.protectedVaultFolders());
    checkSnapshotPaths(captured.tree.changes, protection.protectedProjectPaths);
    const snapshot = await this.store.create(captured, protection.protectedProjectPaths);
    const after = await captureRetrySource(source, await this.options.sourceStorage?.(source) ?? storage); if (after.evidenceHash !== captured.evidenceHash) throw invalidSnapshot();
    return { version: 1, snapshot, evidenceHash: captured.evidenceHash, sourceKind: source.sourceKind, ...(source.sourceWorkspaceId ? { sourceWorkspaceId: source.sourceWorkspaceId } : {}),
      ...(captured.sourceOwner ? { sourceOwner: captured.sourceOwner } : {}),
      captureScope: captured.tree.captureScope, excludedPaths: captured.tree.excludedPaths,
      baseCommit: captured.identity.baseCommit, increment: captured.increment, fileCount: captured.tree.changes.length,
      totalBytes: captured.tree.changes.reduce((total, file) => total + file.size, 0), observedAt: new Date().toISOString(), humanCessationRequired: Boolean(source.sourceJobId || source.executorJobId || source.executorCandidates?.length) };
  }
  async verify(source: BackgroundBuildRetrySource, ref: BackgroundBuildSnapshotRef, target: BackgroundBuildRetryTarget): Promise<void> {
    if (target.kind === 'retry' ? !source.runId || target.runId !== source.runId || Boolean(source.sourceIdentity) : target.runId === source.runId || !source.sourceIdentity) throw invalidSnapshot();
    await this.options.assertReady(); const storage = await this.options.sourceStorage?.(source) ?? this.options.storage; const current = await captureRetrySource(source, storage);
    await this.location(current.identity.projectRoot, current.identity.cwd);
    const { manifest } = await this.store.read(ref);
    if (inputHash(manifest.source) !== inputHash(source) || manifest.evidenceHash !== current.evidenceHash) throw invalidSnapshot();
    const protection = await captureProjectProtection(this.options.vaultDirectory, current.identity.projectRoot, this.options.protectedVaultFolders());
    checkSnapshotPaths(manifest.changes, [...protection.protectedProjectPaths, ...manifest.protectedProjectPaths]);
    await this.store.authorize(ref, target);
    const after = await captureRetrySource(source, await this.options.sourceStorage?.(source) ?? storage); if (after.evidenceHash !== current.evidenceHash) throw invalidSnapshot();
  }
}
