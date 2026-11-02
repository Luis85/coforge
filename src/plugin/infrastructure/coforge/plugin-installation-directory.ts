import type { Plugin } from 'obsidian';

/** Obsidian's installation path, normalized for vault adapters and literal Git rules. */
export function pluginInstallationDirectory(plugin: Plugin): string {
  return (plugin.manifest.dir ?? `${plugin.app.vault.configDir}/plugins/${plugin.manifest.id}`).replaceAll('\\', '/').replace(/\/+$/u, '');
}
