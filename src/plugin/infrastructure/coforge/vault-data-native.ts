import { lstat, realpath } from 'node:fs/promises';
import { join } from 'node:path';

/** The desktop data root cannot redirect vault-owned data through links or shared file identities. */
export async function assertNativeVaultData(vault: string, paths: readonly string[]): Promise<void> {
  const root = await realpath(vault);
  const checked = new Set<string>();
  for (const path of paths) {
    if (!path || path.includes('\\') || path.includes(':') || path.split('/').some(part => !part || part === '.' || part === '..'))
      throw new Error('CoForge data migration requires vault-relative storage paths.');
    let current = root;
    const parts = path.split('/');
    for (const [index, part] of parts.entries()) {
      current = join(current, part);
      if (checked.has(current)) continue;
      try {
        const info = await lstat(current);
        if (info.isSymbolicLink() || !info.isDirectory() && (!info.isFile() || info.nlink !== 1 || index !== parts.length - 1))
          throw new Error('CoForge data migration cannot use linked or invalid storage entries. Existing data was preserved.');
        checked.add(current);
      } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') break;
        throw error;
      }
    }
  }
}
