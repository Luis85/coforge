import { link, readFile, readdir, rm, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import { expect, it } from 'vitest';
import { retrySourceFixture } from './background-build-retry-native-fixture';
import { durableRequest } from './durable-worker-fixture';
import { createDurableBuildClient } from '../../../infrastructure/coforge/durable-build-client';
import { nativeIdentityCheck } from '../../../infrastructure/coforge/durable-worker/store';
import { stopOwnedProcessTree, type NativeProcessIdentity } from '../../../infrastructure/coforge/durable-worker/process-identity';
import { inputHash } from '../../../infrastructure/coforge/durable-worker/protocol';
import { record } from '../../../features/coforge/domain/check';
import type { BackgroundBuildRetrySource } from '../../../features/coforge/domain/background-build-retry';
import type { PolishingCodeApplyRequest } from '../../../features/coforge/application/polishing-ports';
import { PolishingCopyRetainedError } from '../../../features/coforge/application/polishing-ports';

async function cleanup(identity: NativeProcessIdentity | undefined, folders: string[], failure: unknown) {
  const errors: unknown[] = [];
  if (identity) {
    try { const proof = await stopOwnedProcessTree(identity); if (!proof.treeConfirmed && proof.state !== 'absent' && proof.state !== 'different') errors.push(new Error('The contained operator worker could not be stopped safely')); }
    catch (error) { errors.push(error); }
  }
  if (!errors.length) for (const folder of folders) await rm(folder, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  if (errors.length) throw new AggregateError([...(failure ? [failure] : []), ...errors], 'Contained worker cleanup failed; evidence retained.');
}
it('copies reviewed auxiliary code through authenticated native RPC and preserves source/operator provenance without another provider call', async () => {
  const folders: string[] = []; const f = await retrySourceFixture(folders); let identity: NativeProcessIdentity | undefined; let failure: unknown;
  const path = (file: string) => JSON.stringify(resolve('src/plugin/infrastructure/coforge', file).replaceAll('\\', '/'));
  try {
    const bundle = await build({ stdin: { contents: `import{main}from${path('durable-worker/runtime.ts')};import{nativeBuildExecutor}from${path('durable-worker/native-provider.ts')};
      import{workflowWorkspaceRecordsCheck}from${path('workflow-workspace-check.ts')};import{appendFile,writeFile}from'node:fs/promises';import{join}from'node:path';
      setTimeout(()=>process.exit(0),180000).unref();void main(process.argv[3],undefined,(store,spaces)=>nativeBuildExecutor(store,spaces,(files)=>async()=>{
        const input=await files.read('input.json');await appendFile(join(process.argv[3],'fake-provider-count.txt'),input.jobId+'\\n');
        const rows=workflowWorkspaceRecordsCheck(await store.files.read('workspaces.json'));const row=rows.find(x=>x.activeAttemptId===input.attemptId);
        await writeFile(join(row.cwd,'game.ts'),'polished by the contained worker\\n');
        return JSON.stringify({type:'result',subtype:'success',is_error:false,structured_output:{summary:'Native fixture polished current code'}});
      }));`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', target: 'node22', write: false, logLevel: 'silent' });
    const client = createDurableBuildClient({ privateDirectory: f.privateDirectory, workerSource: bundle.outputFiles[0]!.text, nodeExecutable: process.execPath,
      vaultDirectory: f.vault, protectedVaultFolders: () => [] });
    f.source.sourceIdentity = inputHash({ currentResult: 'original primary code' }); const resources = client.retryResources(f.storage);
    const baseline = await resources.inspect(f.source); const target = { kind: 'improvement' as const, runId: 'aux-native', retryId: 'polish-native', jobId: 'aux-native-job', attemptId: 'aux-native-attempt' };
    await resources.verify(f.source, baseline.snapshot, target);
    const request = durableRequest(); request.projectId = request.input.idea.projectId = f.source.projectId; request.ideaId = request.input.idea.id = f.source.ideaId;
    request.runId = request.input.workflow.runId = target.runId; request.jobId = request.input.jobId = target.jobId; request.attemptId = request.input.workflow.attemptId = target.attemptId;
    request.input.workflow.proposalRevision = f.source.proposalRevision; request.input.workflow.polishingId = target.retryId; request.input.workflow.polishingSourceHash = f.source.sourceIdentity; request.input.workflow.sourceRunId = f.source.runId;
    request.input.integration.projectPath = f.project; request.input.integration.worktreeFolder = join(f.root, 'worker-trees'); request.reviewedSnapshot = baseline.snapshot;
    const ref = await client.prepare(request); const daemon = record(JSON.parse(await readFile(join(f.privateDirectory, 'daemon.json'), 'utf8'))); identity = nativeIdentityCheck(daemon.identity);
    await client.start(ref); await expect.poll(async () => (await client.inspect(ref)).phase, { timeout: 45000 }).toBe('completed'); const done = await client.inspect(ref); await client.acknowledge(ref, done.sequence);
    const source: BackgroundBuildRetrySource = { ...f.source, runId: target.runId, runRevision: 1, sourceJobId: target.jobId, sourceAttemptId: target.attemptId,
      sourceWorkspaceId: done.workspaceId, expectedIncrement: done.increment, sourceIdentity: inputHash(done.result) };
    const reviewed = await resources.inspect(source);
    const apply: PolishingCodeApplyRequest = { id: 'native-resource-apply', projectId: request.projectId, ideaId: request.ideaId, source, reviewedSnapshot: reviewed.snapshot, baseline: baseline.snapshot,
      evidenceHash: reviewed.evidenceHash, sourceArtifactHash: inputHash(done.result), target: { runId: f.source.runId, mode: 'background', workspaceEpoch: 'native-resource-apply',
        projectPath: f.project, worktreeFolder: join(f.root, 'primary-trees') } };
    const native = client.polishingResources(f.workspaces, f.storage);
    const faultFolder = join(f.root, 'fault-primary-trees'); const fault = { ...apply, id: 'controlled-failed-copy',
      target: { ...apply.target, workspaceEpoch: 'controlled-failed-copy', worktreeFolder: faultFolder } };
    const failed = native.materialize(fault).then(() => { throw new Error('The controlled failed copy unexpectedly completed'); }, error => error);
    let copiedGame = '';
    await expect.poll(async () => {
      const directories = await readdir(faultFolder).catch(() => []); if (!directories.length) return false;
      copiedGame = join(faultFolder, directories[0]!, 'game.ts'); return readFile(copiedGame).then(() => true, () => false);
    }, { timeout: 45000, interval: 20 }).toBe(true);
    await unlink(copiedGame); await link(join(f.project, 'game.ts'), copiedGame);
    expect(await failed).toBeInstanceOf(PolishingCopyRetainedError);
    const binding = await native.materialize(apply);
    expect(binding.workspaceId.startsWith('bg-')).toBe(true); expect(binding.workspaceId).not.toBe(done.workspaceId); expect(binding.ownerRunId).toBe(f.source.runId);
    expect(await readFile(join(binding.increment.worktree!, 'game.ts'), 'utf8')).toBe('polished by the contained worker\n');
    await client.assertReviewable(binding.workspaceId, binding.increment); expect(await native.materialize(apply)).toEqual(binding);
    expect(await readFile(join(f.privateDirectory, 'fake-provider-count.txt'), 'utf8')).toBe(target.jobId + '\n');
    expect(await readFile(join(f.lease.cwd, 'game.ts'), 'utf8')).toBe('reviewed partial\n');
    expect((await stopOwnedProcessTree(identity)).treeConfirmed).toBe(true); identity = undefined;
    expect(await client.readiness()).toMatchObject({ ready: true, reviewedSnapshots: true });
    const queued = durableRequest(); queued.projectId = queued.input.idea.projectId = f.source.projectId; queued.ideaId = queued.input.idea.id = f.source.ideaId;
    queued.jobId = queued.input.jobId = 'unpaid-after-retirement'; queued.runId = queued.input.workflow.runId = 'future-workflow'; queued.attemptId = queued.input.workflow.attemptId = 'future-attempt';
    queued.input.integration.projectPath = f.project; queued.input.integration.worktreeFolder = join(f.root, 'future-trees');
    const future = await client.prepare(queued);
    const nextDaemon = record(JSON.parse(await readFile(join(f.privateDirectory, 'daemon.json'), 'utf8'))); identity = nativeIdentityCheck(nextDaemon.identity);
    expect(future.workerId).not.toBe(ref.workerId);
    await client.assertReviewable(binding.workspaceId, binding.increment);
  } catch (error) { failure = error; throw error; }
  finally { await cleanup(identity, folders, failure); }
}, 150000);
