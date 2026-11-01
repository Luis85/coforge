import { lstat, mkdir, readdir, realpath, rename } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { boolean, list, number, oneOf, optional, shape, text, timestamp } from '../../../features/coforge/domain/check';
import { durableBuildTerminal } from '../../../features/coforge/domain/durable-build';
import { WorkerFiles } from './files';
import { inputHash, workerRequestCheck } from './protocol';
import { nativeIdentityCheck, workerRecordCheck, type WorkerRecord } from './store';
import { readNativeProcessIdentity } from './process-identity';
import { workflowWorkspaceRecordsCheck } from '../workflow-workspace-check';
import { operatorWorkspaceRecord, retainedOperatorCopy } from '../background-build-seed/operator-record';

const segment = text({ min: 1, max: 160, pattern: /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/u });
export const generationLaunchCheck = shape({ version: oneOf([1] as const), workerId: segment, epoch: number({ integer: true, min: 1 }), nonce: segment,
  token: text({ pattern: /^[a-f0-9]{64}$/u }), sourceHash: text({ pattern: /^[a-f0-9]{64}$/u }) }, { strict: true });
export const generationExitCheck = shape({ version: oneOf([1] as const), workerId: segment, nonce: segment, sourceHash: text({ pattern: /^[a-f0-9]{64}$/u }),
  confirmedChildExit: boolean, code: optional(number({ integer: true })), signal: optional(text({ max: 100 })), observedAt: timestamp }, { strict: true });
export const generationSpawnFailureCheck = shape({ version: oneOf([1] as const), workerId: segment, nonce: segment, sourceHash: text({ pattern: /^[a-f0-9]{64}$/u }),
  confirmedNotStarted: boolean, code: oneOf(['ENOENT', 'EACCES', 'EPERM', 'ENOEXEC', 'EINVAL'] as const), observedAt: timestamp }, { strict: true });
const idsCheck = list(text({ pattern: /^build-[a-f0-9]{40}$/u }), { max: 1000 });
const invalid = () => new Error('The original worker generation needs inspection before archival. Its files were preserved.');
const missing = (error: unknown) => error instanceof Error && 'code' in error && error.code === 'ENOENT';
export const sameGeneration = (a: {workerId:string;nonce:string;sourceHash:string}, b: {workerId:string;nonce:string;sourceHash:string}): boolean => a.workerId === b.workerId && a.nonce === b.nonce && a.sourceHash === b.sourceHash;

/** Read-only inventory: missing/unindexed task directories never become permission to discard a generation. */
export async function readGeneration(files: WorkerFiles) {
  await files.attach();
  const launch = generationLaunchCheck(await files.read('launch.json'));
  const ids = idsCheck(await files.read('index.json') ?? []);
  if (new Set(ids).size !== ids.length) throw invalid();
  const children = await readdir(files.directory);
  if (children.some(name => name.startsWith('build-') && !ids.includes(name))) throw invalid();
  const jobs = [];
  for (const id of ids) {
    const task = new WorkerFiles(files.path(id)); await task.attach();
    const request = workerRequestCheck(await task.read('input.json'));
    const record = workerRecordCheck(await task.read('record.json'));
    const ref = record.snapshot.ref;
    if (ref.executionId !== id || ref.workerId !== launch.workerId || ref.epoch !== launch.epoch || ref.inputHash !== inputHash(request)) throw invalid();
    jobs.push({ files: task, record, request });
  }
  return { launch, jobs };
}
export async function verifyStartupStopped(files: WorkerFiles, launch: ReturnType<typeof generationLaunchCheck>): Promise<void> {
  const raw = await files.read('launch-exit.json');
  if (raw !== undefined) { const exit = generationExitCheck(raw); if (!exit.confirmedChildExit || !sameGeneration(exit, launch)) throw invalid(); return; }
  const failure = generationSpawnFailureCheck(await files.read('launch-spawn-failure.json'));
  if (!failure.confirmedNotStarted || !sameGeneration(failure, launch) || await files.read('daemon.json') !== undefined) throw invalid();
}
export async function verifyStoppedGeneration(files: WorkerFiles, launch: ReturnType<typeof generationLaunchCheck>): Promise<void> {
  const raw = await files.read('daemon.json');
  if (raw !== undefined) {
    const daemon = shape({ pid: number({ integer: true, min: 1 }), workerId: segment, nonce: segment, instance: segment, identity: nativeIdentityCheck }, { strict: true })(raw);
    if (daemon.workerId !== launch.workerId || daemon.nonce !== launch.nonce || daemon.pid !== daemon.identity.pid || daemon.identity.platform !== process.platform) throw invalid();
    const observed = await readNativeProcessIdentity(daemon.pid);
    // A changed image on the same OS birth is ambiguous, not an absent owner.
    if (observed && observed.birth === daemon.identity.birth) throw invalid();
    return;
  }
  await verifyStartupStopped(files, launch);
}
export function verifiedUnused(record: WorkerRecord): boolean {
  const snapshot = record.snapshot;
  return !record.startIntent && !record.provider && !record.terminationUnknown && !snapshot.startedAt && !snapshot.workspaceId && !snapshot.workspaceCaptured && !snapshot.increment && !snapshot.result && !snapshot.conversation && snapshot.costUsd === undefined && !snapshot.usage;
}
async function retirement(files: WorkerFiles, workerId: string): Promise<void> {
  const generation = await readGeneration(files); if (generation.launch.workerId !== workerId) throw invalid();
  const inside = (parent: string, child: string) => { const path = relative(parent, child); return !path || path !== '..' && !path.startsWith('..' + sep) && !isAbsolute(path); };
  const unmoved = async (path: string) => {
    if (!isAbsolute(path)) throw invalid();
    const actual = await realpath(path).catch(error => { if (missing(error)) return resolve(path); throw error; });
    if (inside(files.directory, actual) || inside(actual, files.directory)) throw invalid();
  };
  for (const {record} of generation.jobs) {
    const unpaid = record.reservationReleased && verifiedUnused(record) && record.snapshot.phase === 'cancelled';
    if (!unpaid && (!durableBuildTerminal(record.snapshot.phase) || record.terminationUnknown || record.acknowledgedSequence !== record.snapshot.sequence)) throw invalid();
    const worktree = record.snapshot.increment?.worktree ?? record.snapshot.result?.increment?.worktree; if (worktree) await unmoved(worktree);
  }
  const workspaces = workflowWorkspaceRecordsCheck(await files.read('workspaces.json') ?? []);
  for (const workspace of workspaces) {
    if (workspace.activeAttemptId || workspace.phase === 'reserved') throw invalid();
    if (!generation.jobs.some(job => job.request.runId === workspace.runId && job.request.attemptId === workspace.lastAttemptId && job.record.snapshot.workspaceId === workspace.id)) {
      if (!workspace.operatorMaterializationId || workspace.lastAttemptId !== workspace.operatorMaterializationId) throw invalid();
      if (!await retainedOperatorCopy(files, workspace)) await operatorWorkspaceRecord(files, workspace);
    }
    await unmoved(workspace.cwd);
  }
  await verifyStoppedGeneration(files, generation.launch);
}
/** Read-only eligibility; a failed proof leaves the original generation unavailable and intact. */
export async function generationRetirable(files: WorkerFiles, workerId: string): Promise<boolean> {
  try { segment(workerId); await retirement(files, workerId); return true; } catch { return false; }
}
function archivePath(files: WorkerFiles, workerId: string) {
  segment(workerId);
  const source = resolve(files.directory); const name = basename(source); if (!name) throw invalid();
  const parent = join(dirname(source), name + '-archive');
  const destination = resolve(parent, workerId);
  if (!destination.startsWith(resolve(parent) + sep) || destination === source) throw invalid();
  return { source, parent, destination };
}
/** An archived generation is readable by its original identity; lookup never creates directories. */
export async function archivedFiles(files: WorkerFiles, workerId: string): Promise<WorkerFiles | undefined> {
  const path = archivePath(files, workerId);
  try {
    const parent = await lstat(path.parent); if (!parent.isDirectory() || parent.isSymbolicLink()) throw invalid();
    const archived = new WorkerFiles(path.destination); await archived.attach();
    const launch = generationLaunchCheck(await archived.read('launch.json')); if (launch.workerId !== workerId) throw invalid();
    return archived;
  } catch (error) { if (missing(error)) return undefined; throw error; }
}
/** Caller supplies explicit recovery authority; this helper independently verifies quiescence and receipts. */
export async function archiveGeneration(files: WorkerFiles, workerId: string): Promise<void> {
  const path = archivePath(files, workerId); const existing = await archivedFiles(files, workerId);
  if (existing) {
    const source = await files.read('launch.json').catch(error => { if (missing(error)) return undefined; throw error; });
    if (!source || generationLaunchCheck(source).workerId !== workerId) return;
    throw invalid();
  }
  const before = await lstat(path.source); if (!before.isDirectory() || before.isSymbolicLink()) throw invalid();
  await retirement(files, workerId);
  await mkdir(path.parent, { mode: 0o700 }).catch(error => { if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error; });
  const parent = await lstat(path.parent); if (!parent.isDirectory() || parent.isSymbolicLink()) throw invalid();
  const canonicalParent = await realpath(path.parent); const same = process.platform === 'win32' ? canonicalParent.toLowerCase() === path.parent.toLowerCase() : canonicalParent === path.parent;
  if (!same) throw invalid();
  const current = await lstat(path.source); if (current.dev !== before.dev || current.ino !== before.ino) throw invalid();
  const occupied = await lstat(path.destination).then(() => true, error => { if (missing(error)) return false; throw error; });
  if (occupied) throw invalid();
  // Both resolved absolute paths are restricted to this generation's named private parent.
  await rename(path.source, path.destination);
}
