import { afterEach, expect, it } from 'vitest';
import { chmod, link, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { captureVerificationSource } from '../../../infrastructure/coforge/verification/source';

const roots: string[] = [];
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });
async function fixture() {
  await mkdir('.nq', { recursive: true }); const root = await realpath(await mkdtemp(join(process.cwd(), '.nq/verification-source-'))); roots.push(root);
  const project = join(root, 'project'); await mkdir(project);
  await writeFile(join(project, 'app.js'), 'source bytes');
  const paths = ['Managed'];
  const lease = { cwd: project, get protectedProjectPaths() { return paths; }, validate: async () => {}, capture: async () => undefined, release: async () => {} };
  return { root, project, paths, lease };
}
it('copies only allowed source and never follows credential, managed-note, dependency or linked paths', async () => {
  const f = await fixture();
  for (const folder of ['.git', 'Managed', 'node_modules']) { await mkdir(join(f.project, folder)); await writeFile(join(f.project, folder, 'private.txt'), 'PRIVATE'); }
  await writeFile(join(f.project, '.env'), 'PRIVATE'); await writeFile(join(f.project, '.mcp.json'), 'PRIVATE');
  await mkdir(join(f.root, 'outside')); await writeFile(join(f.root, 'outside/private.txt'), 'PRIVATE');
  await symlink(join(f.root, 'outside'), join(f.project, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  await link(join(f.root, 'outside/private.txt'), join(f.project, 'linked-file'));
  const destination = join(f.root, 'copy'); const snapshot = await captureVerificationSource(f.lease, destination);
  expect(snapshot.files).toBe(1); expect(snapshot.excluded).toBeGreaterThanOrEqual(7);
  expect(await readFile(join(destination, 'app.js'), 'utf8')).toBe('source bytes');
  for (const name of ['.env', '.mcp.json', 'Managed/private.txt', '.git/private.txt', 'node_modules/private.txt', 'linked/private.txt', 'linked-file']) await expect(readFile(join(destination, name))).rejects.toThrow();
});
it('fingerprints source bytes and effective executable permissions, while ignoring host dependencies', async () => {
  const f = await fixture(); const first = await captureVerificationSource(f.lease);
  await mkdir(join(f.project, 'node_modules')); await writeFile(join(f.project, 'node_modules/host-only'), 'not mounted');
  expect((await captureVerificationSource(f.lease)).sourceHash).toBe(first.sourceHash);
  await chmod(join(f.project, 'app.js'), 0o755);
  const executable = await captureVerificationSource(f.lease);
  if (process.platform !== 'win32') expect(executable.sourceHash).not.toBe(first.sourceHash);
  await writeFile(join(f.project, 'app.js'), 'changed bytes');
  expect((await captureVerificationSource(f.lease)).sourceHash).not.toBe(executable.sourceHash);
});
