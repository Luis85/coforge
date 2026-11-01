import { constants } from 'node:fs';
import { lstat, open, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { oneOf, shape } from '../../features/coforge/domain/check';
import { nativeWorkflowPrivateRuntimeCheck, type NativeWorkflowPrivateRuntime } from '../../features/coforge/domain/native-workflow-process';

const MARKER = 'native-runtime-owner.json';
const markerCheck = shape({ version: oneOf([1]), runtime: nativeWorkflowPrivateRuntimeCheck }, { strict: true });
const ownershipError = () => new Error('Private Codex runtime ownership could not be verified. Its state remains quarantined; check the original runtime and retry cleanup.');
const absent = (error: unknown) => error instanceof Error && 'code' in error && error.code === 'ENOENT';

async function canonicalDirectory(directory: string): Promise<string | undefined> {
  const parent = await realpath(tmpdir());
  if (!isAbsolute(directory) || resolve(directory) !== directory || dirname(directory) !== parent || !/^coforge-codex-[A-Za-z0-9]{6}$/u.test(basename(directory))) throw ownershipError();
  let info;
  try { info = await lstat(directory); } catch (error) { if (absent(error)) return; throw error; }
  if (!info.isDirectory() || info.isSymbolicLink() || await realpath(directory) !== directory) throw ownershipError();
  return directory;
}

async function verify(ref: NativeWorkflowPrivateRuntime): Promise<string | undefined> {
  const directory = await canonicalDirectory(ref.directory);
  if (!directory) return;
  const path = join(directory, MARKER); const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || info.size > 16000) throw ownershipError();
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const actual = await handle.stat();
    if (actual.ino !== info.ino || actual.dev !== info.dev || actual.nlink !== 1 || actual.size > 16000) throw ownershipError();
    const bytes = await handle.readFile(); if (bytes.length > 16000) throw ownershipError();
    const marker = markerCheck(JSON.parse(bytes.toString('utf8')));
    if (JSON.stringify(marker.runtime) !== JSON.stringify(ref)) throw ownershipError();
  } finally { await handle.close(); }
  return directory;
}

export async function assertCodexPrivateRuntime(value: NativeWorkflowPrivateRuntime, expectedDirectory: string): Promise<void> {
  try {
    const ref = nativeWorkflowPrivateRuntimeCheck(value);
    if (ref.directory !== expectedDirectory || !await verify(ref)) throw ownershipError();
  } catch { throw ownershipError(); }
}

/** Create the private capability receipt before any provider can receive paid task input. */
export async function createCodexPrivateRuntime(directory: string, identity: Pick<NativeWorkflowPrivateRuntime, 'runId' | 'attemptId' | 'projectId'>): Promise<NativeWorkflowPrivateRuntime> {
  const canonical = await realpath(directory);
  if (!await canonicalDirectory(canonical)) throw ownershipError();
  const runtime = nativeWorkflowPrivateRuntimeCheck({ ...identity, directory: canonical, ownerToken: randomBytes(32).toString('hex') });
  await writeFile(join(canonical, MARKER), JSON.stringify({ version: 1, runtime }), { flag: 'wx', mode: 0o600 });
  return runtime;
}

/** The caller proves original provider cessation. Never follow a persisted path or link outside this receipt. */
export async function purgeCodexPrivateRuntime(value: NativeWorkflowPrivateRuntime): Promise<void> {
  try {
    const ref = nativeWorkflowPrivateRuntimeCheck(value);
    const directory = await verify(ref); if (!directory) return;
    const home = join(directory, 'codex-home');
    let entries = 0;
    const inspect = async (path: string, depth: number): Promise<void> => {
      if (++entries > 20000 || depth > 64) throw ownershipError();
      const info = await lstat(path);
      if (info.isSymbolicLink() || await realpath(path) !== path || !info.isDirectory() && (!info.isFile() || info.nlink !== 1)) throw ownershipError();
      if (info.isDirectory()) for (const entry of await readdir(path)) await inspect(join(path, entry), depth + 1);
    };
    try { await lstat(home); } catch (error) { if (absent(error)) return; throw error; }
    if (!(await lstat(home)).isDirectory()) throw ownershipError();
    await inspect(home, 0);
    await verify(ref);
    if (await realpath(home) !== home) throw ownershipError();
    await rm(home, { recursive: true, force: false });
  } catch { throw ownershipError(); }
}
