import { chmod, lstat, mkdir, open, realpath, unlink } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import type { DurableBuildRequest } from '../../../features/coforge/application/durable-build-ports';
import type { WorkflowWorkspaceLease } from '../../../features/coforge/application/workflow-workspace-ports';
import { agentGit } from '../agent-worktree';
import { RetrySeedStore, retrySeedDirectory } from './store';
import { verifyRetrySourceIdentity } from './source';
import { checkSnapshotPaths, invalidSnapshot, snapshotTree } from './tree';
import { inputHash } from '../durable-worker/protocol';
import type { StageInput } from '../../../features/coforge/application/ports';
import { isManagedWorkflowSession } from '../../../features/coforge/domain/workflow-lifecycle';
import { ideaProjectId } from '../../../features/coforge/domain/projects';

export async function reviewedBuildSeed(privateDirectory: string, request: DurableBuildRequest) {
  if (!request.reviewedSnapshot) return undefined;
  const workflow = request.input.workflow; const retryId = workflow.backgroundRetryId ?? workflow.polishingId;
  if (!retryId || workflow.backgroundRetryId && workflow.polishingId || workflow.workspaceId) throw new Error('A reviewed import requires a new authorized workspace epoch; original writers are never adopted.');
  const store = new RetrySeedStore(retrySeedDirectory(privateDirectory)); const value = await store.authorization(request.reviewedSnapshot, retryId);
  const { source, identity, changes } = value.manifest; const target = value.target;
  const bindingValid = target.kind === 'retry'
    ? workflow.backgroundRetryId === target.retryId && !workflow.polishingId && Boolean(source.runId) && target.runId === source.runId && workflow.step.id === source.stepId && !source.sourceIdentity
    : workflow.polishingId === target.retryId && !workflow.backgroundRetryId && target.runId !== source.runId && workflow.sourceRunId === source.runId && Boolean(source.sourceIdentity) && workflow.polishingSourceHash === source.sourceIdentity;
  if (!bindingValid || target.retryId !== retryId || target.runId !== request.runId || target.jobId !== request.jobId || target.attemptId !== request.attemptId ||
    request.projectId !== source.projectId || request.ideaId !== source.ideaId ||
    request.input.workflow.proposalRevision !== source.proposalRevision ||
    target.jobId === source.sourceJobId || target.attemptId === source.sourceAttemptId ||
    await realpath(request.input.integration.projectPath) !== identity.projectRoot) throw invalidSnapshot();
  checkSnapshotPaths(changes, [...value.manifest.protectedProjectPaths, ...(request.protectedProjectPaths ?? [])]);
  const actual = await verifyRetrySourceIdentity(source, identity); if (actual.evidenceHash !== value.manifest.evidenceHash) throw invalidSnapshot();
  return { store, ...value };
}
/** Foreground AI imports bind the same private immutable authorization without impersonating a worker admission. */
export async function reviewedForegroundPolishingSeed(privateDirectory: string, input: StageInput) {
  const workflow = input.workflow;
  const pass = input.idea.polishingRuns?.find(pass => pass.id === workflow?.polishingId && pass.workflow.id === workflow.runId);
  if (!workflow || !isManagedWorkflowSession(workflow) || workflow.step.execution || workflow.backgroundRetryId || !workflow.polishingId
    || workflow.step.output !== 'codechange' || workflow.step.access !== 'editworktree' || !input.jobId || workflow.workspaceId || !pass?.reviewedSnapshot
    || pass.review !== 'pending' || pass.sourceHash !== workflow.polishingSourceHash) throw invalidSnapshot();
  const store = new RetrySeedStore(retrySeedDirectory(privateDirectory));
  const seed = await store.authorization(pass.reviewedSnapshot, workflow.polishingId), { target, manifest } = seed;
  const root = await realpath((await agentGit(await realpath(input.integration.projectPath), ['rev-parse', '--show-toplevel'])).trim());
  if (target.kind !== 'improvement' || target.runId !== workflow.runId || target.retryId !== workflow.polishingId || target.jobId !== input.jobId || target.attemptId !== workflow.attemptId
    || manifest.source.projectId !== ideaProjectId(input.idea) || manifest.source.ideaId !== input.idea.id || manifest.source.proposalRevision !== workflow.proposalRevision
    || manifest.source.sourceIdentity !== workflow.polishingSourceHash || manifest.source.runId !== workflow.sourceRunId || manifest.identity.projectRoot !== root
    || inputHash(pass.reviewedSource) !== inputHash(manifest.source) || target.runId === manifest.source.runId || target.jobId === manifest.source.sourceJobId || target.attemptId === manifest.source.sourceAttemptId)
    throw invalidSnapshot();
  if ((await verifyRetrySourceIdentity(manifest.source, manifest.identity)).evidenceHash !== manifest.evidenceHash) throw invalidSnapshot();
  checkSnapshotPaths(manifest.changes, manifest.protectedProjectPaths);
  return { ...seed, store };
}
async function targetPath(root: string, path: string) {
  const absolute = resolve(root, path); const within = relative(root, absolute);
  if (!within || within === '..' || within.startsWith('..' + sep) || isAbsolute(within)) throw invalidSnapshot();
  let current = root;
  for (const part of path.split('/').slice(0, -1)) {
    current = join(current, part);
    try { const before = await lstat(current); if (!before.isDirectory() || before.isSymbolicLink() || await realpath(current) !== current) throw invalidSnapshot(); }
    catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; await mkdir(current, { mode: 0o700 }); }
  }
  const before = await lstat(absolute).catch(error => { if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined; throw error; });
  if (before && (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1)) throw invalidSnapshot();
  return { path: absolute, before };
}
/** Only called for a newly acquired worker-owned epoch, before the provider receives stdin/tools. */
export async function copyReviewedSnapshot(seed: Awaited<ReturnType<RetrySeedStore['read']>> & { store: RetrySeedStore }, lease: WorkflowWorkspaceLease, protectedPaths: readonly string[], signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();
  if (!lease.id || lease.readOnly) throw invalidSnapshot(); await lease.validate?.();
  const { manifest } = seed;
  if ((await agentGit(lease.cwd, ['rev-parse', '--verify', 'HEAD'])).trim() !== manifest.identity.baseCommit ||
    (await agentGit(lease.cwd, ['status', '--porcelain', '--untracked-files=all'])).trim()) throw invalidSnapshot();
  const before = await verifyRetrySourceIdentity(manifest.source, manifest.identity);
  if (before.evidenceHash !== manifest.evidenceHash) throw invalidSnapshot();
  checkSnapshotPaths(manifest.changes, [...manifest.protectedProjectPaths, ...protectedPaths]);
  for (const entry of manifest.changes) {
    signal?.throwIfAborted();
    await lease.validate?.();
    const target = await targetPath(lease.cwd, entry.path); const path = target.path;
    if (entry.kind === 'deleted') { await unlink(path); continue; }
    if (!entry.hash) throw invalidSnapshot(); const data = await seed.store.blob(seed.files, entry.hash, entry.size);
    const handle = await open(path, target.before ? constants.O_WRONLY | constants.O_NOFOLLOW : 'wx', 0o600);
    try {
      const opened = await handle.stat();
      if (!opened.isFile() || opened.nlink !== 1 || target.before && (opened.dev !== target.before.dev || opened.ino !== target.before.ino)) throw invalidSnapshot();
      await handle.truncate(0); await handle.writeFile(data); await handle.sync();
    } finally { await handle.close(); }
    if (process.platform === 'win32') {
      if (entry.mode === '100755') await agentGit(lease.cwd, ['update-index', '--add', '--chmod=+x', '--', entry.path]);
      else if ((await agentGit(lease.cwd, ['ls-files', '--', entry.path])).trim()) await agentGit(lease.cwd, ['update-index', '--chmod=-x', '--', entry.path]);
    } else await chmod(path, entry.mode === '100755' ? 0o755 : 0o644);
    if (createHash('sha256').update(data).digest('hex') !== entry.hash) throw invalidSnapshot();
  }
  const after = await verifyRetrySourceIdentity(manifest.source, manifest.identity);
  if (after.evidenceHash !== before.evidenceHash) throw invalidSnapshot();
  const target = await snapshotTree(lease.cwd, manifest.identity.baseCommit);
  if (target.treeHash !== manifest.treeHash) throw new Error('The new worker workspace does not exactly match the reviewed snapshot. No provider was started.');
  const reread = await seed.store.read(seed.ref);
  if (inputHash(reread.manifest) !== inputHash(manifest)) throw invalidSnapshot();
  await lease.validate?.();
  signal?.throwIfAborted();
}
export async function importReviewedBuildSeed(seed: NonNullable<Awaited<ReturnType<typeof reviewedBuildSeed>>>, lease: WorkflowWorkspaceLease, request: DurableBuildRequest, signal?: AbortSignal): Promise<void> {
  if (!lease.id?.startsWith('bg-')) throw invalidSnapshot();
  await copyReviewedSnapshot(seed, lease, request.protectedProjectPaths ?? [], signal);
  const reread = await seed.store.authorization(seed.ref, seed.target.retryId);
  if (inputHash(reread.target) !== inputHash(seed.target)) throw invalidSnapshot();
}
