import type { Plugin } from 'obsidian';
import { lstat, readdir } from 'node:fs/promises';
import { durableBuildDirectory, legacyDurableBuildDirectory } from './durable-build-environment';
import { generationLaunchCheck, generationRetirable } from './durable-worker/generation';
import { WorkerFiles } from './durable-worker/files';
import { prepareCoforgeData } from './vault-data-location';
import { transferWorkerDirectory } from './worker-data-transfer';

export interface WorkerDataLocation { directory: string; migrationPending: boolean }
async function exists(path: string): Promise<boolean> {
  try { await lstat(path); return true; }
  catch (error) { if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false; throw error; }
}
async function quiescent(directory: string): Promise<boolean> {
  try {
    const files = new WorkerFiles(directory); await files.attach();
    if (!(await readdir(files.directory)).length) return true;
    const launch = generationLaunchCheck(await files.read('launch.json'));
    return await generationRetirable(files, launch.workerId);
  } catch { return false; }
}
/** Existing generation-retirement proofs protect live Builds, process identities and retained resources. */
export async function migrateWorkerData(vault: string, legacy = legacyDurableBuildDirectory(vault)): Promise<WorkerDataLocation> {
  const directory = durableBuildDirectory(vault);
  const primary = await exists(legacy);
  const archived = await exists(legacy + '-archive');
  // A verified transfer can have committed before its original bytes were fully cleaned up.
  for (const [from, to] of [[legacy, directory], [legacy + '-archive', directory + '-archive']] as const) {
    if (!await exists(to + '.migration.json')) continue;
    if (from === legacy) {
      const proof = await exists(to) ? to : from;
      if (!await quiescent(proof)) return { directory: proof, migrationPending: true };
    }
    await transferWorkerDirectory(from, to);
  }
  if (primary && !await exists(legacy) || archived && !await exists(legacy + '-archive')) return migrateWorkerData(vault, legacy);
  if (!primary && !archived) return { directory, migrationPending: false };
  for (const [from, to] of [[legacy, directory], [legacy + '-archive', directory + '-archive']] as const) {
    if (await exists(from) && await exists(to)) throw new Error('Worker data migration found both legacy and vault journals. Preserve both; resolve the conflict before running Builds.');
  }
  if (primary) {
    const files = new WorkerFiles(legacy);
    await files.attach();
    if (!await quiescent(legacy)) return { directory: legacy, migrationPending: true };
  }
  if (archived) await new WorkerFiles(legacy + '-archive').attach();
  if (primary) await transferWorkerDirectory(legacy, directory);
  if (archived) await transferWorkerDirectory(legacy + '-archive', directory + '-archive');
  return { directory, migrationPending: false };
}
export async function prepareCoforgeWorkers(plugin: Plugin): Promise<WorkerDataLocation | undefined> {
  const adapter = plugin.app.vault.adapter;
  if (!('getBasePath' in adapter) || typeof adapter.getBasePath !== 'function') return undefined;
  await prepareCoforgeData(plugin);
  return migrateWorkerData(adapter.getBasePath());
}
