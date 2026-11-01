import { randomUUID, createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { open, lstat } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { list, number, oneOf, optional, shape, text, timestamp } from '../../../features/coforge/domain/check';
import { backgroundBuildRetrySourceCheck, backgroundBuildSnapshotRefCheck, type BackgroundBuildSnapshotRef } from '../../../features/coforge/domain/background-build-retry';
import { durableBuildResultCheck } from '../../../features/coforge/domain/durable-build';
import type { BackgroundBuildRetryTarget } from '../../../features/coforge/application/background-build-retry-ports';
import { WorkerFiles } from '../durable-worker/files';
import { inputHash } from '../durable-worker/protocol';
import { workflowWorkspaceRecordsCheck } from '../workflow-workspace-check';
import { snapshotFile, SNAPSHOT_FILE_LIMIT, SNAPSHOT_TOTAL_LIMIT, invalidSnapshot, CAPTURE_SCOPE } from './tree';
import type { RetrySourceSnapshot } from './source';

const hash = text({ pattern: /^[a-f0-9]{64}$/u }); const id = text({ pattern: /^[a-zA-Z0-9_-]{1,100}$/u }); const path = text({ min: 1, max: 4096 });
const mode = oneOf(['100644', '100755'] as const);
export const seedTargetCheck = shape({ kind: oneOf(['retry', 'improvement'] as const), runId: id, retryId: id, jobId: id, attemptId: id }, { strict: true });
export const seedManifestCheck = shape({ version: oneOf([1] as const), source: backgroundBuildRetrySourceCheck,
  identity: shape({ projectRoot: path, cwd: path, baseCommit: text({ pattern: /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u }), branch: text({ min: 1, max: 320 }),
    workspace: optional((value: unknown) => workflowWorkspaceRecordsCheck([value])[0]!), directoryDevice: number({ min: 0 }), directoryInode: number({ min: 0 }),
    gitDirectory: path, gitDevice: number({ min: 0 }), gitInode: number({ min: 0 }), gitPointer: optional(text({ min: 1, max: 4096 })) }, { strict: true }),
  evidenceHash: hash, treeHash: hash, captureScope: oneOf([CAPTURE_SCOPE] as const),
  excludedPaths: list(shape({ path, reason: oneOf(['git-ignored-agent-denied-directory', 'git-ignored-agent-denied-link'] as const) }, { strict: true }), { max: 10000 }),
  protectedProjectPaths: list(path, { max: 500 }), observedAt: timestamp,
  changes: list(shape({ path, mode, kind: oneOf(['file', 'deleted'] as const), hash: optional(hash), size: number({ integer: true, min: 0, max: SNAPSHOT_FILE_LIMIT }) }, { strict: true }), { max: 10000 }),
  increment: (value: unknown) => value === null ? null : durableBuildResultCheck({ increment: value }).increment ?? null,
}, { strict: true });
export type SeedManifest = ReturnType<typeof seedManifestCheck>;
export const retrySeedDirectory = (privateDirectory: string) => join(dirname(privateDirectory), basename(privateDirectory) + '-retry-seeds');
export class RetrySeedStore {
  readonly files: WorkerFiles;
  constructor(directory: string) { this.files = new WorkerFiles(directory); }
  async create(snapshot: RetrySourceSnapshot, protectedProjectPaths: string[]): Promise<BackgroundBuildSnapshotRef> {
    await this.files.initialize(); const id = randomUUID(); const files = await this.files.child(id);
    let copied = 0;
    for (const entry of snapshot.tree.changes) {
      if (entry.kind === 'deleted') continue;
      const data = await snapshotFile(snapshot.identity.cwd, entry.path);
      if (createHash('sha256').update(data).digest('hex') !== entry.hash) throw invalidSnapshot();
      copied += data.length; if (copied > SNAPSHOT_TOTAL_LIMIT) throw invalidSnapshot();
      const name = 'blob-' + entry.hash;
      if (await files.read(name + '.meta') === undefined) {
        const output = await open(files.path(name), 'wx', 0o600);
        try { await output.writeFile(data); await output.sync(); } finally { await output.close(); }
        await files.create(name + '.meta', { size: data.length, hash: entry.hash });
      }
    }
    const manifest = seedManifestCheck({ version: 1, source: snapshot.source, identity: snapshot.identity, evidenceHash: snapshot.evidenceHash,
      treeHash: snapshot.tree.treeHash, captureScope: snapshot.tree.captureScope, excludedPaths: snapshot.tree.excludedPaths, protectedProjectPaths, changes: snapshot.tree.changes, increment: snapshot.increment, observedAt: new Date().toISOString() });
    await files.create('manifest.json', manifest);
    return { version: 1, id, contentHash: inputHash(manifest) };
  }
  async read(value: BackgroundBuildSnapshotRef) {
    const ref = backgroundBuildSnapshotRefCheck(value); await this.files.attach();
    const files = new WorkerFiles(this.files.path(ref.id)); await files.attach();
    const manifest = seedManifestCheck(await files.read('manifest.json'));
    if (inputHash(manifest) !== ref.contentHash) throw invalidSnapshot();
    let bytes = 0;
    for (const entry of manifest.changes) {
      if (entry.kind === 'deleted') { if (entry.hash || entry.size) throw invalidSnapshot(); continue; }
      if (!entry.hash) throw invalidSnapshot(); const data = await this.blob(files, entry.hash, entry.size);
      bytes += data.length; if (bytes > SNAPSHOT_TOTAL_LIMIT) throw invalidSnapshot();
    }
    return { ref, files, manifest };
  }
  async blob(files: WorkerFiles, hashValue: string, size: number): Promise<Buffer> {
    hash(hashValue); await files.verifyIdentity(); const path = files.path('blob-' + hashValue); const before = await lstat(path);
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size !== size || before.size > SNAPSHOT_FILE_LIMIT) throw invalidSnapshot();
    const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const opened = await handle.stat(); if (!opened.isFile() || opened.nlink !== 1 || opened.dev !== before.dev || opened.ino !== before.ino) throw invalidSnapshot();
      const data = await handle.readFile(); const after = await handle.stat(); const named = await lstat(path);
      if (before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs || named.dev !== after.dev || named.ino !== after.ino ||
        named.nlink !== 1 || named.isSymbolicLink() || data.length !== size || createHash('sha256').update(data).digest('hex') !== hashValue) throw invalidSnapshot();
      return data;
    } finally { await handle.close(); }
  }
  async authorize(ref: BackgroundBuildSnapshotRef, targetValue: BackgroundBuildRetryTarget): Promise<void> {
    const { files } = await this.read(ref); const target = seedTargetCheck(targetValue); const name = 'authorization-' + target.retryId + '.json';
    const value = { version: 1, snapshot: ref, target };
    const previous = await files.read(name); if (previous !== undefined) { if (inputHash(previous) !== inputHash(value)) throw invalidSnapshot(); return; }
    await files.create(name, value);
  }
  async authorization(ref: BackgroundBuildSnapshotRef, retryId: string) {
    const value = await this.read(ref); id(retryId);
    const authorization = shape({ version: oneOf([1] as const), snapshot: backgroundBuildSnapshotRefCheck, target: seedTargetCheck }, { strict: true })(await value.files.read('authorization-' + retryId + '.json'));
    if (inputHash(authorization.snapshot) !== inputHash(ref)) throw invalidSnapshot(); return { ...value, target: authorization.target };
  }
}
