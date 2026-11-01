import { mkdir, open, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { retrySourceFixture } from './background-build-retry-native-fixture';
import { agentGit } from '../../../infrastructure/coforge/agent-worktree';
import { defaultIntegration } from '../../../features/coforge/domain/seed';
import { BackgroundBuildRetryResources } from '../../../infrastructure/coforge/background-build-retry-resources';
import { RetrySeedStore, retrySeedDirectory } from '../../../infrastructure/coforge/background-build-seed/store';
import { SNAPSHOT_FILE_LIMIT } from '../../../infrastructure/coforge/background-build-seed/tree';
const folders: string[] = [];
afterEach(async () => { for (const path of folders.splice(0)) await rm(path, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
it('discloses ignored agent-denied dependency caches without scanning or copying their large files and links, preserving ignored source leaves', async () => {
  const f = await retrySourceFixture(folders); await writeFile(join(f.lease.cwd, '.gitignore'), 'node_modules/\nignored.txt\n');
  await writeFile(join(f.lease.cwd, 'ignored.txt'), 'Allowed reviewed ignored source'); await mkdir(join(f.lease.cwd, 'node_modules', '.cache'), { recursive: true });
  const large = await open(join(f.lease.cwd, 'node_modules', '.cache', 'package.bin'), 'wx'); try { await large.truncate(SNAPSHOT_FILE_LIMIT + 1); } finally { await large.close(); }
  await symlink(f.project, join(f.lease.cwd, 'node_modules', 'linked-package'), process.platform === 'win32' ? 'junction' : 'dir');
  const inspected = await f.resources.inspect(f.source);
  expect(inspected.captureScope).toBe('coforge-source-code/v1');
  expect(inspected.excludedPaths).toContainEqual({ path: 'node_modules', reason: 'git-ignored-agent-denied-directory' });
  expect(inspected.increment?.files.some(file => file.path === 'ignored.txt')).toBe(true);
  expect(inspected.increment?.files.some(file => file.path.startsWith('node_modules/'))).toBe(false);
  const store = new RetrySeedStore(retrySeedDirectory(f.privateDirectory)); const seed = await store.read(inspected.snapshot);
  expect(seed.manifest.excludedPaths).toEqual(inspected.excludedPaths); expect(seed.manifest.changes.some(file => file.path.startsWith('node_modules/'))).toBe(false);
}, 90000);
it('retains tracked descendants under ignored dependencies and refuses changed protected tracked content', async () => {
  const f = await retrySourceFixture(folders); await mkdir(join(f.project, 'node_modules'), { recursive: true });
  await writeFile(join(f.project, '.gitignore'), 'node_modules/\n'); await writeFile(join(f.project, 'node_modules', 'kept.ts'), 'Tracked dependency boundary\n');
  await agentGit(f.project, ['add', '.gitignore']); await agentGit(f.project, ['add', '--force', 'node_modules/kept.ts']);
  await agentGit(f.project, ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--no-gpg-sign', '-m', 'Tracked ignored descendant']);
  const lease = await f.workspaces.acquire({ runId: 'tracked-cache-run', projectId: f.source.projectId, attemptId: 'tracked-cache-attempt', access: 'editworktree',
    integration: { ...defaultIntegration(), projectPath: f.project, worktreeFolder: join(f.root, 'tracked-cache-trees'), allowImplementation: true } });
  await mkdir(join(lease.cwd, 'node_modules', 'cache-package')); const huge = await open(join(lease.cwd, 'node_modules', 'cache-package', 'huge.bin'), 'wx'); try { await huge.truncate(SNAPSHOT_FILE_LIMIT + 1); } finally { await huge.close(); }
  await writeFile(join(lease.cwd, 'game.ts'), 'Allowed code edit\n'); await lease.release();
  const source = { ...f.source, runId: 'tracked-cache-run', sourceJobId: 'tracked-cache-job', sourceAttemptId: 'tracked-cache-attempt', sourceWorkspaceId: lease.id, expectedIncrement: undefined };
  const resources = new BackgroundBuildRetryResources({ storage: f.storage, privateDirectory: join(f.root, 'tracked-cache-worker'), vaultDirectory: f.vault, protectedVaultFolders: () => [], assertReady: async () => {} });
  const inspected = await resources.inspect(source); expect(inspected.fileCount).toBe(1);
  expect(inspected.excludedPaths).toContainEqual({ path: 'node_modules/cache-package', reason: 'git-ignored-agent-denied-directory' });
  expect(inspected.excludedPaths?.some(item => item.path === 'node_modules')).toBe(false);
  expect(await readFile(join(lease.cwd, 'node_modules', 'kept.ts'), 'utf8')).toBe('Tracked dependency boundary\n');
  await writeFile(join(lease.cwd, 'node_modules', 'kept.ts'), 'Changed protected tracked content');
  await expect(resources.inspect(source)).rejects.toThrow('not permitted');
}, 90000);
