import { createHash } from 'node:crypto';
import { lstatSync, realpathSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

function prospectiveDirectory(path: string): string {
  const absolute = resolve(path); let ancestor = absolute;
  for (;;) {
    let found = true;
    try { lstatSync(ancestor); }
    catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; found = false; }
    if (found) {
      const canonical = realpathSync.native(ancestor);
      if (!statSync(canonical).isDirectory()) throw new Error('Background execution storage requires a directory.');
      return resolve(canonical, relative(ancestor, absolute));
    }
    const parent = dirname(ancestor); if (parent === ancestor) throw new Error('Background execution storage cannot be resolved.'); ancestor = parent;
  }
}
const contains = (parent: string, child: string): boolean => {
  const path = relative(parent, child); return path === '' || path !== '..' && !path.startsWith('..' + sep) && !isAbsolute(path);
};

/** Canonical vault identity avoids duplicate workers through symlink/junction aliases. No directories are created. */
export function durableBuildDirectory(vault: string, local = join(homedir(), '.coforge', 'workers')): string {
  const canonical = realpathSync.native(vault);
  if (!statSync(canonical).isDirectory()) throw new Error('Background execution requires a local vault folder.');
  const directory = join(prospectiveDirectory(local), createHash('sha256').update(canonical).digest('hex'));
  if (contains(canonical, directory) || contains(directory, canonical)) throw new Error('Background execution storage must be outside the vault.');
  return directory;
}
