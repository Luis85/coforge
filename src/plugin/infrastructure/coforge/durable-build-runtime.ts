import type { DataAdapter, Plugin } from 'obsidian';
import { realpathSync } from 'node:fs';
import { durableBuildDirectory } from './durable-build-environment';
import { createDurableBuildClient, type DurableBuildClient } from './durable-build-client';

function local(adapter: DataAdapter): adapter is DataAdapter & { getBasePath(): string } {
  return 'getBasePath' in adapter && typeof adapter.getBasePath === 'function';
}

/** Construction is read-only. Worker launch is reserved for an explicit prepared Build. */
export function durableBuildRuntime(plugin: Plugin, source: string, nodeExecutable: () => string | undefined, protectedVaultFolders: () => readonly string[] = () => ['CoForge', plugin.app.vault.configDir]): DurableBuildClient | undefined {
  const adapter = plugin.app.vault.adapter;
  if (!local(adapter)) return undefined;
  try {
    const vaultDirectory = realpathSync.native(adapter.getBasePath());
    return createDurableBuildClient({ workerSource: source, privateDirectory: durableBuildDirectory(vaultDirectory), nodeExecutable,
      vaultDirectory, protectedVaultFolders, validatePrivateDirectory: () => durableBuildDirectory(adapter.getBasePath()) });
  } catch { return undefined; }
}
