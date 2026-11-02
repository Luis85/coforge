import type { DataAdapter, Plugin } from 'obsidian';
import { realpathSync } from 'node:fs';
import { durableBuildDirectory, legacyDurableBuildDirectory } from './durable-build-environment';
import { createDurableBuildClient, type DurableBuildClient } from './durable-build-client';
import type { WorkerDataLocation } from './worker-data-migration';

function local(adapter: DataAdapter): adapter is DataAdapter & { getBasePath(): string } {
  return 'getBasePath' in adapter && typeof adapter.getBasePath === 'function';
}

/** Construction is read-only. Worker launch is reserved for an explicit prepared Build. */
export function durableBuildRuntime(plugin: Plugin, source: string, nodeExecutable: () => string | undefined, protectedVaultFolders: () => readonly string[] = () => ['CoForge', plugin.app.vault.configDir], location?: WorkerDataLocation): DurableBuildClient | undefined {
  const adapter = plugin.app.vault.adapter;
  if (!local(adapter)) return undefined;
  try {
    const vaultDirectory = realpathSync.native(adapter.getBasePath());
    const privateDirectory = location?.directory ?? durableBuildDirectory(vaultDirectory);
    const legacy = privateDirectory === legacyDurableBuildDirectory(vaultDirectory);
    return createDurableBuildClient({ workerSource: source, privateDirectory, nodeExecutable,
      migrationPending: location?.migrationPending,
      vaultDirectory, protectedVaultFolders, validatePrivateDirectory: () => legacy ? legacyDurableBuildDirectory(adapter.getBasePath()) : durableBuildDirectory(adapter.getBasePath()) });
  } catch { return undefined; }
}
