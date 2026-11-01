import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { nativePolishFixture } from './polishing-code-native-fixture';
import { ReviewedResourceMaterializer } from '../../../infrastructure/coforge/background-build-seed/materialize';
import { durableReadWorkspace } from '../../../infrastructure/coforge/durable-worker/read-workspace';
import { workflowWorkspaceRecordsCheck } from '../../../infrastructure/coforge/workflow-workspace-check';
import { defaultIntegration } from '../../../features/coforge/domain/seed';
import { PolishingCopyRetainedError } from '../../../features/coforge/application/polishing-ports';
import { operatorRecordName, operatorResourceFiles } from '../../../infrastructure/coforge/background-build-seed/operator-record';
import { RetrySeedStore, retrySeedDirectory } from '../../../infrastructure/coforge/background-build-seed/store';
import { inputHash } from '../../../infrastructure/coforge/durable-worker/protocol';
import { BackgroundBuildRetryResources } from '../../../infrastructure/coforge/background-build-retry-resources';
const folders: string[] = [];
afterEach(async () => { for (const path of folders.splice(0)) await rm(path, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
it.each(['foreground', 'background'] as const)('materializes an idempotent %s primary resource without a fake provider job or changing either source', async mode => {
  const f = await nativePolishFixture(folders, mode); const primaryBefore = JSON.stringify((await f.storage.load()).find(item => item.id === f.lease.id));
  const auxBefore = JSON.stringify(await f.files.read('workspaces.json'));
  const spaces = mode === 'foreground' ? f.workspaces : f.workerSpaces;
  const materializer = new ReviewedResourceMaterializer(f.privateDirectory, spaces, mode === 'background' ? f.files : undefined);
  const binding = await materializer.materialize(f.apply, []); expect(binding).toMatchObject({ id: f.apply.id, ownerRunId: f.source.runId, mode, workspaceEpoch: f.apply.id });
  expect(binding.workspaceId).not.toBe(f.lease.id); expect(binding.workspaceId).not.toBe(f.done.workspaceId); expect(binding.workspaceId.startsWith('bg-')).toBe(mode === 'background');
  expect(await readFile(join(binding.increment.worktree!, 'game.ts'), 'utf8')).toBe('polished current code\n');
  expect(await materializer.materialize(f.apply, [])).toEqual(binding); expect(f.store.all()).toHaveLength(1); expect(f.capture).toHaveBeenCalledOnce();
  expect(JSON.stringify((await f.storage.load()).find(item => item.id === f.lease.id))).toBe(primaryBefore);
  expect(await readFile(join(f.lease.cwd, 'game.ts'), 'utf8')).toBe('reviewed partial\n');
  const aux = workflowWorkspaceRecordsCheck(await f.files.read('workspaces.json')).find(item => item.id === f.done.workspaceId)!;
  expect(await readFile(join(aux.cwd, 'game.ts'), 'utf8')).toBe('polished current code\n');
  if (mode === 'foreground') {
    expect(JSON.stringify(await f.files.read('workspaces.json'))).toBe(auxBefore);
    const next = await spaces.acquire({ runId: f.source.runId, projectId: f.source.projectId, attemptId: 'next-real-attempt', workspaceId: binding.workspaceId, access: 'editworktree',
      integration: { ...defaultIntegration(), projectPath: f.project, worktreeFolder: join(f.root, 'unused'), allowImplementation: true } });
    expect(next.cwd).toBe(binding.increment.worktree); await next.release();
  } else {
    const lease = await durableReadWorkspace(f.files, { runId: f.source.runId, projectId: f.source.projectId, attemptId: 'readonly', workspaceId: binding.workspaceId, access: 'readproject',
      integration: { ...defaultIntegration(), projectPath: f.project } }, (id, expected) => spaces.assertReviewable(id, expected));
    expect(lease.readOnly).toBe(true); expect(lease.cwd).toBe(binding.increment.worktree); await lease.release();
  }
}, 90000);
it('refuses an apply when the original primary bytes changed after the polishing seed was captured', async () => {
  const f = await nativePolishFixture(folders, 'foreground'); const before = JSON.stringify(await f.storage.load());
  await writeFile(join(f.lease.cwd, 'game.ts'), 'new human work after polishing started');
  const materializer = new ReviewedResourceMaterializer(f.privateDirectory, f.workspaces);
  await expect(materializer.materialize(f.apply, [])).rejects.toThrow();
  expect(JSON.stringify(await f.storage.load())).toBe(before); expect(await readFile(join(f.lease.cwd, 'game.ts'), 'utf8')).toBe('new human work after polishing started');
  expect(f.capture).toHaveBeenCalledOnce(); expect(f.store.all()).toHaveLength(1);
}, 90000);
it('retains a proven stopped mid-copy failure and permits only a new explicit epoch without another provider call', async () => {
  const f = await nativePolishFixture(folders, 'foreground'); const original = f.workspaces.materializeReviewed.bind(f.workspaces);
  vi.spyOn(f.workspaces, 'materializeReviewed').mockImplementationOnce(async request => {
    const lease = await original(request); let checks = 0;
    return { ...lease, validate: async () => { await lease.validate?.(); if (++checks === 3) throw new Error('Controlled copy phase failure'); } };
  });
  const materializer = new ReviewedResourceMaterializer(f.privateDirectory, f.workspaces);
  await expect(materializer.materialize(f.apply, [])).rejects.toBeInstanceOf(PolishingCopyRetainedError);
  const ledger = operatorResourceFiles(f.privateDirectory); await ledger.attach(); const retained = await ledger.read(operatorRecordName(f.apply.id));
  expect(retained).toMatchObject({ state: 'attention', copyStopped: true }); expect(retained).not.toHaveProperty('binding');
  const failed = (await f.storage.load()).find(record => record.operatorMaterializationId === f.apply.id)!;
  expect(failed.phase).toBe('retired'); expect(failed.activeAttemptId).toBeUndefined();
  await expect(materializer.materialize(f.apply, [])).rejects.toBeInstanceOf(PolishingCopyRetainedError);
  const next = { ...f.apply, id: 'explicit-new-copy', target: { ...f.apply.target, workspaceEpoch: 'explicit-new-copy' } };
  const binding = await materializer.materialize(next, []); expect(binding.workspaceId).not.toBe(failed.id);
  expect(await readFile(join(f.lease.cwd, 'game.ts'), 'utf8')).toBe('reviewed partial\n'); expect(f.capture).toHaveBeenCalledOnce(); expect(f.store.all()).toHaveLength(1);
}, 120000);
it('does not classify a copying or unknown receipt as settled or replay its writes', async () => {
  const f = await nativePolishFixture(folders, 'foreground'); const seeds = new RetrySeedStore(retrySeedDirectory(f.privateDirectory)); const seed = await seeds.read(f.apply.reviewedSnapshot);
  const ledger = operatorResourceFiles(f.privateDirectory); await ledger.initialize();
  await ledger.create(operatorRecordName(f.apply.id), { version: 1, request: f.apply, requestHash: inputHash({ request: f.apply, protectedProjectPaths: [] }),
    protectedProjectPaths: [], baseCommit: seed.manifest.identity.baseCommit, state: 'copying', workspaceId: 'unknown-copy-target' });
  const before = JSON.stringify(await f.storage.load()); const materializer = new ReviewedResourceMaterializer(f.privateDirectory, f.workspaces);
  try { await materializer.materialize(f.apply, []); throw new Error('The unknown copy unexpectedly completed'); }
  catch (error) { expect(error).not.toBeInstanceOf(PolishingCopyRetainedError); expect(error).toBeInstanceOf(Error); expect((error instanceof Error ? error.message : '')).toContain('incomplete or unknown'); }
  expect(JSON.stringify(await f.storage.load())).toBe(before); expect(f.capture).toHaveBeenCalledOnce();
}, 90000);
it('keeps operator resource ownership separate from an actual acquired writer and an unpaid pre-acquire failure', async () => {
  const f = await nativePolishFixture(folders, 'foreground'); const materializer = new ReviewedResourceMaterializer(f.privateDirectory, f.workspaces); const binding = await materializer.materialize(f.apply, []);
  const resources = new BackgroundBuildRetryResources({ storage: f.storage, privateDirectory: f.privateDirectory, vaultDirectory: f.vault, protectedVaultFolders: () => [], assertReady: async () => {} });
  const source = { projectId: f.source.projectId, ideaId: f.source.ideaId, runId: f.source.runId, runRevision: 8, proposalRevision: f.source.proposalRevision, stepId: f.source.stepId,
    sourceKind: 'workspace' as const, sourceWorkspaceId: binding.workspaceId, sourceMaterializationId: binding.id, projectPath: f.project, expectedIncrement: binding.increment,
    executorJobId: 'failed-before-acquisition', executorAttemptId: 'never-acquired' };
  expect(await resources.inspect(source)).toMatchObject({ sourceWorkspaceId: binding.workspaceId, humanCessationRequired: true });
  const lease = await f.workspaces.acquire({ runId: f.source.runId, projectId: f.source.projectId, attemptId: 'actual-writer', workspaceId: binding.workspaceId, access: 'editworktree',
    integration: { ...defaultIntegration(), projectPath: f.project, allowImplementation: true } });
  await writeFile(join(lease.cwd, 'game.ts'), 'new partial changes from the actual writer'); const increment = await lease.capture('Actual later writer'); await lease.release();
  const actual = { ...source, executorJobId: 'failed-without-leasing-after-writer', executorAttemptId: 'unpaid-latest', expectedIncrement: increment,
    executorCandidates: [{ jobId: 'actual-writer-job', attemptId: 'actual-writer' }, { jobId: 'failed-without-leasing-after-writer', attemptId: 'unpaid-latest' }] };
  expect(await resources.inspect(actual)).toMatchObject({ sourceWorkspaceId: binding.workspaceId, humanCessationRequired: true });
  await expect(resources.inspect({ ...actual, executorCandidates: [{ jobId: 'unrelated-job', attemptId: 'unrelated-attempt' }] })).rejects.toThrow();
  expect(f.capture).toHaveBeenCalledOnce(); expect(await readFile(join(f.lease.cwd, 'game.ts'), 'utf8')).toBe('reviewed partial\n');
}, 120000);
