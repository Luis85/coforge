import { realpath } from 'node:fs/promises';
import type { StageInput, StageResult } from '../../../features/coforge/application/ports';
import type { WorkflowWorkspaceStorage, WorkflowWorkspaces } from '../../../features/coforge/application/workflow-workspace-ports';
import type { NativeWorkflowProcessRecord } from '../../../features/coforge/domain/native-workflow-process';
import { nativeWorkflowProcessRecordCheck } from '../../../features/coforge/domain/native-workflow-process';
import { durableBuildResultCheck } from '../../../features/coforge/domain/durable-build';
import { isManagedWorkflowSession } from '../../../features/coforge/domain/workflow-lifecycle';
import type { BackgroundBuildRetrySource } from '../../../features/coforge/domain/background-build-retry';
import { ideaProjectId } from '../../../features/coforge/domain/projects';
import { LocalWorkflowWorkspaces } from '../workflow-workspaces';
import { BackgroundBuildRetryResources } from '../background-build-retry-resources';
import { captureProjectProtection } from '../durable-worker/protection';
import { inputHash } from '../durable-worker/protocol';
import { inspectOwnedWorktreeLifetime } from '../native-process/owned-worktree-process';
import { copyReviewedSnapshot, reviewedForegroundPolishingSeed } from './import';
import { verifyRetrySourceIdentity } from './source';
import { ForegroundPolishingLedger, foregroundPolishingAdmissionHash, type ForegroundPolishingRecord } from './foreground-record';
import { invalidSnapshot } from './tree';

export interface ForegroundPolishingOptions {
  privateDirectory: string; vaultDirectory: string; protectedVaultFolders(): readonly string[]; workspaces: LocalWorkflowWorkspaces; storage: WorkflowWorkspaceStorage;
  validate(): void; sourceStorage?(source: BackgroundBuildRetrySource): Promise<WorkflowWorkspaceStorage>;
  /** Host-owned proof adapter; production always reads the authenticated original OS Job receipt. */
  proveStopped?(record: NativeWorkflowProcessRecord): Promise<boolean>;
}
/** Attached paid work has its own admission/terminal ledger; neither a worker nor an unpaid operator copy is invented. */
export class ForegroundPolishingResources {
  readonly sources: BackgroundBuildRetryResources;
  private readonly ledger: ForegroundPolishingLedger;
  constructor(private readonly options: ForegroundPolishingOptions) {
    this.ledger = new ForegroundPolishingLedger(options.privateDirectory);
    this.sources = new BackgroundBuildRetryResources({ storage: options.storage, privateDirectory: options.privateDirectory, vaultDirectory: options.vaultDirectory,
      protectedVaultFolders: options.protectedVaultFolders, assertReady: async () => options.validate(), sourceStorage: options.sourceStorage });
  }
  private async stopped(record: NativeWorkflowProcessRecord | undefined): Promise<boolean> {
    if (!record || record.phase !== 'terminated' || !record.lifetime || record.privateRuntime) return false;
    return this.options.proveStopped ? this.options.proveStopped(record) : !!await inspectOwnedWorktreeLifetime(record.identity, record.lifetime);
  }
  async run(input: StageInput, fallback: WorkflowWorkspaces, execute: (input: StageInput, workspaces: WorkflowWorkspaces) => Promise<StageResult>): Promise<StageResult> {
    const workflow = input.workflow;
    if (!workflow?.polishingId || !isManagedWorkflowSession(workflow) || workflow.step.execution || workflow.step.output !== 'codechange') return execute(input, fallback);
    this.options.validate();
    const seed = await reviewedForegroundPolishingSeed(this.options.privateDirectory, input);
    const admission = { version: 1 as const, kind: 'foreground-polishing' as const, jobId: input.jobId!, attemptId: workflow.attemptId, runId: workflow.runId,
      projectId: ideaProjectId(input.idea), ideaId: input.idea.id, polishingId: workflow.polishingId, proposalRevision: workflow.proposalRevision, sourceHash: workflow.polishingSourceHash!,
      baseline: seed.ref, executionHash: inputHash(workflow), pathsHash: inputHash({ projectPath: input.integration.projectPath, worktreeFolder: input.integration.worktreeFolder }) };
    const hash = foregroundPolishingAdmissionHash(admission);
    const existing = await this.ledger.read(input.jobId!);
    if (existing) {
      if (existing.admissionHash !== hash || existing.state !== 'completed' || !existing.result || !existing.workspaceId || !await this.stopped(existing.nativeProcess))
        throw new Error('The original foreground polishing admission is incomplete or changed. Its retained workspace was not replayed.');
      await this.options.workspaces.assertReviewable(existing.workspaceId, existing.result.increment);
      return existing.result;
    }
    let record: ForegroundPolishingRecord = { ...admission, admissionHash: hash, state: 'prepared', createdAt: new Date().toISOString() };
    await this.ledger.create(record);
    const protection = await captureProjectProtection(this.options.vaultDirectory, seed.manifest.identity.projectRoot, this.options.protectedVaultFolders());
    let acquired = false;
    const scoped: WorkflowWorkspaces = { ...fallback,
      start: () => fallback.start(), assertReviewable: (id, expected) => fallback.assertReviewable(id, expected), acknowledge: (id, attempt, reusable) => fallback.acknowledge(id, attempt, reusable),
      acquire: async request => {
        if (acquired || request.runId !== workflow.runId || request.projectId !== record.projectId || request.attemptId !== workflow.attemptId || request.workspaceId) throw invalidSnapshot();
        acquired = true;
        const lease = await this.options.workspaces.acquireReviewedWorkflow({ ...request, baseCommit: seed.manifest.identity.baseCommit,
          workspaceEpoch: workflow.polishingId!, reviewedImportId: workflow.polishingId! });
        try {
          record = { ...record, workspaceId: lease.id, state: 'copying' }; await this.ledger.write(record);
          await copyReviewedSnapshot(seed, lease, protection.protectedProjectPaths, input.signal);
          record = { ...record, state: 'seeded' }; await this.ledger.write(record);
          return { ...lease, protectedProjectPaths: [...new Set([...(lease.protectedProjectPaths ?? []), ...protection.protectedProjectPaths])] };
        } catch (error) { await lease.release(true); throw error; }
      } };
    try {
      const result = durableBuildResultCheck(await execute({ ...input, onNativeProcess: async value => {
        const nativeProcess = nativeWorkflowProcessRecordCheck(value);
        if (nativeProcess.runId !== record.runId || nativeProcess.attemptId !== record.attemptId || nativeProcess.projectId !== record.projectId || !nativeProcess.lifetime) throw invalidSnapshot();
        record = { ...record, nativeProcess }; await this.ledger.write(record); await input.onNativeProcess?.(nativeProcess);
      } }, scoped));
      if (!record.workspaceId || !await this.stopped(record.nativeProcess) || result.increment?.simulated
        || await realpath(input.integration.projectPath) !== await realpath(seed.manifest.source.projectPath)
        || (await verifyRetrySourceIdentity(seed.manifest.source, seed.manifest.identity)).evidenceHash !== seed.manifest.evidenceHash) throw invalidSnapshot();
      await this.options.workspaces.assertReviewable(record.workspaceId, result.increment);
      record = { ...record, state: 'completed', result }; await this.ledger.write(record); return result;
    } catch (error) {
      record = { ...record, state: !record.nativeProcess || await this.stopped(record.nativeProcess) ? 'failed' : 'attention' };
      await this.ledger.write(record).catch(() => undefined); throw error;
    }
  }
}
