import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import type { WorkflowWorkspaceLease } from '../../../features/coforge/application/workflow-workspace-ports';
import { nativePrivateRuntimeSegment, privateWorkflowSegment } from '../native-private-path';

const privateSegment = /^(?:node_modules|\.git|\.obsidian|\.coforge|\.claude|\.codex|\.agents|\.mcp\.json|\.docker|\.companion|\.ssh|\.aws|\.env(?:\..*)?|\.npmrc|\.netrc|credentials?(?:\..*)?|secrets?(?:\..*)?)$/iu;
const rootArtifact = /^(?:node_modules|reports|dist|\.nq|\.native-cache|\.native-runner|\.obsidian-sandbox(?:-.*)?|\.shell-build-.*)$/u;
const keyFile = /\.(?:pem|key|p12|pfx)$/iu;
const inside = (root: string, path: string) => { const child = relative(root, path); return child === '' || child !== '..' && !child.startsWith('..' + sep) && !isAbsolute(child); };
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
export interface VerificationSource { sourceHash: string; files: number; bytes: number; excluded: number }

export function protectedVerificationPath(path: string, prefixes: readonly string[]): boolean {
  const value = process.platform === 'win32' ? path.toLowerCase() : path;
  return path.split('/').some(part => privateWorkflowSegment(part) || privateSegment.test(part) || keyFile.test(part)) || prefixes.some(prefix => {
    const name = process.platform === 'win32' ? prefix.toLowerCase() : prefix;
    return value === name || value.startsWith(name + '/');
  });
}

interface TreeOptions { destination?: string; protectedPaths: readonly string[]; signal?: AbortSignal }
async function tree(directory: string, options: TreeOptions): Promise<VerificationSource> {
  const root = resolve(directory);
  if (root.split(sep).some(nativePrivateRuntimeSegment)) throw new Error('Private native runtimes cannot be verification source.');
  if ((await lstat(root)).isSymbolicLink() || await realpath(root) !== root) throw new Error('Verification source must be a canonical local directory.');
  const manifest: string[] = [];
  let files = 0; let bytes = 0; let excluded = 0;
  const maxFiles = 50000;
  const maxBytes = 256 * 1024 ** 2;
  const walk = async (folder: string, depth: number): Promise<void> => {
    options.signal?.throwIfAborted();
    if (depth > 40) throw new Error('Verification source exceeds the supported directory depth.');
    for (const entry of (await readdir(folder, { withFileTypes: true })).sort((left, right) => left.name.localeCompare(right.name, 'en'))) {
      options.signal?.throwIfAborted();
      const path = join(folder, entry.name); const name = relative(root, path).split(sep).join('/');
      if (protectedVerificationPath(name, options.protectedPaths) || depth === 0 && rootArtifact.test(entry.name)) { excluded++; continue; }
      const info = await lstat(path);
      if (info.isSymbolicLink()) {
        excluded++; continue;
      }
      if (await realpath(path) !== path || !inside(root, path)) throw new Error('Verification source identity changed.');
      if (info.isDirectory()) { await walk(path, depth + 1); continue; }
      if (!info.isFile() || info.nlink !== 1) { excluded++; continue; }
      if (++files > maxFiles || (bytes += info.size) > maxBytes || info.size > 128 * 1024 ** 2) throw new Error('Verification source exceeds its file or byte limit. No partial snapshot was executed.');
      const data = await readFile(path);
      const after = await lstat(path);
      if (after.isSymbolicLink() || after.dev !== info.dev || after.ino !== info.ino || after.size !== data.length || after.mtimeMs !== info.mtimeMs || after.nlink !== 1) throw new Error('Verification source changed while capturing its bytes.');
      manifest.push(`${name}\0${data.length}\0${info.mode & 0o111}\0${hash(data)}`);
      if (options.destination) { const output = join(options.destination, name); await mkdir(resolve(output, '..'), { recursive: true }); await writeFile(output, data, { flag: 'wx', mode: 0o444 | info.mode & 0o111 }); }
    }
  };
  await walk(root, 0);
  return { sourceHash: hash(manifest.join('\n')), files, bytes, excluded };
}

/** A private copy, never the live repository, is mounted in the container. */
export async function captureVerificationSource(lease: WorkflowWorkspaceLease, destination?: string, signal?: AbortSignal): Promise<VerificationSource> {
  await lease.validate?.();
  const protectedPaths = [...(lease.protectedProjectPaths ?? [])];
  const result = await tree(lease.cwd, { destination, protectedPaths, signal });
  await lease.validate?.();
  // A new managed folder can make a previous copy incomplete. Refuse rather than expose it.
  if ((lease.protectedProjectPaths ?? []).some(path => !protectedPaths.includes(path))) throw new Error('The private source boundary changed. Capture a new verification snapshot.');
  return result;
}

export const verificationSourceIdentity = (sourceHash: string, imageId: string) => hash(`${sourceHash}\0${imageId}`);
