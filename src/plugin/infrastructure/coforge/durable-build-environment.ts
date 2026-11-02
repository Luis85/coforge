import { createHash } from 'node:crypto';
import { lstatSync, realpathSync, statSync } from 'node:fs';
import { homedir, hostname } from 'node:os';
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
export function durableBuildDirectory(vault: string, local?: string): string {
  const canonical = realpathSync.native(vault);
  if (!statSync(canonical).isDirectory()) throw new Error('Background execution requires a local vault folder.');
  const machine = createHash('sha256').update([hostname(), homedir(), process.platform].join('\n')).digest('hex').slice(0, 24);
  const root = local ?? join(canonical, '.coforge-data', 'runtime', 'workers', machine);
  const directory = join(prospectiveDirectory(root), createHash('sha256').update(canonical).digest('hex'));
  if (local ? contains(canonical, directory) || contains(directory, canonical) : !contains(join(canonical, '.coforge-data', 'runtime', 'workers'), directory))
    throw new Error('Background execution storage must stay in its approved private location; explicit overrides must be outside the vault.');
  return directory;
}
export function legacyDurableBuildDirectory(vault: string): string {
  return durableBuildDirectory(vault, join(homedir(), '.coforge', 'workers'));
}
