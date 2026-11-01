import { access, chmod, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { retrySourceFixture } from './background-build-retry-native-fixture';
import { durableRequest } from './durable-worker-fixture';
import { WorkerFiles } from '../../../infrastructure/coforge/durable-worker/files';
import { WorkerStore } from '../../../infrastructure/coforge/durable-worker/store';
import { WorkerService } from '../../../infrastructure/coforge/durable-worker/service';
import { nativeBuildExecutor } from '../../../infrastructure/coforge/durable-worker/native-provider';
import { workerWorkspaces } from '../../../infrastructure/coforge/durable-worker/workspaces';
import { workflowWorkspaceRecordsCheck } from '../../../infrastructure/coforge/workflow-workspace-check';
import { RetrySeedStore, retrySeedDirectory } from '../../../infrastructure/coforge/background-build-seed/store';
import type { workerCapture } from '../../../infrastructure/coforge/durable-worker/process';
import { agentGit } from '../../../infrastructure/coforge/agent-worktree';
const folders: string[] = [];
afterEach(async () => { for (const path of folders.splice(0)) await rm(path, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
async function context(authorized: boolean, configure?: (fixture: Awaited<ReturnType<typeof retrySourceFixture>>) => Promise<void>) {
  const f = await retrySourceFixture(folders); await configure?.(f); const inspection = await f.resources.inspect(f.source);
  const target = { kind: 'retry' as const, runId: f.source.runId, retryId: 'retry', jobId: 'new-job', attemptId: 'new-attempt' };
  if (authorized) await f.resources.verify(f.source, inspection.snapshot, target);
  const request = durableRequest(); request.projectId = request.input.idea.projectId = f.source.projectId; request.ideaId = request.input.idea.id = f.source.ideaId;
  request.runId = request.input.workflow.runId = f.source.runId; request.jobId = request.input.jobId = target.jobId; request.attemptId = request.input.workflow.attemptId = target.attemptId;
  request.input.workflow.proposalRevision = f.source.proposalRevision; request.input.workflow.backgroundRetryId = target.retryId;
  request.input.integration.projectPath = f.project; request.input.integration.worktreeFolder = join(f.root, 'worker-worktrees'); request.reviewedSnapshot = inspection.snapshot;
  const files = new WorkerFiles(f.privateDirectory); const store = new WorkerStore(files, 'new-worker'); await store.initialize();
  return { ...f, request, target, files, store };
}
it('imports the exact approved aggregate before invoking a provider, using a separate pinned workspace epoch', async () => {
  const f = await context(true, async source => {
    await chmod(join(source.lease.cwd, 'game.ts'), 0o755); await agentGit(source.lease.cwd, ['update-index', '--chmod=+x', '--', 'game.ts']);
    await writeFile(join(source.project, 'later.txt'), 'A later repository commit must not reinterpret the reviewed base');
    await agentGit(source.project, ['add', 'later.txt']);
    await agentGit(source.project, ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--no-gpg-sign', '-m', 'Later repository state']);
  }); const prior = JSON.stringify(await f.storage.load());
  const capture = vi.fn(async () => {
    const rows = workflowWorkspaceRecordsCheck(await f.files.read('workspaces.json'));
    expect(rows).toHaveLength(1); const workspace = rows[0]!;
    expect(workspace.id).not.toBe(f.lease.id); expect(workspace.workspaceEpoch).toBe(f.target.retryId); expect(workspace.baseCommit).toBe((await f.storage.load())[0]!.baseCommit);
    expect(await readFile(join(workspace.cwd, 'game.ts'), 'utf8')).toBe('reviewed partial\n');
    expect(await readFile(join(workspace.cwd, 'new.txt'), 'utf8')).toBe('new untracked');
    expect(await readFile(join(workspace.cwd, 'binary.dat'))).toEqual(Buffer.from([0, 9, 8, 7])); await expect(access(join(workspace.cwd, 'removed.txt'))).rejects.toThrow();
    await expect(access(join(workspace.cwd, 'later.txt'))).rejects.toThrow();
    if (process.platform === 'win32') {
      expect(await agentGit(workspace.cwd, ['ls-files', '--stage', '--', 'game.ts'])).toMatch(/^100755 /u);
    } else {
      expect((await stat(join(workspace.cwd, 'game.ts'))).mode & 0o111).toBe(0o111);
      expect(await agentGit(workspace.cwd, ['diff', '--summary', 'HEAD', '--', 'game.ts'])).toContain('mode change 100644 => 100755 game.ts');
    }
    return JSON.stringify({ type: 'result', subtype: 'success', is_error: false, structured_output: { summary: 'Continued from the approved files' } });
  });
  const factory: typeof workerCapture = () => capture; const workspaces = workerWorkspaces(f.files); await workspaces.start();
  const service = new WorkerService(f.store, nativeBuildExecutor(f.store, workspaces, factory));
  const ref = await service.prepare(f.request); await service.start(ref); await service.settle();
  // Surface a fake provider's own assertions instead of hiding them behind the worker's safe failure message.
  const invocation = capture.mock.results[0]; if (invocation?.type === 'return') await invocation.value;
  const snapshot = service.inspect(ref);
  expect(snapshot.phase, snapshot.error).toBe('completed'); expect(capture).toHaveBeenCalledOnce();
  expect(JSON.stringify(await f.storage.load())).toBe(prior); expect(await readFile(join(f.lease.cwd, 'game.ts'), 'utf8')).toBe('reviewed partial\n');
}, 90000);
it.each(['unbound', 'corrupt', 'source-drift', 'wrong-target'] as const)('never invokes a provider for %s reviewed snapshot data', async kind => {
  const f = await context(kind !== 'unbound');
  if (kind === 'corrupt') {
    const seeds = new RetrySeedStore(retrySeedDirectory(f.privateDirectory)); const data = await seeds.read(f.request.reviewedSnapshot!);
    const blob = data.manifest.changes.find(entry => entry.hash)!; await writeFile(data.files.path('blob-' + blob.hash), 'corrupted private bytes');
  }
  if (kind === 'source-drift') await writeFile(join(f.lease.cwd, 'game.ts'), 'later unreviewed change');
  if (kind === 'wrong-target') { f.request.jobId = f.request.input.jobId = 'unauthorized-job'; f.request.attemptId = f.request.input.workflow.attemptId = 'unauthorized-attempt'; }
  const capture = vi.fn(async () => ''); const factory: typeof workerCapture = () => capture; const workspaces = workerWorkspaces(f.files); await workspaces.start();
  const service = new WorkerService(f.store, nativeBuildExecutor(f.store, workspaces, factory)); const ref = await service.prepare(f.request);
  await service.start(ref); await service.settle(); expect(service.inspect(ref).phase).toBe('failed'); expect(capture).not.toHaveBeenCalled();
}, 90000);
