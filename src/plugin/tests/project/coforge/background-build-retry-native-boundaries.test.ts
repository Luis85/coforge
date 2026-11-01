import { link, mkdir, open, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { retrySourceFixture } from './background-build-retry-native-fixture';
import { BackgroundBuildRetryResources } from '../../../infrastructure/coforge/background-build-retry-resources';
import { SNAPSHOT_FILE_LIMIT } from '../../../infrastructure/coforge/background-build-seed/tree';
const folders: string[] = [];
afterEach(async () => { for (const folder of folders.splice(0)) await rm(folder, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
it.each(['hardlink', 'directory-link', 'metadata', 'oversized'] as const)('refuses %s source data before authorizing an import', async kind => {
  const f = await retrySourceFixture(folders); const before = JSON.stringify(await f.storage.load());
  if (kind === 'hardlink') await link(join(f.project, 'game.ts'), join(f.lease.cwd, 'linked.ts'));
  if (kind === 'directory-link') await symlink(f.project, join(f.lease.cwd, 'linked-folder'), process.platform === 'win32' ? 'junction' : 'dir');
  if (kind === 'metadata') { await rm(join(f.lease.cwd, '.git'), { force: true }); await writeFile(join(f.lease.cwd, '.git'), 'A changed Git pointer is not an import source'); }
  if (kind === 'oversized') { const file = await open(join(f.lease.cwd, 'large.bin'), 'wx'); try { await file.truncate(SNAPSHOT_FILE_LIMIT + 1); } finally { await file.close(); } }
  await expect(f.resources.inspect(f.source)).rejects.toThrow();
  expect(JSON.stringify(await f.storage.load())).toBe(before); expect(await readFile(join(f.project, 'game.ts'), 'utf8')).toBe('before\n');
}, 30000);
it('refuses changed managed folders and private staging redirected into a vault', async () => {
  const f = await retrySourceFixture(folders); await mkdir(join(f.lease.cwd, 'Managed')); await writeFile(join(f.lease.cwd, 'Managed', 'request.md'), 'PRIVATE');
  const privateDirectory = join(f.root, 'custom-worker');
  const resources = new BackgroundBuildRetryResources({ storage: f.storage, privateDirectory, vaultDirectory: f.vault,
    protectedVaultFolders: () => [join(f.project, 'Managed')], assertReady: async () => {} });
  await expect(resources.inspect(f.source)).rejects.toThrow('protected');
  const redirected = new BackgroundBuildRetryResources({ storage: f.storage, privateDirectory: join(f.vault, 'worker'), vaultDirectory: f.vault,
    protectedVaultFolders: () => [], assertReady: async () => {} });
  await expect(redirected.inspect(f.source)).rejects.toThrow('outside');
}, 30000);
