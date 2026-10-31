import { access, mkdtemp, mkdir, realpath, rm, symlink } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { durableBuildDirectory } from '../../../infrastructure/coforge/durable-build-environment';

const folders: string[] = [];
afterEach(async () => {
  for (const folder of folders.splice(0)) {
    if (!resolve(folder).startsWith(resolve('.nq') + sep)) throw new Error('Unsafe environment fixture cleanup');
    await rm(folder, { recursive: true, force: true });
  }
});
it('resolves an existing private-storage ancestor before creation and refuses an alias into the vault', async () => {
  await mkdir(resolve('.nq'), { recursive: true });
  const root = await realpath(await mkdtemp(join(resolve('.nq'), 'durable-environment-'))); folders.push(root);
  const vault = join(root, 'vault'); const alias = join(root, 'linked-storage'); await mkdir(vault);
  await symlink(vault, alias, process.platform === 'win32' ? 'junction' : 'dir');
  expect(() => durableBuildDirectory(vault, join(alias, 'not-created', 'workers'))).toThrow('outside the vault');
  await expect(access(join(vault, 'not-created'))).rejects.toThrow();
  const outside = join(root, 'outside'); const safeAlias = join(root, 'outside-alias'); await mkdir(outside);
  await symlink(outside, safeAlias, process.platform === 'win32' ? 'junction' : 'dir');
  expect(durableBuildDirectory(vault, join(safeAlias, 'workers'))).toBe(durableBuildDirectory(vault, join(outside, 'workers')));
  await expect(access(join(outside, 'workers'))).rejects.toThrow();
});

it('uses machine-local storage outside the vault and unifies aliases of the same vault', async () => {
  await mkdir(resolve('.nq'), { recursive: true });
  const root = await realpath(await mkdtemp(join(resolve('.nq'), 'durable-environment-'))); folders.push(root);
  const vault = join(root, 'vault'); const alias = join(root, 'vault-alias'); const local = join(root, 'local');
  await mkdir(vault); await symlink(vault, alias, process.platform === 'win32' ? 'junction' : 'dir');
  const first = durableBuildDirectory(vault, local);
  expect(first.startsWith(resolve(local) + sep)).toBe(true);
  expect(first).toBe(durableBuildDirectory(alias, local));
  expect(relative(vault, first).startsWith('..')).toBe(true);
  expect(first).not.toContain('vault-alias');
  expect(() => durableBuildDirectory(vault, join(vault, '..private-looking'))).toThrow('outside the vault');
  const other = join(root, 'other'); await mkdir(other);
  expect(durableBuildDirectory(other, local)).not.toBe(first);
});
