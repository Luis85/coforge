import { lstat, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { record } from '../../features/coforge/domain/check';

export interface McpRegistrationEntry { command: string; args: string[] }
const same = (left: unknown, right: unknown) => {
  if (!left || typeof left !== 'object' || Array.isArray(left)) return false;
  const item = record(left);
  const expected = record(right);
  return Object.keys(item).sort().join(',') === Object.keys(expected).sort().join(',') && item.command === expected.command && JSON.stringify(item.args) === JSON.stringify(expected.args);
};
async function contents(path: string): Promise<string | null> {
  try {
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || info.size > 8 * 1024 * 1024) throw new Error('MCP settings must be a regular JSON file of at most 8 MiB.');
    return await readFile(path, 'utf8');
  } catch (error) { if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null; throw error; }
}
interface Change { path: string; before: string | null; after: string }
/** Preflights both scopes; compare-before-write plus rollback protects unrelated client configuration. */
export class McpRegistration {
  install(paths: string[], name: string, entry: McpRegistrationEntry): Promise<void> { return this.update(paths, name, entry, false); }
  remove(paths: string[], name: string, entry: McpRegistrationEntry): Promise<void> { return this.update(paths, name, entry, true); }
  private async replace(path: string, before: string | null, after: string): Promise<void> {
    const temporary = `${path}.coforge-${crypto.randomUUID()}.tmp`;
    try {
      await writeFile(temporary, after, { flag: 'wx', mode: 0o600 });
      if (await contents(path) !== before) throw new Error('MCP settings changed during registration. Retry after reviewing the files.');
      if (before === null) await writeFile(path, after, { flag: 'wx', mode: 0o600 });
      else await rename(temporary, path);
    } finally { await unlink(temporary).catch(() => undefined); }
  }
  private async update(paths: string[], name: string, entry: McpRegistrationEntry, remove: boolean): Promise<void> {
    const locks: string[] = [];
    const written: Change[] = [];
    try {
      for (const path of [...new Set(paths)].sort()) {
        const lock = path + '.coforge-lock';
        await writeFile(lock, 'CoForge configuration update in progress.\n', { flag: 'wx', mode: 0o600 }); locks.push(lock);
      }
      const changes: Change[] = [];
      for (const path of paths) {
        const before = await contents(path);
        const data = before === null ? {} : record(JSON.parse(before));
        const servers = data.mcpServers === undefined ? {} : record(data.mcpServers);
        const previous = servers[name];
        if (previous !== undefined && !same(previous, entry)) throw new Error('An existing MCP registration uses this name. Its configuration was preserved; resolve the conflict before retrying.');
        if (remove && previous === undefined || !remove && same(previous, entry)) continue;
        if (remove) delete servers[name]; else servers[name] = entry;
        data.mcpServers = servers;
        const eol = before?.includes('\r\n') ? '\r\n' : '\n';
        changes.push({ path, before, after: JSON.stringify(data, null, 2).replace(/\n/g, eol) + eol });
      }
      for (const change of changes) { await this.replace(change.path, change.before, change.after); written.push(change); }
    } catch {
      let recovered = true;
      for (const change of written.reverse()) {
        try {
          if (await contents(change.path) !== change.after) { recovered = false; continue; }
          if (change.before === null) await unlink(change.path);
          else await this.replace(change.path, change.after, change.before);
        } catch { recovered = false; }
      }
      throw new Error(recovered ? 'MCP settings could not be updated. Previous configuration was preserved. Check both JSON files for malformed data, a conflicting server name or an unfinished .coforge-lock before retrying.' : 'MCP registration needs recovery. One settings file changed during the update; inspect both scopes before retrying. CoForge did not overwrite the external edit.');
    } finally { for (const path of locks) await unlink(path).catch(() => undefined); }
  }
}
