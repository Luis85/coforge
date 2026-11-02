import { createHash } from 'node:crypto';
import { access, mkdir, mkdtemp, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('node:child_process', () => ({ execFile: vi.fn() }));
import { execFile } from 'node:child_process';
import { existingWindowsControllerExecutable, windowsControllerSourceHash } from '../../../infrastructure/coforge/native-process/windows-controller';
import { windowsApiSource } from '../../../infrastructure/coforge/native-process/windows-api-source';
import { windowsControllerSource } from '../../../infrastructure/coforge/native-process/windows-controller-source';

const platform = Object.getOwnPropertyDescriptor(process, 'platform'); const roots: string[] = [];
afterEach(async () => { vi.unstubAllEnvs(); vi.clearAllMocks(); if (platform) Object.defineProperty(process, 'platform', platform); for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });
async function fixture() {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'coforge-controller-cache-test-'))); roots.push(root);
  Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
  for (const key of ['TEMP', 'TMP', 'TMPDIR']) vi.stubEnv(key, root);
  return { root, directory: join(root, 'coforge-native-controller-' + windowsControllerSourceHash) };
}
it('reads a missing controller cache without creating directories or launching a compiler', async () => {
  const f = await fixture(); await expect(existingWindowsControllerExecutable()).resolves.toBeUndefined();
  await expect(access(f.directory)).rejects.toThrow(); expect(await readdir(f.root)).toEqual([]); expect(execFile).not.toHaveBeenCalled();
});
it('revalidates the existing executable hash and exact source on every lookup without compiling or repairing a changed cache', async () => {
  const f = await fixture(); await mkdir(f.directory);
  const bytes = Buffer.from('A fixture payload that is never executed.'); const executable = join(f.directory, 'Controller.exe');
  await writeFile(executable, bytes); await writeFile(join(f.directory, 'Controller.cs'), windowsApiSource + windowsControllerSource);
  const metadata = JSON.stringify({ sourceHash: windowsControllerSourceHash, executableHash: createHash('sha256').update(bytes).digest('hex') });
  await writeFile(join(f.directory, 'compiler.json'), metadata);
  await expect(existingWindowsControllerExecutable()).resolves.toBe(executable);
  await writeFile(executable, 'Changed after validation'); await expect(existingWindowsControllerExecutable()).resolves.toBeUndefined();
  await writeFile(executable, bytes); await writeFile(join(f.directory, 'Controller.cs'), 'Changed source'); await expect(existingWindowsControllerExecutable()).resolves.toBeUndefined();
  expect(execFile).not.toHaveBeenCalled(); expect((await readdir(f.directory)).sort()).toEqual(['Controller.cs', 'Controller.exe', 'compiler.json']);
});
