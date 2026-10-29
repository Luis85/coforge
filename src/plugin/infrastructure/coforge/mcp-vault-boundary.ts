import { lstat, realpath } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { McpToolError } from './mcp-errors';

const deny = () => new McpToolError('PERMISSION_DENIED', 'Use a non-hidden Markdown path inside the current CoForge vault; links, credentials and metadata are excluded.');
export function vaultPathParts(path: string): string[] {
  if (!path || path.length > 1000 || isAbsolute(path) || /[\\:\p{Cc}]/u.test(path)) throw deny();
  const parts = path.split('/');
  if (parts.some(part => !part || part.startsWith('.') || part.trim() !== part || part.endsWith('.') ||
    /^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/iu.test(part) || /^(?:credentials?|secrets?)(?:\.|$)/iu.test(part))) throw deny();
  return parts;
}
export async function vaultRoot(path: string): Promise<string> {
  if (!isAbsolute(path)) throw deny();
  const expected = resolve(path);
  const info = await lstat(expected);
  const actual = await realpath(expected);
  if (!info.isDirectory() || info.isSymbolicLink() || !sameVaultPath(expected, actual)) throw deny();
  return actual;
}
export function sameVaultPath(a: string, b: string): boolean {
  return process.platform === 'win32' ? resolve(a).toLowerCase() === resolve(b).toLowerCase() : resolve(a) === resolve(b);
}
export async function boundedVaultPath(root: string, path: string, missing = false): Promise<void> {
  let current = root;
  for (const part of vaultPathParts(path)) {
    current = join(current, part);
    try {
      const info = await lstat(current);
      if (info.isSymbolicLink() || !info.isDirectory() && (!info.isFile() || info.nlink !== 1)) throw deny();
      const actual = await realpath(current);
      const child = relative(root, actual);
      if (child === '..' || child.startsWith('..' + sep) || isAbsolute(child) || !sameVaultPath(current, actual)) throw deny();
    } catch (error) {
      if (!missing || !(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
    }
  }
}
