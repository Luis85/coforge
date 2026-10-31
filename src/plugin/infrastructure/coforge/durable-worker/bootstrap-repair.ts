import type { WorkerFiles } from './files';
import { archiveGeneration, generationExitCheck, generationLaunchCheck, generationSpawnFailureCheck, readGeneration, sameGeneration, verifiedUnused, verifyStartupStopped, verifyStoppedGeneration } from './generation';
export interface BootstrapIdentity { workerId: string; nonce: string; sourceHash: string }
const refusal = () => new Error('This worker startup is not verified unused. Inspect the original execution; no files or provider were restarted.');
async function inspect(files: WorkerFiles) {
  const generation = await readGeneration(files);
  await verifyStartupStopped(files, generation.launch);
  const workspaces = await files.read('workspaces.json');
  if (workspaces !== undefined && (!Array.isArray(workspaces) || workspaces.length)) throw refusal();
  for (const {record} of generation.jobs) {
    if (!verifiedUnused(record) || !['prepared', 'cancelled'].includes(record.snapshot.phase)) throw refusal();
  }
  await verifyStoppedGeneration(files, generation.launch);
  return generation;
}
export async function bootstrapReadiness(files: WorkerFiles): Promise<{repairable:boolean;message:string}> {
  try { await inspect(files); return { repairable: true, message: 'The original Node startup is verified stopped before any Build started. Its unused startup can be archived without running a provider.' }; }
  catch { return { repairable: false, message: 'The original startup is unconfirmed or owns retained work. Inspect its execution before repair.' }; }
}
/** Called only from the actual owned ChildProcess exit event, never from PID polling or a missing heartbeat. */
export async function recordBootstrapExit(files: WorkerFiles, identity: BootstrapIdentity, code: number|null, signal: string|null): Promise<void> {
  const launch = generationLaunchCheck(await files.read('launch.json')); if (!sameGeneration(launch, identity)) throw refusal();
  const receipt = generationExitCheck({ version: 1, workerId: identity.workerId, nonce: identity.nonce, sourceHash: identity.sourceHash, confirmedChildExit: true,
    ...(code !== null ? { code } : {}), ...(signal !== null ? { signal } : {}), observedAt: new Date().toISOString() });
  const existing = await files.read('launch-exit.json');
  if (existing !== undefined) { const checked = generationExitCheck(existing); if (!sameGeneration(checked, identity) || checked.code !== receipt.code || checked.signal !== receipt.signal) throw refusal(); return; }
  await files.create('launch-exit.json', receipt);
}
/** Called only for the owned spawn error event before any spawn event and with no child PID. */
export async function recordBootstrapSpawnFailure(files: WorkerFiles, identity: BootstrapIdentity, code: string): Promise<void> {
  const launch = generationLaunchCheck(await files.read('launch.json')); if (!sameGeneration(launch, identity) || await files.read('daemon.json') !== undefined || await files.read('launch-exit.json') !== undefined) throw refusal();
  const receipt = generationSpawnFailureCheck({ version: 1, workerId: identity.workerId, nonce: identity.nonce, sourceHash: identity.sourceHash,
    confirmedNotStarted: true, code, observedAt: new Date().toISOString() });
  const existing = await files.read('launch-spawn-failure.json');
  if (existing !== undefined) { const checked = generationSpawnFailureCheck(existing); if (!sameGeneration(checked, identity) || checked.code !== receipt.code) throw refusal(); return; }
  await files.create('launch-spawn-failure.json', receipt);
}
export async function repairBootstrap(files: WorkerFiles, inspected: true): Promise<void> {
  if (inspected !== true) throw refusal();
  const generation = await inspect(files);
  for (const task of generation.jobs) {
    const record = task.record;
    if (record.snapshot.phase === 'prepared') {
      record.snapshot = { ...record.snapshot, sequence: record.snapshot.sequence + 1, phase: 'cancelled', cancellationRequested: true, error: 'Unused preparation was cancelled during explicit startup repair; no provider was launched.' };
    }
    record.reservationReleased = true; await task.files.write('record.json', record);
  }
  await archiveGeneration(files, generation.launch.workerId);
}
