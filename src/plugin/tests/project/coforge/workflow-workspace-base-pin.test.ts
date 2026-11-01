import { access, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import type { WorkflowWorkspaceRecord, WorkflowWorkspaceRequest } from '../../../features/coforge/application/workflow-workspace-ports';
import { defaultIntegration } from '../../../features/coforge/domain/seed';
import { LocalWorkflowWorkspaces } from '../../../infrastructure/coforge/workflow-workspaces';
import { agentGit } from '../../../infrastructure/coforge/agent-worktree';

const folders: string[] = [];
afterEach(async () => {
  for (const folder of folders.splice(0)) {
    if (!resolve(folder).startsWith(resolve('.nq') + sep)) throw new Error('Unsafe pinned-workspace fixture cleanup');
    await rm(folder, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});
async function fixture() {
  await mkdir(resolve('.nq'), { recursive: true });
  const folder = await realpath(await mkdtemp(join(resolve('.nq'), 'workspace-base-'))); folders.push(folder);
  const repo = join(folder, 'game'); await mkdir(repo);
  await agentGit(repo, ['init', '--initial-branch=main']); await agentGit(repo, ['config', 'core.autocrlf', 'false']);
  const commit = async (content: string) => {
    await writeFile(join(repo, 'game.txt'), content); await agentGit(repo, ['add', 'game.txt']);
    await agentGit(repo, ['-c', 'user.name=CoForge fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--no-gpg-sign', '-m', 'Contained base']);
    return (await agentGit(repo, ['rev-parse', 'HEAD'])).trim();
  };
  const original = await commit('original base\n'); const current = await commit('new main head\n');
  let saved: WorkflowWorkspaceRecord[] = [];
  const storage = { load: async () => structuredClone(saved), save: async (rows: WorkflowWorkspaceRecord[]) => { saved = structuredClone(rows); } };
  const service = new LocalWorkflowWorkspaces(storage, folder, 'bg-'); await service.start();
  const request: WorkflowWorkspaceRequest = { runId: 'run-original', projectId: 'CFP-001', attemptId: 'retry-one', access: 'editworktree',
    integration: { ...defaultIntegration(), projectPath: repo, allowImplementation: true, worktreeFolder: join(folder, 'worktrees') } };
  return { folder, repo, original, current, service, request, saved: () => structuredClone(saved), storage };
}
it('creates a fresh worker workspace at the reviewed original base even after the source branch advanced', async () => {
  const f = await fixture(); const lease = await f.service.acquire({ ...f.request, baseCommit: f.original });
  try {
    expect(await readFile(join(lease.cwd, 'game.txt'), 'utf8')).toBe('original base\n');
    expect((await agentGit(lease.cwd, ['rev-parse', 'HEAD'])).trim()).toBe(f.original);
    expect(f.saved()[0]?.baseCommit).toBe(f.original);
    await writeFile(join(lease.cwd, 'game.txt'), 'continued reviewed work\n');
    const capture = await lease.capture('Pinned continuation');
    expect(capture?.diff).toContain('-original base'); expect(capture?.diff).not.toContain('-new main head');
    expect(await readFile(join(f.repo, 'game.txt'), 'utf8')).toBe('new main head\n');
    expect((await agentGit(f.repo, ['rev-parse', 'HEAD'])).trim()).toBe(f.current);
  } finally { await lease.release(); }
}, 20000);
it('materializes a reviewed operator resource in the primary foreground mode without granting ordinary callers base authority', async () => {
  const f = await fixture(); const foreground = new LocalWorkflowWorkspaces(f.storage, f.folder); await foreground.start();
  const request = { ...f.request, attemptId: 'operator-copy', baseCommit: f.original, workspaceEpoch: 'operator-copy', operatorMaterializationId: 'operator-copy' };
  const lease = await foreground.materializeReviewed(request);
  expect(lease.id).not.toMatch(/^bg-/u); expect(await readFile(join(lease.cwd, 'game.txt'), 'utf8')).toBe('original base\n');
  await lease.release();
  expect(f.saved()[0]).toMatchObject({ operatorMaterializationId: 'operator-copy', workspaceEpoch: 'operator-copy', baseCommit: f.original, phase: 'ready' });
  const modelLease = await foreground.acquire({ ...f.request, attemptId: 'real-next-attempt', workspaceId: lease.id });
  expect(modelLease.cwd).toBe(lease.cwd); await modelLease.release();
  await expect(foreground.acquire({ ...f.request, runId: 'authored-run', workspaceEpoch: 'authored', baseCommit: f.original })).rejects.toThrow();
  await expect(foreground.materializeReviewed({ ...request, runId: 'another-run', workspaceEpoch: 'mismatched' })).rejects.toThrow();
  expect(f.saved()).toHaveLength(1); expect(await readFile(join(f.repo, 'game.txt'), 'utf8')).toBe('new main head\n');
}, 20000);
it('rejects invalid or missing pins before reservation and preserves the clean-repository guard', async () => {
  const f = await fixture();
  for (const baseCommit of ['HEAD', '--all', '../foreign', 'f'.repeat(40)]) await expect(f.service.acquire({ ...f.request, baseCommit })).rejects.toThrow();
  expect(f.saved()).toEqual([]); await expect(access(f.request.integration.worktreeFolder)).rejects.toThrow();
  await writeFile(join(f.repo, 'uncommitted.txt'), 'Preserved dirty source');
  await expect(f.service.acquire({ ...f.request, baseCommit: f.original })).rejects.toThrow('uncommitted');
  expect(f.saved()).toEqual([]); expect(await readFile(join(f.repo, 'uncommitted.txt'), 'utf8')).toBe('Preserved dirty source');
}, 20000);
it('keeps ordinary HEAD behavior and refuses changing an existing worker workspace base', async () => {
  const f = await fixture(); const ordinary = await f.service.acquire(f.request);
  expect(f.saved()[0]?.baseCommit).toBe(f.current); await ordinary.release();
  const before = f.saved();
  await expect(f.service.acquire({ ...f.request, attemptId: 'retry-two', workspaceId: ordinary.id, baseCommit: f.original })).rejects.toThrow();
  expect(f.saved()).toEqual(before);
  const continued = await f.service.acquire({ ...f.request, attemptId: 'retry-two', workspaceId: ordinary.id, baseCommit: f.current });
  await continued.release();
  const foreground = new LocalWorkflowWorkspaces(f.storage, f.folder); await foreground.start();
  await expect(foreground.acquire({ ...f.request, runId: 'another-run', baseCommit: f.original })).rejects.toThrow();
}, 20000);
it('keeps separate reviewed retry epochs in one logical run without adopting or replacing the old tree', async () => {
  const f = await fixture();
  const first = await f.service.acquire({ ...f.request, baseCommit: f.original, workspaceEpoch: 'approval-one' });
  await writeFile(join(first.cwd, 'game.txt'), 'retained first retry\n'); await first.release();
  const old = f.saved()[0];
  const second = await f.service.acquire({ ...f.request, attemptId: 'retry-two', baseCommit: f.original, workspaceEpoch: 'approval-two' });
  expect(second.id).not.toBe(first.id); expect(second.cwd).not.toBe(first.cwd);
  expect(await readFile(join(first.cwd, 'game.txt'), 'utf8')).toBe('retained first retry\n');
  expect(await readFile(join(second.cwd, 'game.txt'), 'utf8')).toBe('original base\n');
  expect(f.saved()[0]).toEqual(old); expect(f.saved().map(row => row.workspaceEpoch)).toEqual(['approval-one', 'approval-two']);
  await second.release();
  const restored = new LocalWorkflowWorkspaces(f.storage, f.folder, 'bg-'); await restored.start();
  const next = await restored.acquire({ ...f.request, attemptId: 'read-current', workspaceId: second.id });
  expect(next.cwd).toBe(second.cwd); await next.release();
  await expect(restored.acquire({ ...f.request, attemptId: 'wrong-epoch', workspaceId: first.id, workspaceEpoch: 'approval-two' })).rejects.toThrow();
  await expect(restored.acquire({ ...f.request, runId: 'foreign-run', attemptId: 'foreign-attempt', workspaceId: first.id })).rejects.toThrow();
  const unscoped = new LocalWorkflowWorkspaces(f.storage, f.folder); await unscoped.start();
  await expect(unscoped.acquire({ ...f.request, runId: 'another-run', workspaceEpoch: 'approval-three' })).rejects.toThrow();
}, 20000);
it('captures a host tree hash and refuses a binary mutation even when the visible diff stays unchanged', async () => {
  const f = await fixture(); const lease = await f.service.acquire(f.request);
  await writeFile(join(lease.cwd, 'asset.bin'), Buffer.from([0, 1, 2, 3]));
  const captured = await lease.capture('Reviewed binary'); expect(captured?.snapshotHash).toMatch(/^[a-f0-9]{64}$/u);
  if (!captured || !lease.id) throw new Error('Binary review fixture missing its attributed resource');
  await lease.release(); await f.service.assertReviewable(lease.id, captured);
  const legacy = { ...captured }; delete legacy.snapshotHash; await f.service.assertReviewable(lease.id, legacy); expect(legacy.snapshotHash).toBeUndefined();
  await writeFile(join(lease.cwd, 'asset.bin'), Buffer.from([0, 4, 5, 6]));
  await expect(f.service.assertReviewable(lease.id, captured)).rejects.toThrow('changed');
  expect(await readFile(join(lease.cwd, 'asset.bin'))).toEqual(Buffer.from([0, 4, 5, 6]));
}, 60000);
