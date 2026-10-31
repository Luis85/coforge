import { lstat, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { agentGit } from '../agent-worktree';
const invalid = () => new Error('The repository and managed vault-folder boundary could not be resolved. No background provider was started.');
function inside(parent: string, child: string): boolean { const path = relative(parent, child); return path === '' || path !== '..' && !path.startsWith('..' + sep) && !isAbsolute(path); }
async function potential(path: string): Promise<string> {
  const tail: string[] = []; let current = resolve(path);
  while (true) {
    try { const actual = await realpath(current); return join(actual, ...tail); }
    catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw invalid();
      const parent = dirname(current); if (parent === current) throw invalid();
      tail.unshift(current.slice(parent.length + (parent.endsWith(sep) ? 0 : 1))); current = parent;
    }
  }
}
export function protectedPrefix(value: string): string {
  if (!value || value.length > 4096 || value.includes('\\') || value.includes(':') || isAbsolute(value) ||
    value.split('/').some(segment => !segment || segment === '.' || segment === '..' || [...segment].some(character => character.charCodeAt(0) < 32)))
    throw invalid();
  return value;
}
/** Captures the actual worktree namespace, including a vault nested under the repository or custom managed folders. */
export async function captureProjectProtection(vaultDirectory: string, projectDirectory: string, managedFolders: readonly string[]) {
  const vault = await realpath(resolve(vaultDirectory)); const configured = await realpath(resolve(projectDirectory));
  if (!(await lstat(vault)).isDirectory() || !(await lstat(configured)).isDirectory()) throw invalid();
  const projectRoot = await realpath((await agentGit(configured, ['rev-parse', '--show-toplevel'])).trim());
  const prefixes = new Set<string>();
  for (const folder of managedFolders) {
    if (!folder || (!isAbsolute(folder) && folder.split(/[\\/]/u).some(segment => segment === '..'))) throw invalid();
    const protectedDirectory = await potential(isAbsolute(folder) ? folder : resolve(vault, folder));
    if (inside(protectedDirectory, projectRoot)) throw invalid();
    if (inside(projectRoot, protectedDirectory)) prefixes.add(protectedPrefix(relative(projectRoot, protectedDirectory).split(sep).join('/')));
  }
  return { projectRoot, protectedProjectPaths: [...prefixes].sort() };
}
