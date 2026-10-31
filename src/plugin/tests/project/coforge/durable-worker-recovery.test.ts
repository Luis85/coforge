import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { defaultIntegration } from '../../../features/coforge/domain/seed';
import { WorkerFiles } from '../../../infrastructure/coforge/durable-worker/files';
import { WorkerStore, workerSnapshot } from '../../../infrastructure/coforge/durable-worker/store';
import { WorkerRecovery, retainedJob, supervisorGone, type RecoveryProofDriver } from '../../../infrastructure/coforge/durable-worker/recovery';
import { workerWorkspaces } from '../../../infrastructure/coforge/durable-worker/workspaces';
import { agentGit } from '../../../infrastructure/coforge/agent-worktree';
import type { NativeProcessIdentity } from '../../../infrastructure/coforge/durable-worker/process-identity';
import { durableRequest } from './durable-worker-fixture';

const folders: string[] = [];
afterEach(async () => { for (const path of folders.splice(0)) await rm(path, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
async function fixture() {
  await mkdir(resolve('.nq'), { recursive: true });
  const root = await realpath(await mkdtemp(join(resolve('.nq'), 'worker-recovery-'))); folders.push(root);
  const project = join(root, 'game'); await mkdir(project); await writeFile(join(project, 'game.ts'), 'export const radius = 1;\n');
  await agentGit(project, ['init', '--initial-branch=main']); await agentGit(project, ['add', '--all']);
  await agentGit(project, ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--no-gpg-sign', '-m', 'Fixture']);
  const files = new WorkerFiles(join(root, 'private')); const store = new WorkerStore(files, 'worker-one'); await store.initialize();
  const request = durableRequest(); request.input.integration.projectPath = project; request.input.integration.worktreeFolder = join(root, 'worktrees');
  const ref = await store.prepare(request); const workspaces = workerWorkspaces(files); await workspaces.start();
  const lease = await workspaces.acquire({ runId: request.runId, attemptId: request.attemptId, projectId: request.projectId, access: 'editworktree', integration: { ...defaultIntegration(), ...request.input.integration } });
  await writeFile(join(lease.cwd, 'game.ts'), 'export const radius = 2;\n');
  const increment = await lease.capture('Captured model change'); expect(increment?.files).toHaveLength(1);
  await lease.release(true);
  const identity: NativeProcessIdentity = { pid: 1234567, platform: process.platform, birth: 'provider-birth', image: 'a'.repeat(64) };
  await files.write('daemon.json', { workerId: ref.workerId, identity: { ...identity, pid: 1234568, birth: 'supervisor-birth' } });
  await store.update(ref, record => { record.snapshot.phase = 'attention'; record.snapshot.workspaceId = lease.id; record.snapshot.increment = increment; record.startIntent = true; record.terminationUnknown = true;
    record.provider = { pid: identity.pid, launchId: 'owned-launch', startedAt: new Date().toISOString(), identity }; });
  const proof: RecoveryProofDriver = { read: vi.fn(async () => undefined), stop: vi.fn(async () => ({ state: 'terminated' as const, treeConfirmed: true, observedAt: new Date().toISOString() })) };
  return { files, store, ref, request, workspaces, lease, increment, identity, proof, recovery: new WorkerRecovery(files, undefined, proof) };
}
it('binds consent to actual retained changes, clears a reverted preview, and records termination before releasing ownership', async () => {
  const f = await fixture(); const first = await f.recovery.inspect(f.ref); expect(first.snapshot.increment?.files).toHaveLength(1);
  await writeFile(join(f.lease.cwd, 'game.ts'), 'export const radius = 1;\n');
  await expect(f.recovery.recover(f.ref, true, 500, first.evidenceHash)).rejects.toThrow('changed after inspection');
  expect(f.proof.stop).not.toHaveBeenCalled();
  const empty = await f.recovery.inspect(f.ref); expect(empty.evidenceHash).not.toBe(first.evidenceHash);
  expect(empty.snapshot).toMatchObject({ workspaceCaptured: true }); expect(empty.snapshot.increment).toBeUndefined();
  const cancelled = await f.recovery.recover(f.ref, true, 500, empty.evidenceHash);
  expect(cancelled).toMatchObject({ phase: 'cancelled', sequence: 501, workspaceCaptured: true }); expect(cancelled.increment).toBeUndefined();
  const job = await retainedJob(f.files, f.ref); expect(await job.files.read('termination.json')).toMatchObject({ ref: f.ref, provider: f.identity, treeConfirmed: true });
  await f.recovery.acknowledge(f.ref, cancelled.sequence); expect((await retainedJob(f.files, f.ref)).record.acknowledgedSequence).toBe(501);
  const records = await f.files.read('workspaces.json'); expect(records).toEqual(expect.arrayContaining([expect.objectContaining({ phase: 'ready', lastAttemptId: 'attempt-one' })]));
}, 30000);
it('preserves an original terminal result and sequence through a lost ACK while separately attesting the actual empty workspace', async () => {
  const f = await fixture();
  await f.store.update(f.ref, record => { record.snapshot.phase = 'completed'; record.snapshot.result = { summary: 'Original result', increment: f.increment, costUsd: 0.25 }; record.terminationUnknown = false; });
  const original = structuredClone(f.store.get(f.ref).record.snapshot);
  await writeFile(join(f.lease.cwd, 'game.ts'), 'export const radius = 1;\n');
  const inspected = await f.recovery.inspect(f.ref); const recovered = await f.recovery.recover(f.ref, true, original.sequence + 100, inspected.evidenceHash);
  expect(recovered).toMatchObject({ phase: original.phase, sequence: original.sequence, result: original.result, workspaceCaptured: true }); expect(recovered.increment).toBeUndefined();
  const record = (await retainedJob(f.files, f.ref)).record; expect(record.snapshot).toEqual(original); expect(workerSnapshot(record).increment).toBeUndefined();
  expect(f.proof.stop).not.toHaveBeenCalled(); await f.recovery.acknowledge(f.ref, original.sequence);
  const workspaces = workerWorkspaces(f.files); await workspaces.start();
  await expect(workspaces.assertReviewable(f.lease.id!)).resolves.toBeUndefined();
}, 30000);
it('does not inspect an older attempt while another attempt owns its retained workspace', async () => {
  const f = await fixture(); await f.workspaces.acknowledge(f.lease.id!, f.request.attemptId, true);
  const newer = await f.workspaces.acquire({ runId: f.request.runId, attemptId: 'newer-attempt', projectId: f.request.projectId, access: 'editworktree',
    workspaceId: f.lease.id, integration: { ...defaultIntegration(), ...f.request.input.integration } });
  try { await expect(f.recovery.inspect(f.ref)).rejects.toThrow('identity changed'); }
  finally { await newer.release(); }
}, 30000);
it('keeps ambiguous process trees quarantined and rejects foreign-platform supervisor metadata', async () => {
  const f = await fixture(); const stop = vi.fn(async () => ({ state: 'different' as const, treeConfirmed: false, observedAt: new Date().toISOString() }));
  const recovery = new WorkerRecovery(f.files, undefined, { ...f.proof, stop }); const inspected = await recovery.inspect(f.ref);
  const result = await recovery.recover(f.ref, true, 10, inspected.evidenceHash); expect(result.phase).toBe('attention'); expect(stop).toHaveBeenCalledWith(f.identity);
  await expect(recovery.acknowledge(f.ref, result.sequence)).rejects.toThrow('verified recovered terminal');
  await f.files.write('daemon.json', { workerId: f.ref.workerId, identity: { ...f.identity, platform: 'foreign-platform' } });
  expect(await supervisorGone(f.files, f.ref, f.proof)).toBe(false);
}, 30000);
