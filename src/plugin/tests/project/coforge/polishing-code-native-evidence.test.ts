import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { nativePolishFixture } from './polishing-code-native-fixture';
import { ReviewedResourceMaterializer } from '../../../infrastructure/coforge/background-build-seed/materialize';
import { durableReadWorkspace } from '../../../infrastructure/coforge/durable-worker/read-workspace';
import { defaultIntegration } from '../../../features/coforge/domain/seed';
import type { Increment } from '../../../features/coforge/domain/types';
const folders: string[] = [];
afterEach(async () => { for (const path of folders.splice(0)) await rm(path, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
const view = (value: Increment | undefined | null) => value ? JSON.stringify([value.files, value.diff, value.branch, value.worktree, value.commit, value.snapshotHash]) : '';
it('carries allowed ignored source through provider completion and exact Apply evidence without omitting its bytes', async () => {
  const f = await nativePolishFixture(folders, 'foreground', { ignored: true });
  expect(f.done.increment?.files.some(file => file.path === 'ignored.txt')).toBe(true);
  expect(f.done.increment?.snapshotHash).toMatch(/^[a-f0-9]{64}$/u);
  expect(view(f.reviewed.increment)).toBe(view(f.done.increment));
  const materializer = new ReviewedResourceMaterializer(f.privateDirectory, f.workspaces); const binding = await materializer.materialize(f.apply, []);
  expect(binding.increment.files.some(file => file.path === 'ignored.txt')).toBe(true); expect(binding.increment.snapshotHash).toBe(f.reviewed.increment?.snapshotHash);
  expect(await readFile(join(binding.increment.worktree!, 'ignored.txt'), 'utf8')).toBe('Polished ignored source bytes');
  await f.workspaces.assertReviewable(binding.workspaceId, binding.increment); expect(f.capture).toHaveBeenCalledOnce();
}, 150000);
it('rejects same-size untracked binary mutation after a readonly lease has been granted', async () => {
  const f = await nativePolishFixture(folders, 'background', { binary: true });
  const materializer = new ReviewedResourceMaterializer(f.privateDirectory, f.workerSpaces, f.files); const binding = await materializer.materialize(f.apply, []);
  const lease = await durableReadWorkspace(f.files, { runId: f.source.runId, projectId: f.source.projectId, attemptId: 'reader', workspaceId: binding.workspaceId, access: 'readproject',
    integration: { ...defaultIntegration(), projectPath: f.project } }, (id, expected) => f.workerSpaces.assertReviewable(id, expected));
  expect(binding.increment.snapshotHash).toMatch(/^[a-f0-9]{64}$/u);
  await writeFile(join(lease.cwd, 'game.bin'), Buffer.from([0, 3, 2]));
  await expect(lease.validate?.()).rejects.toThrow();
  await expect(f.workerSpaces.assertReviewable(binding.workspaceId, binding.increment)).rejects.toThrow();
  await lease.release(); expect(f.capture).toHaveBeenCalledOnce();
}, 150000);
