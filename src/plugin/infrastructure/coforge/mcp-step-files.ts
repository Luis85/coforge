import { lstat, mkdir, readFile, readdir, realpath, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import type { StageInput } from '../../features/coforge/application/ports';
import type { WorkflowWorkspaceLease } from '../../features/coforge/application/workflow-workspace-ports';
import { executionAccess } from '../../features/coforge/application/workflow-execution';
import { text, shape, optional, nullable } from '../../features/coforge/domain/check';
import { protectedPrefix } from './durable-worker/protection';
import { nativePrivateRuntimeSegment, privateWorkflowSegment } from './native-private-path';

const MAX = 200000;
const narrowingHint = 'Results are incomplete. Retry with a narrower repository-relative path; list_files query filters file paths before the result limit.';
const incomplete = { truncated: true, narrowingHint };
const denied = (segment: string): boolean => privateWorkflowSegment(segment) || /^(?:\.git|\.claude|\.codex|\.coforge|\.coforge-run-output|\.agents|\.mcp\.json|\.obsidian|node_modules|\.env(?:\..*)?|\.ssh|\.aws|\.npmrc|\.netrc|credentials?(?:\..*)?|secrets?(?:\..*)?)$/iu.test(segment) || /\.(?:pem|key|p12|pfx)$/iu.test(segment);
const ambiguous = (segment: string): boolean => segment.trimEnd() !== segment || segment.endsWith('.') || [...segment].some(character => character.charCodeAt(0) < 32)
  || /^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/iu.test(segment);
function parts(path: string): string[] {
  if (path.length > 1000 || path.includes('\\') || path.includes(':') || path.includes('\0') || isAbsolute(path)) throw new Error('Use a repository-relative path.');
  const segments = path ? path.split('/') : [];
  if (segments.some(segment => !segment || segment === '.' || segment === '..' || denied(segment) || ambiguous(segment))) throw new Error('This repository path is not permitted.');
  return segments;
}
/** Shared relative-file boundary for trusted reviewed imports; never grants model write access. */
export function workflowRepositoryFilePath(path: string): string { return parts(path).join('/'); }
export const workflowRepositoryPathDenied = (path: string): boolean => path.split('/').some(denied);
async function bounded(root: string, path: string, missing = false): Promise<string> {
  const segments = parts(path);
  let current = root;
  for (const segment of segments) {
    current = join(current, segment);
    try {
      const info = await lstat(current);
      if (info.isSymbolicLink() || (!info.isDirectory() && (!info.isFile() || info.nlink !== 1))) throw new Error('Linked or non-file repository paths are not permitted.');
      const actual = await realpath(current);
      const child = relative(root, actual);
      if (child.startsWith('..' + sep) || child === '..' || isAbsolute(child)) throw new Error('Repository boundary changed.');
      if (child.split(sep).some(denied) || process.platform === 'win32' && child.toLowerCase() !== relative(root, current).toLowerCase()) throw new Error('Aliased or protected repository paths are not permitted.');
    } catch (error) {
      if (!missing || !(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
    }
  }
  return current;
}
async function read(path: string): Promise<string> {
  const info = await lstat(path);
  if (!info.isFile() || info.size > MAX || info.nlink !== 1 || info.isSymbolicLink()) throw new Error('Read requires a regular UTF-8 file of at most 200000 bytes.');
  const data = await readFile(path);
  if (data.length > MAX || data.includes(0)) throw new Error('File is too large or binary.');
  const content = data.toString('utf8');
  if (!Buffer.from(content).equals(data)) throw new Error('File is not UTF-8.');
  return content;
}
type Task = { input: StageInput; lease: WorkflowWorkspaceLease };
/** No arbitrary absolute paths, shell, Git operations, metadata or credential files. */
export class McpStepFiles {
  private pending: Promise<unknown> = Promise.resolve();
  private readonly protectedPaths: readonly string[];
  constructor(protectedPaths: readonly string[] = []) { this.protectedPaths = protectedPaths.map(protectedPrefix); }
  private protected(path: string): boolean {
    const value = process.platform === 'win32' ? path.toLowerCase() : path;
    return this.protectedPaths.some(prefix => { const folder = process.platform === 'win32' ? prefix.toLowerCase() : prefix; return value === folder || value.startsWith(folder + '/'); });
  }
  private async bound(root: string, path: string, missing = false): Promise<string> {
    if (this.protected(parts(path).join('/'))) throw new Error('Managed vault notes and public outputs are outside this task’s repository authority.');
    return bounded(root, path, missing);
  }
  call(name: string, task: Task, raw: unknown): Promise<unknown> {
    const next = this.pending.then(async () => {
      const scoped = task.lease.protectedProjectPaths?.length ? new McpStepFiles([...this.protectedPaths, ...task.lease.protectedProjectPaths]) : this;
      const result = await scoped.execute(name, task, raw);
      if (task.lease.readOnly) { task.input.signal?.throwIfAborted(); await task.lease.validate?.(); }
      return result;
    });
    this.pending = next.catch(() => undefined); return next;
  }
  private async list(root: string, path: string, query = ''): Promise<{ files: string[]; truncated: boolean; narrowingHint?: string }> {
    const start = await this.bound(root, path);
    const files: string[] = [];
    let scanned = 0;
    let truncated = false;
    const walk = async (directory: string, depth: number): Promise<void> => {
      if (depth > 20) { truncated = true; return; }
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (++scanned > 4000 || files.length >= 1000) { truncated = true; return; }
        if (denied(entry.name) || ambiguous(entry.name) || entry.isSymbolicLink()) continue;
        const path = join(directory, entry.name);
        if (this.protected(relative(root, path).split(sep).join('/'))) continue;
        if (entry.isDirectory()) await walk(path, depth + 1);
        else if (entry.isFile() && (await lstat(path)).nlink === 1) {
          const name = relative(root, path).split(sep).join('/');
          if (name.toLowerCase().includes(query.toLowerCase())) files.push(name);
        }
      }
    };
    await walk(start, 0);
    return { files: files.sort(), truncated, ...(truncated ? { narrowingHint } : {}) };
  }
  private async execute(name: string, task: Task, raw: unknown): Promise<unknown> {
    const access = executionAccess(task.input);
    if (task.input.signal?.aborted || access === 'none') throw new Error('This task has no repository access.');
    await task.lease.validate?.();
    const rootInfo = await lstat(task.lease.cwd);
    if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) throw new Error('The task repository identity changed.');
    const root = await realpath(resolve(task.lease.cwd));
    if (root.split(sep).some(nativePrivateRuntimeSegment)) throw new Error('Private native runtimes are outside repository tool authority.');
    if (root !== resolve(task.lease.cwd)) throw new Error('The task repository boundary changed.');
    const taskId = optional(text({ min: 1, max: 100 }));
    const pathCheck = text({ max: 1000 });
    const queryCheck = text({ min: 1, max: 200 });
    if (name === 'coforge_list_files') {
      const { path = '', query } = shape({ taskId, path: optional(pathCheck), query: optional(queryCheck) }, { strict: true })(raw);
      return this.list(root, path, query);
    }
    if (name === 'coforge_read_file') {
      const { path } = shape({ taskId, path: pathCheck }, { strict: true })(raw);
      return { path, content: await read(await this.bound(root, path)) };
    }
    if (name === 'coforge_search_files') {
      const { query, path = '' } = shape({ taskId, query: queryCheck, path: optional(pathCheck) }, { strict: true })(raw);
      const listing = await this.list(root, path);
      const matches: Array<{ path: string; line: number; text: string }> = [];
      let total = 0;
      for (const path of listing.files) {
        let content: string;
        try { content = await read(await this.bound(root, path)); } catch { continue; }
        total += Buffer.byteLength(content);
        if (total > 2 * 1024 * 1024) return { matches, ...incomplete };
        for (const [index, line] of content.split('\n').entries()) if (line.includes(query)) {
          matches.push({ path, line: index + 1, text: line.slice(0, 1000) });
          if (matches.length >= 100) return { matches, ...incomplete };
        }
      }
      return { matches, truncated: listing.truncated, ...(listing.truncated ? { narrowingHint } : {}) };
    }
    if (!['coforge_write_file', 'coforge_delete_file'].includes(name) || access !== 'editworktree' || task.lease.readOnly) throw new Error('This task cannot edit files.');
    if (name === 'coforge_delete_file') {
      const { path, expectedContent } = shape({ taskId, path: pathCheck, expectedContent: text({ max: MAX }) }, { strict: true })(raw);
      if (!path || /(?:^|\/)(?:package\.json|[^/]*lock[^/]*)$/iu.test(path)) throw new Error('This file cannot be edited by workflow agents.');
      const target = await this.bound(root, path);
      if (await read(target) !== expectedContent) throw new Error('File changed. Read its current content before deleting it.');
      task.input.signal?.throwIfAborted();
      await unlink(target); return { path, deleted: true };
    }
    const { path, content, expectedContent } = shape({ taskId, path: pathCheck, content: text({ max: MAX }), expectedContent: nullable(text({ max: MAX })) }, { strict: true })(raw);
    if (!path || /(?:^|\/)(?:package\.json|[^/]*lock[^/]*)$/iu.test(path)) throw new Error('This file cannot be edited by workflow agents.');
    if (Buffer.byteLength(content) > MAX) throw new Error('File content exceeds 200000 bytes.');
    const target = await this.bound(root, path, true);
    let before: string | null = null;
    try { before = await read(target); } catch (error) { if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error; }
    if (before !== expectedContent) throw new Error('File changed. Read its current content before replacing it.');
    task.input.signal?.throwIfAborted();
    await mkdir(dirname(target), { recursive: true });
    await this.bound(root, path, true);
    const temporary = join(dirname(target), `.coforge-mcp-${crypto.randomUUID()}.tmp`);
    try {
      await writeFile(temporary, content, { flag: 'wx', mode: 0o600 });
      await this.bound(root, path, true);
      task.input.signal?.throwIfAborted();
      if (before !== null && await read(target) !== before) throw new Error('File changed during replacement.');
      if (before === null) {
        // Exclusive create cannot overwrite a concurrently created target.
        await writeFile(target, content, { flag: 'wx', mode: 0o600 });
      } else await rename(temporary, target);
    } finally { await unlink(temporary).catch(() => undefined); }
    return { path, written: true };
  }
}
