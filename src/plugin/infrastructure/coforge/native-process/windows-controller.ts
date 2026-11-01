import { execFile } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { lstat, mkdtemp, readFile, realpath, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { WorkerFiles } from '../durable-worker/files';
import { nativeWorkflowLifetimeRefCheck, type NativeWorkflowLifetimeRef } from '../../../features/coforge/domain/native-workflow-lifetime';
import { windowsApiSource } from './windows-api-source';
import { windowsControllerSource } from './windows-controller-source';
import { OwnedWorktreeError } from './errors';

const source = windowsApiSource + windowsControllerSource;
export const windowsControllerSourceHash = createHash('sha256').update(source).digest('hex');
const unavailable = () => new OwnedWorktreeError('controller_unavailable');
export const nativeSystemEnvironment = (environment: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv => Object.fromEntries(Object.entries(environment)
  .filter(([key, value]) => value !== undefined && ['PATH', 'PATHEXT', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP'].includes(key.toUpperCase())));
async function executableHash(path: string): Promise<string> {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || info.size > 4 * 1024 * 1024) throw unavailable();
  return createHash('sha256').update(await readFile(path)).digest('hex');
}
async function cached(directory: string): Promise<string> {
  const files = new WorkerFiles(directory); await files.attach();
  const value = await files.read('compiler.json', 1024);
  if (!value || typeof value !== 'object' || !('sourceHash' in value) || value.sourceHash !== windowsControllerSourceHash || !('executableHash' in value) ||
      value.executableHash !== await executableHash(files.path('Controller.exe')) || await files.source('Controller.cs') !== source) throw unavailable();
  return files.path('Controller.exe');
}
async function compileController(signal?: AbortSignal): Promise<string> {
  const root = await realpath(tmpdir()); const directory = join(root, 'coforge-native-controller-' + windowsControllerSourceHash);
  try { return await cached(directory); }
  catch (error) { if (await lstat(directory).catch(() => undefined)) throw unavailable(); if (signal?.aborted) throw error; }
  const staging = await mkdtemp(join(root, 'coforge-native-job-')); const files = new WorkerFiles(staging); await files.attach();
  try {
    await files.createSource('Controller.cs', source);
    const framework = join(process.env.SystemRoot ?? process.env.SYSTEMROOT ?? 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319');
    await new Promise<void>((resolve, reject) => execFile(join(framework, 'csc.exe'), ['/nologo', '/target:exe', '/optimize+',
      '/reference:' + join(framework, 'System.Runtime.Serialization.dll'), '/out:' + files.path('Controller.exe'), files.path('Controller.cs')],
    { cwd: files.directory, env: nativeSystemEnvironment(), windowsHide: true, timeout: 20000, maxBuffer: 12000, signal }, error => error ? reject(unavailable()) : resolve()));
    await files.create('compiler.json', { sourceHash: windowsControllerSourceHash, executableHash: await executableHash(files.path('Controller.exe')) });
    try { await rename(files.directory, directory); }
    catch { if (!await lstat(directory).catch(() => undefined)) throw unavailable(); }
    return await cached(directory);
  } finally {
    if (/^coforge-native-job-[a-zA-Z0-9_-]{6}$/u.test(relative(root, staging))) await rm(staging, { recursive: true, force: true }).catch(() => undefined);
  }
}
export async function windowsControllerExecutable(signal?: AbortSignal): Promise<string> {
  if (process.platform !== 'win32') throw new Error('Native process lifetime is unsupported on this platform.');
  return compileController(signal);
}
export async function prepareWindowsJob(owner: { runId: string; attemptId: string; projectId: string }, signal?: AbortSignal): Promise<{ executable: string; files: WorkerFiles; lifetime: NativeWorkflowLifetimeRef }> {
  if (process.platform !== 'win32') throw new OwnedWorktreeError('unsupported_platform');
  signal?.throwIfAborted(); const executable = await compileController(signal);
  await new Promise<void>((resolve, reject) => execFile(executable, ['--probe'], { env: nativeSystemEnvironment(), windowsHide: true, timeout: 5000, maxBuffer: 1000 },
    error => error ? reject(new OwnedWorktreeError(typeof error.code === 'number' && error.code === 74 ? 'non_admin_required' : 'controller_unavailable')) : resolve()));
  const directory = await mkdtemp(join(await realpath(tmpdir()), 'coforge-native-job-')); const files = new WorkerFiles(directory); await files.attach();
  const lifetime = nativeWorkflowLifetimeRefCheck({ version: 1, kind: 'windows-job', directory: files.directory, ownerToken: randomBytes(32).toString('hex'), sourceHash: windowsControllerSourceHash, ...owner });
  await files.create('owner.json', lifetime); return { executable, files, lifetime };
}
