import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { vi } from 'vitest';
import { retrySourceFixture } from './background-build-retry-native-fixture';
import { durableRequest } from './durable-worker-fixture';
import { WorkerFiles } from '../../../infrastructure/coforge/durable-worker/files';
import { WorkerStore } from '../../../infrastructure/coforge/durable-worker/store';
import { WorkerService } from '../../../infrastructure/coforge/durable-worker/service';
import { nativeBuildExecutor } from '../../../infrastructure/coforge/durable-worker/native-provider';
import { workerWorkspaces } from '../../../infrastructure/coforge/durable-worker/workspaces';
import { workflowWorkspaceRecordsCheck } from '../../../infrastructure/coforge/workflow-workspace-check';
import { BackgroundBuildRetryResources } from '../../../infrastructure/coforge/background-build-retry-resources';
import { inputHash } from '../../../infrastructure/coforge/durable-worker/protocol';
import type { workerCapture } from '../../../infrastructure/coforge/durable-worker/process';
import type { BackgroundBuildRetrySource } from '../../../features/coforge/domain/background-build-retry';
import type { PolishingCodeApplyRequest } from '../../../features/coforge/application/polishing-ports';
export async function nativePolishFixture(folders: string[], mode: 'foreground' | 'background', options: { ignored?: boolean; binary?: boolean } = {}) {
  const f = await retrySourceFixture(folders); f.source.sourceIdentity = inputHash({ currentCode: 'original reviewed primary result' });
  if (options.ignored) { await writeFile(join(f.lease.cwd, '.gitignore'), 'ignored.txt\n'); await writeFile(join(f.lease.cwd, 'ignored.txt'), 'Reviewed ignored source'); }
  if (options.binary) await writeFile(join(f.lease.cwd, 'game.bin'), Buffer.from([0, 1, 2]));
  const baseline = await f.resources.inspect(f.source); const target = { kind: 'improvement' as const, runId: 'aux-code-pass', retryId: 'polish-one', jobId: 'polish-job', attemptId: 'polish-attempt' };
  await f.resources.verify(f.source, baseline.snapshot, target);
  const request = durableRequest(); request.projectId = request.input.idea.projectId = f.source.projectId; request.ideaId = request.input.idea.id = f.source.ideaId;
  request.runId = request.input.workflow.runId = target.runId; request.jobId = request.input.jobId = target.jobId; request.attemptId = request.input.workflow.attemptId = target.attemptId;
  request.input.workflow.proposalRevision = f.source.proposalRevision; request.input.workflow.step.id = 'code-polish';
  request.input.workflow.polishingId = target.retryId; request.input.workflow.polishingSourceHash = f.source.sourceIdentity; request.input.workflow.sourceRunId = f.source.runId;
  request.input.integration.projectPath = f.project; request.input.integration.worktreeFolder = join(f.root, 'aux-worktrees'); request.reviewedSnapshot = baseline.snapshot;
  const files = new WorkerFiles(f.privateDirectory); const store = new WorkerStore(files, 'polishing-worker'); await store.initialize(); const workerSpaces = workerWorkspaces(files); await workerSpaces.start();
  const capture = vi.fn(async () => {
    const rows = workflowWorkspaceRecordsCheck(await files.read('workspaces.json')); const row = rows.find(item => item.activeAttemptId === target.attemptId)!;
    if (await readFile(join(row.cwd, 'game.ts'), 'utf8') !== 'reviewed partial\n') throw new Error('Polishing did not receive the reviewed seed');
    if (options.ignored) {
      if (await readFile(join(row.cwd, 'ignored.txt'), 'utf8') !== 'Reviewed ignored source') throw new Error('The provider did not receive the ignored reviewed file');
      await writeFile(join(row.cwd, 'ignored.txt'), 'Polished ignored source bytes');
    }
    await writeFile(join(row.cwd, 'game.ts'), 'polished current code\n');
    return JSON.stringify({ type: 'result', subtype: 'success', is_error: false, structured_output: { summary: 'Polished the current code' } });
  });
  const factory: typeof workerCapture = () => capture; const service = new WorkerService(store, nativeBuildExecutor(store, workerSpaces, factory));
  const ref = await service.prepare(request); await service.start(ref); await service.settle(); const done = service.inspect(ref);
  if (done.phase !== 'completed' || !done.workspaceId) throw new Error('The contained native polishing fixture failed');
  await service.acknowledge(ref, done.sequence);
  const source: BackgroundBuildRetrySource = { projectId: request.projectId, ideaId: request.ideaId, runId: request.runId, runRevision: 1, proposalRevision: f.source.proposalRevision,
    stepId: request.input.workflow.step.id, sourceKind: 'workspace', sourceJobId: request.jobId, sourceAttemptId: request.attemptId, sourceWorkspaceId: done.workspaceId,
    projectPath: f.project, expectedIncrement: done.increment, sourceIdentity: inputHash({ result: done.result }) };
  const sourceResources = new BackgroundBuildRetryResources({ storage: { load: async () => workflowWorkspaceRecordsCheck(await files.read('workspaces.json')), save: async () => { throw new Error('No aux journal edits'); } },
    privateDirectory: f.privateDirectory, vaultDirectory: f.vault, protectedVaultFolders: () => [], assertReady: async () => {} });
  const reviewed = await sourceResources.inspect(source);
  const apply: PolishingCodeApplyRequest = { id: 'operator-copy', projectId: f.source.projectId, ideaId: f.source.ideaId, source, reviewedSnapshot: reviewed.snapshot,
    baseline: baseline.snapshot, evidenceHash: reviewed.evidenceHash, sourceArtifactHash: inputHash(done.result),
    target: { runId: f.source.runId, mode, workspaceEpoch: 'operator-copy', projectPath: f.project, worktreeFolder: join(f.root, 'primary-resource-copies') } };
  return { ...f, files, store, workerSpaces, service, capture, apply, done, reviewed };
}
