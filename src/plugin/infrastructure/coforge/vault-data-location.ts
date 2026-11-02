import type { DataAdapter, Plugin } from 'obsidian';
import { protectPrivateData } from './private-data-guard';
import { assertNativeVaultData } from './vault-data-native';
import { pluginInstallationDirectory as legacyPluginDirectory } from './plugin-installation-directory';
export { pluginInstallationDirectory as legacyPluginDirectory } from './plugin-installation-directory';

export const COFORGE_DATA = '.coforge-data';
export const DATA_GROUPS = ['studio', 'council', 'economy/reservations', 'automation', 'integrations/herdr', 'integrations/mcp', 'alerts', 'publication', 'settings', 'streams', 'recovery', 'exports', 'runtime'] as const;
const locations: Readonly<Record<string, string>> = {
  'state': 'studio', 'command-commit': 'studio', 'example-cleanup': 'studio', 'request-deletion': 'studio',
  'council-settings': 'council', 'council-intake': 'council', 'council-idea-links': 'council', 'execution-v2': 'council',
  'task-scheduler': 'automation', 'workflow-triggers': 'automation', 'workspaces': 'automation',
  'herdr': 'integrations/herdr', 'herdr-workflow': 'integrations/herdr',
  'mcp-settings': 'integrations/mcp', 'mcp-connection': 'integrations/mcp', 'mcp-commands': 'integrations/mcp',
  'alerts': 'alerts', 'alerts-endpoint': 'alerts', 'public-exports': 'publication', 'service-design': 'settings',
};
export function coforgeDataPath(name: string): string {
  const match = /^coforge-(.+)\.json(?:\.(?:bak|tmp))?$/u.exec(name);
  const group = match && Object.hasOwn(locations, match[1]!) ? locations[match[1]!] : undefined;
  if (group) return `${COFORGE_DATA}/${group}/${name}`;
  if (/^coforge-(?:export|backup|diagnostics)-[a-zA-Z0-9.-]+\.json$/u.test(name)) return `${COFORGE_DATA}/exports/${name}`;
  if (name === 'coforge-mcp-bridge.cjs') return `${COFORGE_DATA}/integrations/mcp/${name}`;
  throw new Error('Unknown CoForge private data file. Preserve the existing files and check that the installed CoForge version supports this data.');
}
export async function ensureDataFolder(adapter: Pick<DataAdapter, 'exists' | 'mkdir' | 'stat'>, path: string): Promise<void> {
  let current = '';
  for (const segment of path.split('/')) {
    current = current ? `${current}/${segment}` : segment;
    if (!await adapter.exists(current)) await adapter.mkdir(current);
    if ((await adapter.stat(current))?.type !== 'folder') throw new Error('CoForge data migration requires regular private folders. Existing files were preserved.');
  }
}
async function protect(adapter: DataAdapter): Promise<void> {
  await ensureDataFolder(adapter, COFORGE_DATA);
  const path = `${COFORGE_DATA}/.gitignore`;
  const before = await adapter.exists(path) ? await adapter.read(path) : '';
  const marker = '# CoForge private data (including machine-bound workers)';
  if (!before.includes(marker)) await adapter.write(path, `${before}${before && !before.endsWith('\n') ? '\n' : ''}${marker}\n*\n`);
}
interface Move { from: string; to: string }
async function tree(adapter: DataAdapter, from: string, to: string, nativeRoot?: string): Promise<Move[]> {
  if (!await adapter.exists(from)) return [];
  if (nativeRoot) await assertNativeVaultData(nativeRoot, [from]);
  if ((await adapter.stat(from))?.type !== 'folder') throw new Error('CoForge data migration found an invalid legacy folder. Preserve it before recovery.');
  const entries = await adapter.list(from);
  const moves = entries.files.map(path => ({ from: path, to: to + path.slice(from.length) }));
  for (const folder of entries.folders) moves.push(...await tree(adapter, folder, to + folder.slice(from.length), nativeRoot));
  return moves;
}
async function removeEmptyTree(adapter: DataAdapter, path: string): Promise<void> {
  if (!await adapter.exists(path)) return;
  for (const folder of (await adapter.list(path)).folders) await removeEmptyTree(adapter, folder);
  const remaining = await adapter.list(path);
  if (!remaining.files.length && !remaining.folders.length) await adapter.rmdir(path, false);
}
async function cleanLegacyDirectory(adapter: DataAdapter, directory: string): Promise<void> {
  for (const name of ['coforge-economy-reservations', 'mcp-command-ledger']) await removeEmptyTree(adapter, `${directory}/${name}`);
  const ignore = `${directory}/.gitignore`;
  if (!await adapter.exists(ignore)) return;
  const generated = new Set(['', '# CoForge managed private data', '# End CoForge managed private data', 'coforge-*.json',
    'coforge-*.json*', 'coforge-alerts*.json*', 'coforge-economy-reservations/', 'data.json', '*.log']);
  const content = await adapter.read(ignore);
  const lines = content.replace(/[\r\n]+$/u, '').split(/\r?\n/u);
  if (lines[0] === '# CoForge managed private data' && lines.at(-1) === '# End CoForge managed private data'
    && lines.filter(line => line === '# CoForge managed private data').length === 1
    && lines.filter(line => line === '# End CoForge managed private data').length === 1
    && lines.every(line => generated.has(line))) await adapter.remove(ignore);
}
const legacyDataFile = (path: string) => /^coforge-.*\.(?:json(?:\.(?:bak|tmp))?|cjs)$/u.test(path.slice(path.lastIndexOf('/') + 1));
/** An unloading older version must not silently fork the migrated ledger after readiness was cached. */
async function assertNoLegacyWriters(plugin: Plugin): Promise<void> {
  const adapter = plugin.app.vault.adapter, legacy = legacyPluginDirectory(plugin);
  const failure = () => new Error('Legacy CoForge data reappeared after migration. Preserve both locations, finish unloading the older plugin and resolve conflicting records before reloading.');
  if (await adapter.exists(legacy) && (await adapter.list(legacy)).files.some(legacyDataFile)) throw failure();
  for (const name of ['coforge-economy-reservations', 'mcp-command-ledger'])
    if (await adapter.exists(`${legacy}/${name}`)) throw failure();
  if (await adapter.exists('CoForge/Streams') && (await adapter.list('CoForge/Streams')).files.some(path => /\.json(?:\.(?:bak|tmp))?$/u.test(path))) throw failure();
}
/** Preflight the entire move, then rename exact bytes. Interrupted moves resume without overwriting generations. */
export async function prepareCoforgeData(plugin: Plugin): Promise<void> {
  const adapter = plugin.app.vault.adapter;
  const nativeRoot = 'getBasePath' in adapter && typeof adapter.getBasePath === 'function' ? adapter.getBasePath() : undefined;
  if (typeof nativeRoot === 'string') await assertNativeVaultData(nativeRoot, DATA_GROUPS.map(group => `${COFORGE_DATA}/${group}`));
  await protectPrivateData(plugin);
  await protect(adapter);
  const legacy = legacyPluginDirectory(plugin);
  const moves: Move[] = [];
  const collect = (from: string, to: string) => tree(adapter, from, to, typeof nativeRoot === 'string' ? nativeRoot : undefined);
  if (await adapter.exists(legacy)) {
    for (const path of (await adapter.list(legacy)).files) {
      const name = path.slice(legacy.length + 1);
      if (!legacyDataFile(name)) continue;
      moves.push({ from: path, to: coforgeDataPath(name) });
    }
    moves.push(...await collect(`${legacy}/coforge-economy-reservations`, `${COFORGE_DATA}/economy/reservations`));
    moves.push(...await collect(`${legacy}/mcp-command-ledger`, `${COFORGE_DATA}/integrations/mcp/mcp-command-ledger`));
  }
  moves.push(...(await collect('CoForge/Streams', `${COFORGE_DATA}/streams`)).filter(move => /\.json(?:\.(?:bak|tmp))?$/u.test(move.from)));
  moves.push(...(await collect('CoForge/Recovery', `${COFORGE_DATA}/recovery`)).filter(move => /(?:\/receipt\.json|\/request\.coforge-recovery)$/u.test(move.from)));
  if (typeof nativeRoot === 'string') await assertNativeVaultData(nativeRoot, moves.flatMap(move => [move.from, move.to]));
  for (const move of moves) {
    if ((await adapter.stat(move.from))?.type !== 'file' || await adapter.exists(move.to))
      throw new Error('CoForge data migration found conflicting or invalid files. Preserve both locations and resolve the conflict before reloading; no records were overwritten.');
  }
  for (const group of DATA_GROUPS) await ensureDataFolder(adapter, `${COFORGE_DATA}/${group}`);
  for (const move of moves) {
    await ensureDataFolder(adapter, move.to.slice(0, move.to.lastIndexOf('/')));
    // Recheck after preflight so an interrupted/retried migration cannot replace another writer.
    if (await adapter.exists(move.to)) throw new Error('CoForge data migration destination changed. Both records were preserved.');
    await adapter.rename(move.from, move.to);
  }
  await cleanLegacyDirectory(adapter, legacy);
}
/** Instance-owned readiness; failed preparation is retryable and never admits a data writer. */
export class CoforgeDataDirectory {
  private prepared?: Promise<void>;
  constructor(private readonly plugin: () => Plugin) {}
  prepare(): Promise<void> {
    const plugin = this.plugin();
    const ready = this.prepared ??= prepareCoforgeData(plugin).catch(error => { this.prepared = undefined; throw error; });
    return ready.then(() => assertNoLegacyWriters(plugin));
  }
}
