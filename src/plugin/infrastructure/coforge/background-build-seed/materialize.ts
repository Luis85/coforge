import { realpath } from 'node:fs/promises';
import type { PolishingCodeApplyRequest } from '../../../features/coforge/application/polishing-ports';
import { PolishingCopyRetainedError } from '../../../features/coforge/application/polishing-ports';
import type { PolishingCodeBinding } from '../../../features/coforge/domain/polishing';
import type { WorkflowWorkspaceLease } from '../../../features/coforge/application/workflow-workspace-ports';
import { defaultIntegration } from '../../../features/coforge/domain/seed';
import { LocalWorkflowWorkspaces } from '../workflow-workspaces';
import { agentGit } from '../agent-worktree';
import { captureWorkflowIncrement } from '../workflow-workspace-capture';
import { WorkerFiles } from '../durable-worker/files';
import { retainedDatasets } from '../durable-worker/authorization';
import { retainedJob } from '../durable-worker/recovery';
import { workerRecordCheck } from '../durable-worker/store';
import { inputHash } from '../durable-worker/protocol';
import { workerRequestCheck } from '../durable-worker/protocol';
import { RetrySeedStore, retrySeedDirectory } from './store';
import { verifyRetrySourceIdentity } from './source';
import { copyReviewedSnapshot } from './import';
import { checkSnapshotPaths, invalidSnapshot } from './tree';
import { operatorRecordCheck, operatorRecordName, operatorResourceFiles, polishingApplyRequestCheck, type OperatorResourceRecord } from './operator-record';
import { completedForegroundPolishing } from './foreground-record';

async function originalPolishSeed(privateDirectory: string, request: PolishingCodeApplyRequest) {
  const source = request.source;
  if (!source.sourceJobId || !source.sourceAttemptId || !source.runId || !source.sourceWorkspaceId) throw invalidSnapshot();
  if (!source.sourceWorkspaceId.startsWith('bg-')) {
    const record = await completedForegroundPolishing(privateDirectory, source);
    if (inputHash(record.baseline) !== inputHash(request.baseline)) throw invalidSnapshot();
    return { jobId: record.jobId, runId: record.runId, attemptId: record.attemptId, polishingId: record.polishingId, sourceHash: record.sourceHash };
  }
  for (const files of await retainedDatasets(new WorkerFiles(privateDirectory))) {
    const ids = await files.read('index.json'); if (ids === undefined) continue; if (!Array.isArray(ids)) throw invalidSnapshot();
    for (const id of ids) {
      if (typeof id !== 'string') throw invalidSnapshot(); const child = new WorkerFiles(files.path(id)); await child.attach();
      if (workerRequestCheck(await child.read('input.json')).jobId !== source.sourceJobId) continue;
      const record = workerRecordCheck(await child.read('record.json'));
      const job = await retainedJob(files, record.snapshot.ref);
      if (job.request.jobId !== source.sourceJobId) continue;
      if (job.request.attemptId !== source.sourceAttemptId || job.request.runId !== source.runId || job.request.ideaId !== request.ideaId || job.request.projectId !== request.projectId ||
        record.snapshot.phase !== 'completed' || record.terminationUnknown || record.snapshot.workspaceId !== source.sourceWorkspaceId || !job.request.input.workflow.polishingId ||
        inputHash(job.request.reviewedSnapshot) !== inputHash(request.baseline)) throw invalidSnapshot();
      return { jobId: job.request.jobId, runId: job.request.runId, attemptId: job.request.attemptId,
        polishingId: job.request.input.workflow.polishingId, sourceHash: job.request.input.workflow.polishingSourceHash };
    }
  }
  throw new Error('The original code polishing admission and baseline are unavailable. Restore their private evidence.');
}
/** Provider-free fresh resource copies have their own receipt; they never fabricate a paid job or alter either source. */
export class ReviewedResourceMaterializer {
  private readonly pending = new Map<string, { hash: string; result: Promise<PolishingCodeBinding> }>();
  constructor(private readonly privateDirectory: string, private readonly workspaces: LocalWorkflowWorkspaces, private readonly generationFiles?: WorkerFiles) {}
  materialize(value: PolishingCodeApplyRequest, protectedProjectPaths: string[]): Promise<PolishingCodeBinding> {
    const request = polishingApplyRequestCheck(value); const hash = inputHash({ request, protectedProjectPaths }); const current = this.pending.get(request.id);
    if (request.target.mode !== (this.generationFiles ? 'background' : 'foreground')) return Promise.reject(new Error('This resource adapter cannot adopt another executor mode.'));
    if (current) { if (current.hash !== hash) return Promise.reject(new Error('This operator copy is already processing different reviewed input.')); return current.result; }
    const result = this.execute(request, protectedProjectPaths).finally(() => { this.pending.delete(request.id); }); this.pending.set(request.id, { hash, result }); return result;
  }
  private async execute(request: PolishingCodeApplyRequest, protectedProjectPaths: string[]): Promise<PolishingCodeBinding> {
    if (request.id !== request.target.workspaceEpoch || request.source.projectId !== request.projectId || request.source.ideaId !== request.ideaId) throw invalidSnapshot();
    const seeds = new RetrySeedStore(retrySeedDirectory(this.privateDirectory)); const source = await seeds.read(request.reviewedSnapshot); const baseline = await seeds.read(request.baseline);
    const original = await originalPolishSeed(this.privateDirectory, request);
    if (inputHash(source.manifest.source) !== inputHash(request.source) || source.manifest.evidenceHash !== request.evidenceHash ||
      source.manifest.identity.baseCommit !== baseline.manifest.identity.baseCommit || source.manifest.identity.projectRoot !== baseline.manifest.identity.projectRoot ||
      baseline.manifest.source.projectId !== request.projectId || baseline.manifest.source.ideaId !== request.ideaId ||
      baseline.manifest.source.runId && baseline.manifest.source.runId !== request.target.runId ||
      !baseline.manifest.source.sourceIdentity || original.sourceHash !== baseline.manifest.source.sourceIdentity) throw invalidSnapshot();
    const authorization = await seeds.authorization(request.baseline, original.polishingId!);
    if (authorization.target.kind !== 'improvement' || authorization.target.jobId !== original.jobId || authorization.target.runId !== original.runId || authorization.target.attemptId !== original.attemptId) throw invalidSnapshot();
    const targetRoot = await realpath((await agentGit(request.target.projectPath, ['rev-parse', '--show-toplevel'])).trim());
    if (targetRoot !== source.manifest.identity.projectRoot) throw invalidSnapshot();
    const protection = [...new Set([...protectedProjectPaths, ...source.manifest.protectedProjectPaths, ...baseline.manifest.protectedProjectPaths])].sort();
    checkSnapshotPaths(source.manifest.changes, protection);
    const checkSources = async () => {
      if ((await verifyRetrySourceIdentity(source.manifest.source, source.manifest.identity)).evidenceHash !== source.manifest.evidenceHash ||
        (await verifyRetrySourceIdentity(baseline.manifest.source, baseline.manifest.identity)).evidenceHash !== baseline.manifest.evidenceHash) throw invalidSnapshot();
    };
    await checkSources();
    const ledger = operatorResourceFiles(this.privateDirectory); await ledger.initialize(); const name = operatorRecordName(request.id);
    const requestHash = inputHash({ request, protectedProjectPaths: protection }); const existingValue = await ledger.read(name);
    if (existingValue !== undefined) {
      const existing = operatorRecordCheck(existingValue);
      if (existing.requestHash !== requestHash) throw new Error('This operator copy identity is already bound to different reviewed input.');
      if (existing.state === 'attention' && existing.copyStopped && !existing.binding && existing.workspaceId) {
        await this.workspaces.acknowledge(existing.workspaceId, request.id, false);
        if (this.generationFiles) await this.generationFiles.write(name, existing);
        throw new PolishingCopyRetainedError();
      }
      if (existing.state !== 'complete' || !existing.binding) throw new Error('The original operator copy is incomplete or unknown. Inspect its retained target before creating a fresh copy intent.');
      await this.workspaces.assertReviewable(existing.binding.workspaceId, existing.binding.increment);
      if (this.generationFiles) await this.generationFiles.write(name, existing);
      return existing.binding;
    }
    let record: OperatorResourceRecord = { version: 1, request, requestHash, protectedProjectPaths: protection, state: 'prepared', baseCommit: source.manifest.identity.baseCommit };
    await ledger.create(name, record); let lease: WorkflowWorkspaceLease | undefined;
    try {
      lease = await this.workspaces.materializeReviewed({ runId: request.target.runId, projectId: request.projectId, attemptId: request.id, access: 'editworktree',
        baseCommit: source.manifest.identity.baseCommit, workspaceEpoch: request.target.workspaceEpoch, operatorMaterializationId: request.id,
        integration: { ...defaultIntegration(), projectPath: request.target.mode === 'background' ? targetRoot : request.target.projectPath, worktreeFolder: request.target.worktreeFolder, allowImplementation: true } });
      record = { ...record, state: 'copying', workspaceId: lease.id }; await ledger.write(name, record);
      await copyReviewedSnapshot({ ...source, store: seeds }, lease, protection); await checkSources();
      const branch = (await agentGit(lease.cwd, ['symbolic-ref', '--short', 'HEAD'])).trim();
      const increment = await captureWorkflowIncrement(lease.cwd, branch, 'Reviewed code polishing applied to a fresh primary-owned resource', undefined, { allowEmpty: true, baseCommit: source.manifest.identity.baseCommit });
      increment.tests = ['Not run on this copied snapshot. Review the original session evidence for earlier checks.'];
      await lease.release(); await this.workspaces.assertReviewable(lease.id!, increment);
      const binding: PolishingCodeBinding = { id: request.id, workspaceId: lease.id!, ownerRunId: request.target.runId, mode: request.target.mode, workspaceEpoch: request.target.workspaceEpoch, increment,
        evidenceHash: inputHash({ id: request.id, source: request.reviewedSnapshot, baseline: request.baseline, workspaceId: lease.id, treeHash: source.manifest.treeHash }) };
      record = { ...record, state: 'complete', binding }; await ledger.write(name, record);
      if (this.generationFiles) await this.generationFiles.write(name, record);
      return binding;
    } catch (error) {
      if (record.state !== 'complete') {
        let stopped = false;
        if (lease?.id) {
          try { await lease.release(true); await this.workspaces.acknowledge(lease.id, request.id, false); stopped = true; } catch { /* Unknown leases remain quarantined. */ }
        }
        const retained = { ...record, state: 'attention' as const, ...(stopped ? { copyStopped: true as const } : {}) };
        try {
          await ledger.write(name, retained); if (this.generationFiles) await this.generationFiles.write(name, retained);
          if (stopped) throw new PolishingCopyRetainedError();
        } catch (retainedError) { if (retainedError instanceof PolishingCopyRetainedError) throw retainedError; }
      }
      throw error;
    }
  }
}
