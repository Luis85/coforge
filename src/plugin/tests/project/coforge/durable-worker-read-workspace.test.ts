import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { durableReadWorkspace } from '../../../infrastructure/coforge/durable-worker/read-workspace';
import { WorkerFiles } from '../../../infrastructure/coforge/durable-worker/files';
import { WorkerStore } from '../../../infrastructure/coforge/durable-worker/store';
import { workerWorkspaces } from '../../../infrastructure/coforge/durable-worker/workspaces';
import { agentGit } from '../../../infrastructure/coforge/agent-worktree';
import { defaultIntegration } from '../../../features/coforge/domain/seed';
import type { WorkflowWorkspaceRequest } from '../../../features/coforge/application/workflow-workspace-ports';
import { durableRequest } from './durable-worker-fixture';

const roots: string[] = [];
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
async function fixture(changed = true) {
  await mkdir(resolve('.nq'), { recursive: true });
  const root = await realpath(await mkdtemp(join(resolve('.nq'), 'read-workspace-')));
  if (!root.startsWith(resolve('.nq') + sep)) throw new Error('Unsafe contained fixture'); roots.push(root);
  const project = join(root, 'game'); await mkdir(project); await writeFile(join(project, 'game.ts'), 'export const radius = 1;\n');
  await agentGit(project, ['init', '--initial-branch=main']); await agentGit(project, ['add', '--all']);
  await agentGit(project, ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--no-gpg-sign', '-m', 'Fixture']);
  const files = new WorkerFiles(join(root, 'private')); const store = new WorkerStore(files, 'read-owner'); await store.initialize();
  const original = durableRequest(); original.protectedProjectPaths = ['Private tasks']; original.input.integration.projectPath = project; original.input.integration.worktreeFolder = join(root, 'worktrees');
  const ref = await store.prepare(original); const workspaces = workerWorkspaces(files); await workspaces.start();
  const lease = await workspaces.acquire({ runId: original.runId, projectId: original.projectId, attemptId: original.attemptId, access: 'editworktree', integration: { ...defaultIntegration(), ...original.input.integration } });
  if (changed) await writeFile(join(lease.cwd, 'game.ts'), 'export const radius = 2;\n');
  const increment = await lease.capture('Captured original Build'); await lease.release();
  await store.update(ref, record => { record.snapshot.phase = 'completed'; record.snapshot.workspaceId = lease.id; record.snapshot.workspaceCaptured = true; record.snapshot.increment = increment; record.snapshot.result = { summary: 'Completed original Build.', increment }; });
  const request: WorkflowWorkspaceRequest = { runId: original.runId, projectId: original.projectId, attemptId: 'readonly-follow-up', access: 'readproject', integration: { ...defaultIntegration(), ...original.input.integration }, workspaceId: lease.id };
  const review = vi.fn((id: string, expected: typeof increment) => workspaces.assertReviewable(id, expected));
  return { files, store, ref, lease, increment, request, review };
}

it('returns only the original read-only authority and leaves its worker lease journal and files unchanged', async () => {
  const f = await fixture(); const before = await readFile(f.files.path('workspaces.json'), 'utf8');
  const lease = await durableReadWorkspace(f.files, f.request, f.review);
  expect(lease).toMatchObject({ id: f.lease.id, cwd: f.lease.cwd, readOnly: true, protectedProjectPaths: ['Private tasks'] });
  expect(Object.isFrozen(lease.protectedProjectPaths)).toBe(true);
  await lease.validate?.(); expect(await lease.capture('No writing authority')).toBeUndefined(); await lease.release();
  expect(await readFile(f.files.path('workspaces.json'), 'utf8')).toBe(before);
  expect(await readFile(join(f.lease.cwd, 'game.ts'), 'utf8')).toBe('export const radius = 2;\n');
  await expect(lease.validate?.()).rejects.toThrow(); expect(f.review).toHaveBeenCalled();
}, 20000);

it('refuses missing, editing, foreign run/project and foreign source-root requests before any read grant', async () => {
  const f = await fixture();
  for (const request of [{ ...f.request, workspaceId: undefined }, { ...f.request, access: 'editworktree' as const }, { ...f.request, runId: 'foreign' }, { ...f.request, projectId: 'CFP-999' }, { ...f.request, integration: { ...f.request.integration, projectPath: f.files.directory } }])
    await expect(durableReadWorkspace(f.files, request, f.review)).rejects.toThrow();
}, 20000);

it('rechecks actual cumulative files and original terminal ownership before every later read', async () => {
  const f = await fixture(); const lease = await durableReadWorkspace(f.files, f.request, f.review);
  await writeFile(join(f.lease.cwd, 'game.ts'), 'export const radius = 3;\n');
  await expect(lease.validate?.()).rejects.toThrow();
  await writeFile(join(f.lease.cwd, 'game.ts'), 'export const radius = 2;\n');
  await lease.validate?.();
  await f.store.update(f.ref, record => { record.snapshot.phase = 'attention'; record.terminationUnknown = true; });
  await expect(lease.validate?.()).rejects.toThrow();
}, 20000);

it('qualifies a verified empty original capture but rejects files added after the read scope was sealed', async () => {
  const f = await fixture(false); const lease = await durableReadWorkspace(f.files, f.request, f.review);
  expect(f.increment).toBeUndefined(); expect(lease.readOnly).toBe(true);
  await writeFile(join(f.lease.cwd, 'new.ts'), 'Unreviewed file\n');
  await expect(lease.validate?.()).rejects.toThrow();
  await lease.release();
}, 20000);
