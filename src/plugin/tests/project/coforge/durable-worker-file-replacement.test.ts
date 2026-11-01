import { link, mkdtemp, readFile, rename, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('node:fs/promises', async importOriginal => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return { ...actual, rename: vi.fn(actual.rename) };
});
import { WorkerFiles } from '../../../infrastructure/coforge/durable-worker/files';

const folders: string[] = [];
const locked = () => Object.assign(new Error('Synthetic replacement lock'), { code: 'EPERM' });
beforeEach(async () => { const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises'); vi.mocked(rename).mockReset().mockImplementation(actual.rename); });
afterEach(async () => { for (const folder of folders.splice(0)) await rm(folder, { recursive: true, force: true }); });
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'coforge-worker-replacement-')); folders.push(root);
  const files = new WorkerFiles(root); await files.initialize(); await files.write('record.json', { sequence: 1 });
  vi.mocked(rename).mockClear(); return { files, root };
}

it.each(['EPERM', 'EACCES', 'EBUSY'])('commits the original atomic write after a transient %s replacement failure', async code => {
  const { files } = await fixture();
  vi.mocked(rename).mockRejectedValueOnce(Object.assign(locked(), { code }));
  await files.write('record.json', { sequence: 2 });
  expect(await files.read('record.json')).toEqual({ sequence: 2 }); expect(rename).toHaveBeenCalledTimes(2);
});

it('bounds replacement retries and preserves the previous record on permanent denial', async () => {
  const { files } = await fixture(); vi.mocked(rename).mockRejectedValue(locked());
  await expect(files.write('record.json', { sequence: 2 })).rejects.toThrow('Synthetic replacement lock');
  expect(await files.read('record.json')).toEqual({ sequence: 1 });
  expect(vi.mocked(rename).mock.calls.length).toBeGreaterThan(1); expect(vi.mocked(rename).mock.calls.length).toBeLessThanOrEqual(5);
});

it('does not retry over a target replaced after the original attempt', async () => {
  const { files, root } = await fixture(); const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
  const foreign = join(root, 'foreign.json'); await writeFile(foreign, '{"foreign":true}');
  vi.mocked(rename).mockImplementationOnce(async (_source, target) => { await actual.rename(foreign, target); throw locked(); });
  await expect(files.write('record.json', { sequence: 2 })).rejects.toThrow();
  expect(await files.read('record.json')).toEqual({ foreign: true }); expect(rename).toHaveBeenCalledTimes(1);
});

it('does not promote a temporary file substituted with a hard link during backoff', async () => {
  const { files, root } = await fixture(); const foreign = join(root, 'foreign.json'); await writeFile(foreign, '{"foreign":true}');
  vi.mocked(rename).mockImplementationOnce(async source => { await unlink(source); await link(foreign, source); throw locked(); });
  await expect(files.write('record.json', { sequence: 2 })).rejects.toThrow();
  expect(await files.read('record.json')).toEqual({ sequence: 1 }); expect(await readFile(foreign, 'utf8')).toBe('{"foreign":true}');
  expect(rename).toHaveBeenCalledTimes(1);
});

it('does not recreate a destination removed during replacement backoff', async () => {
  const { files } = await fixture();
  vi.mocked(rename).mockImplementationOnce(async (_source, target) => { await unlink(target); throw locked(); });
  await expect(files.write('record.json', { sequence: 2 })).rejects.toThrow();
  expect(await files.read('record.json')).toBeUndefined(); expect(rename).toHaveBeenCalledTimes(1);
});
