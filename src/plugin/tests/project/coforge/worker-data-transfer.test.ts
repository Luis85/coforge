import { mkdir, mkdtemp, readFile, realpath, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { transferWorkerDirectory } from '../../../infrastructure/coforge/worker-data-transfer';
import { assertNativeVaultData } from '../../../infrastructure/coforge/vault-data-native';

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    if (!resolve(root).startsWith(resolve('.nq') + sep)) throw new Error('Invalid fixture cleanup');
    await rm(root, { recursive: true, force: true });
  }
});
async function fixture() {
  await mkdir(resolve('.nq'), { recursive: true });
  const root = await realpath(await mkdtemp(join(resolve('.nq'), 'worker-transfer-'))); roots.push(root);
  const from = join(root, 'legacy'), to = join(root, 'vault', '.coforge-data', 'worker');
  await mkdir(join(from, 'job'), { recursive: true });
  await writeFile(join(from, 'job', 'record.json'), '{ "keep": "exact" }\r\n');
  return { root, from, to };
}
const crossDevice = () => Object.assign(new Error('Cross-volume rename'), { code: 'EXDEV' });
it('verifies a cross-volume copy and resumes an interrupted final rename without losing the source', async () => {
  const f = await fixture();
  let attempts = 0;
  const interrupt: typeof rename = async (from, to) => {
    if (++attempts === 1) throw crossDevice();
    if (attempts === 2) throw new Error('Disk interrupted');
    await rename(from, to);
  };
  await expect(transferWorkerDirectory(f.from, f.to, interrupt)).rejects.toThrow('Disk interrupted');
  expect(await readFile(join(f.from, 'job', 'record.json'), 'utf8')).toBe('{ "keep": "exact" }\r\n');
  await transferWorkerDirectory(f.from, f.to);
  expect(await readFile(join(f.to, 'job', 'record.json'), 'utf8')).toBe('{ "keep": "exact" }\r\n');
  await expect(readFile(f.to + '.migration.json')).rejects.toThrow();
  await expect(readFile(join(f.from, 'job', 'record.json'))).rejects.toThrow();
});
it('retains both versions when a staged cross-volume copy changes', async () => {
  const f = await fixture();
  let first = true;
  await expect(transferWorkerDirectory(f.from, f.to, async () => {
    if (first) { first = false; throw crossDevice(); }
    throw new Error('Interrupted');
  })).rejects.toThrow('Interrupted');
  await writeFile(join(f.to + '.migrating', 'job', 'record.json'), 'changed');
  await expect(transferWorkerDirectory(f.from, f.to)).rejects.toThrow('migration needs recovery');
  expect(await readFile(join(f.to + '.migrating', 'job', 'record.json'), 'utf8')).toBe('changed');
  expect(await readFile(join(f.from, 'job', 'record.json'), 'utf8')).toContain('exact');
});
it('resumes after the copied generation commits but its reply is lost, retaining binary evidence exactly', async () => {
  const f = await fixture();
  const binary = Buffer.from([0, 255, 1, 128]);
  await writeFile(join(f.from, 'job', 'evidence.bin'), binary);
  let first = true;
  await expect(transferWorkerDirectory(f.from, f.to, async (from, to) => {
    if (first) { first = false; throw crossDevice(); }
    await rename(from, to);
    throw new Error('Reply lost');
  })).rejects.toThrow('Reply lost');
  expect(await readFile(join(f.from, 'job', 'evidence.bin'))).toEqual(binary);
  await transferWorkerDirectory(f.from, f.to);
  expect(await readFile(join(f.to, 'job', 'evidence.bin'))).toEqual(binary);
  await expect(readFile(join(f.from, 'job', 'evidence.bin'))).rejects.toThrow();
});
it('rejects a junction redirecting vault data and preserves linked worker evidence', async () => {
  const f = await fixture();
  const vault = join(f.root, 'linked-vault'); await mkdir(vault);
  await symlink(f.from, join(vault, '.coforge-data'), process.platform === 'win32' ? 'junction' : 'dir');
  await expect(assertNativeVaultData(vault, ['.coforge-data/studio'])).rejects.toThrow('linked');
  await symlink(join(f.from, 'job'), join(f.from, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  await expect(transferWorkerDirectory(f.from, f.to)).rejects.toThrow('migration needs recovery');
  expect(await readFile(join(f.from, 'job', 'record.json'), 'utf8')).toContain('exact');
});
