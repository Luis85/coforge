import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, readdir, realpath } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { agentGit } from '../agent-worktree';
import { workflowRepositoryFilePath, workflowRepositoryPathDenied } from '../mcp-step-files';
import { inputHash } from '../durable-worker/protocol';
import { ProcessFailure } from '../process';

export const SNAPSHOT_FILE_LIMIT = 64 * 1024 * 1024;
export const SNAPSHOT_TOTAL_LIMIT = 512 * 1024 * 1024;
export const SNAPSHOT_PATH_LIMIT = 10000;
export const CAPTURE_SCOPE = 'coforge-source-code/v1' as const;
export interface SnapshotExclusion { path: string; reason: 'git-ignored-agent-denied-directory' | 'git-ignored-agent-denied-link' }
export interface SnapshotFile { path: string; mode: '100644' | '100755'; hash: string; size: number; gitHash: string }
export interface SnapshotChange { path: string; mode: '100644' | '100755'; kind: 'file' | 'deleted'; hash?: string; size: number }
export const invalidSnapshot = () => new Error('The reviewed source changed or contains unsupported files. Inspect its original work before retrying.');
const inside = (root: string, path: string) => { const value = relative(root, path); return value && value !== '..' && !value.startsWith('..' + sep) && !isAbsolute(value); };
export async function snapshotFile(root: string, path: string): Promise<Buffer> {
  if (!path || path.includes('\\') || path.includes(':') || path.split('/').some(part => !part || part === '.' || part === '..')) throw invalidSnapshot();
  let current = root;
  for (const part of path.split('/')) {
    current = join(current, part); const info = await lstat(current);
    if (info.isSymbolicLink() || !inside(root, await realpath(current)) || !info.isDirectory() && (!info.isFile() || info.nlink !== 1)) throw invalidSnapshot();
  }
  const before = await lstat(current);
  if (!before.isFile() || before.nlink !== 1 || before.size > SNAPSHOT_FILE_LIMIT) throw invalidSnapshot();
  const handle = await open(current, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const opened = await handle.stat(); if (!opened.isFile() || opened.nlink !== 1 || opened.dev !== before.dev || opened.ino !== before.ino) throw invalidSnapshot();
    const data = await handle.readFile(); const after = await handle.stat(); const named = await lstat(current);
    if (data.length > SNAPSHOT_FILE_LIMIT || before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs ||
      named.dev !== after.dev || named.ino !== after.ino || named.isSymbolicLink() || named.nlink !== 1) throw invalidSnapshot();
    return data;
  } finally { await handle.close(); }
}
async function baseFiles(root: string, commit: string) {
  const records = (await agentGit(root, ['ls-tree', '-rz', '--full-tree', commit])).split('\0').filter(Boolean);
  const files = new Map<string, { mode: '100644' | '100755'; hash: string }>();
  for (const entry of records) {
    const match = /^(100644|100755) blob ([a-f0-9]{40,64})\t(.+)$/u.exec(entry);
    if (!match || match[3]!.includes('\ufffd')) throw invalidSnapshot();
    files.set(match[3]!, { mode: match[1] === '100755' ? '100755' : '100644', hash: match[2]! });
  }
  if (files.size > SNAPSHOT_PATH_LIMIT) throw invalidSnapshot(); return files;
}
async function indexModes(root: string) {
  const modes = new Map<string, '100644' | '100755'>();
  for (const entry of (await agentGit(root, ['ls-files', '--stage', '-z'])).split('\0').filter(Boolean)) {
    const match = /^(100644|100755) [a-f0-9]{40,64} 0\t(.+)$/u.exec(entry); if (!match) throw invalidSnapshot();
    modes.set(match[2]!, match[1] === '100755' ? '100755' : '100644');
  }
  return modes;
}
async function ignoredPaths(root: string, paths: string[]): Promise<Set<string>> {
  const ignored = new Set<string>(); let chunk: string[] = []; let length = 0;
  const inspect = async () => {
    if (!chunk.length) return;
    try { for (const path of (await agentGit(root, ['check-ignore', '--no-index', '-z', '--stdin'], undefined, 2 * 1024 * 1024, chunk.join('\0') + '\0')).split('\0').filter(Boolean)) ignored.add(path); }
    catch (error) { if (!(error instanceof ProcessFailure && error.message.startsWith('git exited with code 1.'))) throw error; }
    chunk = []; length = 0;
  };
  for (const path of paths) { if (length + path.length > 12000) await inspect(); chunk.push(path); length += path.length + 3; }
  await inspect(); return ignored;
}
/** Hashes actual regular files, including ignored untracked files for retained workspace sources. */
export async function snapshotTree(root: string, commit: string, repositoryOnly = false) {
  const base = await baseFiles(root, commit); const modes = await indexModes(root);
  for (const flag of (await agentGit(root, ['ls-files', '-v', '-z'])).split('\0').filter(Boolean))
    if (/^[a-zS]/u.test(flag)) throw new Error('Unsupported hidden Git index flags must be cleared before reviewing a snapshot.');
  // Git identifies logical modifications after checkout/EOL conversion. Raw byte hashes separately enforce exact copy equality.
  const changed = new Set((await agentGit(root, ['diff', '--no-ext-diff', '--no-textconv', '--no-renames', '--name-only', '-z', commit, '--'])).split('\0').filter(Boolean));
  const tracked = [...new Set([...base.keys(), ...modes.keys()])]; const excludedPaths: SnapshotExclusion[] = [];
  const trackedBelow = (path: string) => tracked.some(file => process.platform === 'win32' ? file.toLowerCase().startsWith(path.toLowerCase() + '/') : file.startsWith(path + '/'));
  const paths: string[] = [];
  const walk = async (directory: string, prefix: string, depth: number): Promise<void> => {
    if (depth > 40) throw invalidSnapshot();
    const entries = await readdir(directory, { withFileTypes: true });
    const prunable = entries.filter(entry => (entry.isDirectory() || entry.isSymbolicLink()) && entry.name !== '.git').map(entry => prefix ? prefix + '/' + entry.name : entry.name)
      .filter(path => workflowRepositoryPathDenied(path) && !trackedBelow(path) && !tracked.includes(path));
    const ignored = await ignoredPaths(root, prunable);
    for (const entry of entries) {
      if (!prefix && entry.name === '.git') continue;
      const path = prefix ? prefix + '/' + entry.name : entry.name; const actual = join(directory, entry.name);
      if (ignored.has(path)) { excludedPaths.push({ path, reason: entry.isSymbolicLink() ? 'git-ignored-agent-denied-link' : 'git-ignored-agent-denied-directory' }); continue; }
      if (entry.isSymbolicLink()) throw invalidSnapshot();
      if (entry.isDirectory()) await walk(actual, path, depth + 1);
      else { if (!entry.isFile()) throw invalidSnapshot(); paths.push(path); }
      if (paths.length > SNAPSHOT_PATH_LIMIT) throw invalidSnapshot();
    }
  };
  if (repositoryOnly) paths.push(...base.keys()); else await walk(root, '', 0);
  paths.sort(); const seen = new Set<string>(); const files: SnapshotFile[] = []; let bytes = 0;
  for (const path of paths) {
    const key = process.platform === 'win32' ? path.toLowerCase() : path;
    if (seen.has(key)) throw invalidSnapshot(); seen.add(key);
    if (process.platform === 'win32' && !base.has(path) && [...base.keys()].some(name => name.toLowerCase() === key)) throw invalidSnapshot();
    const data = await snapshotFile(root, path); bytes += data.length; if (bytes > SNAPSHOT_TOTAL_LIMIT) throw invalidSnapshot();
    const info = await lstat(resolve(root, path));
    const mode = process.platform === 'win32' ? modes.get(path) ?? base.get(path)?.mode ?? '100644' : info.mode & 0o111 ? '100755' : '100644';
    files.push({ path, mode, size: data.length, hash: createHash('sha256').update(data).digest('hex'),
      gitHash: createHash(commit.length === 64 ? 'sha256' : 'sha1').update('blob ' + data.length + '\0').update(data).digest('hex') });
  }
  const changes: SnapshotChange[] = [];
  for (const file of files) {
    const prior = base.get(file.path); if (!prior || changed.has(file.path) || prior.mode !== file.mode) changes.push({ path: file.path, mode: file.mode, kind: 'file', hash: file.hash, size: file.size });
  }
  for (const [path, file] of base) if (!files.some(item => item.path === path)) changes.push({ path, mode: file.mode, kind: 'deleted', size: 0 });
  changes.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  return { files, changes, captureScope: CAPTURE_SCOPE, excludedPaths: excludedPaths.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0),
    treeHash: inputHash({ captureScope: CAPTURE_SCOPE, files: files.map(({ path, mode, hash, size }) => ({ path, mode, hash, size })) }), bytes };
}
export function checkSnapshotPaths(changes: readonly SnapshotChange[], protectedPaths: readonly string[]): void {
  for (const entry of changes) {
    workflowRepositoryFilePath(entry.path);
    const path = process.platform === 'win32' ? entry.path.toLowerCase() : entry.path;
    if (protectedPaths.some(prefix => { const value = process.platform === 'win32' ? prefix.toLowerCase() : prefix; return path === value || path.startsWith(value + '/'); }))
      throw new Error('A reviewed change touches protected managed files. No snapshot can be imported.');
  }
}
