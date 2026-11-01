import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { retrySourceFixture } from './background-build-retry-native-fixture';
import { ai, definition } from './configured-workflow-fixture';
import { createSeed, defaultIntegration, defaultSettings } from '../../../features/coforge/domain/seed';
import type { StageInput, StageResult } from '../../../features/coforge/application/ports';
import type { WorkflowWorkspaces } from '../../../features/coforge/application/workflow-workspace-ports';
import { ForegroundPolishingResources } from '../../../infrastructure/coforge/background-build-seed/foreground';
import { ForegroundPolishingLedger } from '../../../infrastructure/coforge/background-build-seed/foreground-record';
import { ReviewedResourceMaterializer } from '../../../infrastructure/coforge/background-build-seed/materialize';
import { inputHash } from '../../../infrastructure/coforge/durable-worker/protocol';
import type { BackgroundBuildRetrySource } from '../../../features/coforge/domain/background-build-retry';
import type { PolishingCodeApplyRequest } from '../../../features/coforge/application/polishing-ports';
import { ProviderFailureError, providerFailureFor } from '../../../features/coforge/domain/provider-failure';

const folders: string[] = [];
afterEach(async () => { for (const folder of folders.splice(0)) await rm(folder, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
async function fixture() {
  const f = await retrySourceFixture(folders); f.source.sourceIdentity = 'ctx-reviewed-primary';
  const baseline = await f.resources.inspect(f.source);
  const target = { kind: 'improvement' as const, runId: 'foreground-pass', retryId: 'foreground-pass', jobId: 'foreground-job', attemptId: 'foreground-attempt' };
  await f.resources.verify(f.source, baseline.snapshot, target);
  const step = { ...ai('polish-result', 'codechange', 'editworktree'), provider: 'claude' as const, automatic: false };
  const configuration = definition([step]); const now = new Date().toISOString();
  const idea = { ...createSeed().ideas[0]!, id: f.source.ideaId, projectId: f.source.projectId };
  const input: StageInput = { jobId: target.jobId, stage: 'implement', idea, settings: defaultSettings(), integration: { ...defaultIntegration(), projectPath: f.project,
    worktreeFolder: join(f.root, 'attached-worktrees'), allowImplementation: true },
    workflow: { runId: target.runId, attemptId: target.attemptId, definitionRevision: configuration.revision, proposalRevision: f.source.proposalRevision, step, inputArtifacts: [],
      polishingId: target.retryId, polishingSourceHash: f.source.sourceIdentity, sourceRunId: f.source.runId, lifecycle: { version: 1, mode: 'managed-session' }, worktreeCoding: { version: 1, profile: 'native-worktree-v1', maxConcurrent: 2 } },
    onWorkspace: vi.fn(async () => {}), onNativeProcess: vi.fn(async () => {}) };
  input.idea.polishingRuns = [{ id: target.retryId, feedback: 'Improve this code', sourceHash: f.source.sourceIdentity, consent: { changesReviewed: true, oldExecutorStopped: true, releaseStopHold: false },
    target: { kind: 'codechange', identity: 'primary', contentHash: 'current', proposalRevision: f.source.proposalRevision, value: { increment: f.source.expectedIncrement } },
    workflow: { id: target.runId, ideaId: idea.id, projectId: idea.projectId, definition: configuration, proposalRevision: f.source.proposalRevision, revision: 0, cursor: 0,
      state: 'running', attempts: [], artifacts: [], createdAt: now, updatedAt: now }, sourceArtifacts: [], policySourceRevision: 'policy', createdAt: now, review: 'pending', previousStatus: 'review',
    reviewedSnapshot: baseline.snapshot, reviewedSource: f.source }];
  const proof = vi.fn(async () => true);
  const adapter = new ForegroundPolishingResources({ privateDirectory: f.privateDirectory, vaultDirectory: f.vault, protectedVaultFolders: () => [],
    workspaces: f.workspaces, storage: f.storage, validate: () => {}, proveStopped: proof });
  const execute = vi.fn(async (payload: StageInput, spaces: WorkflowWorkspaces): Promise<StageResult> => {
    const snapshot = payload.workflow!;
    const lease = await spaces.acquire({ runId: snapshot.runId, projectId: idea.projectId, attemptId: snapshot.attemptId, access: 'editworktree', integration: payload.integration });
    await payload.onWorkspace?.(lease.id!);
    expect(await readFile(join(lease.cwd, 'game.ts'), 'utf8')).toBe('reviewed partial\n');
    const owner = { runId: snapshot.runId, attemptId: snapshot.attemptId, projectId: idea.projectId };
    const nativeProcess = { ...owner, identity: { pid: 123, platform: 'win32', birth: 'original', image: 'a'.repeat(64) }, phase: 'launched' as const, observedAt: now,
      lifetime: { ...owner, version: 1 as const, kind: 'windows-job' as const, directory: '/owned/native', ownerToken: 'b'.repeat(64), sourceHash: 'c'.repeat(64) } };
    await payload.onNativeProcess?.(nativeProcess);
    await writeFile(join(lease.cwd, 'game.ts'), 'foreground polished code\n');
    await payload.onNativeProcess?.({ ...nativeProcess, phase: 'terminated' });
    const increment = await lease.capture('Foreground polishing result'); await lease.release();
    return { summary: 'Foreground polishing result', increment };
  });
  return { ...f, target, baseline, input, proof, adapter, execute };
}
it('dispatches reviewed code in an attached owned worktree and Applies through a real foreground paid receipt without any worker', async () => {
  const f = await fixture();
  const result = await f.adapter.run(f.input, f.workspaces, f.execute); expect(f.execute).toHaveBeenCalledOnce();
  const aux = (await f.storage.load()).find(row => row.runId === f.target.runId)!;
  expect(aux.reviewedImportId).toBe(f.target.retryId); expect(aux.operatorMaterializationId).toBeUndefined(); expect(aux.id.startsWith('bg-')).toBe(false);
  expect(await readFile(join(f.project, 'game.ts'), 'utf8')).toBe('before\n');
  expect(await readFile(join(f.lease.cwd, 'game.ts'), 'utf8')).toBe('reviewed partial\n');
  const source: BackgroundBuildRetrySource = { ...f.source, runId: f.target.runId, sourceWorkspaceId: aux.id, sourceJobId: f.target.jobId,
    sourceAttemptId: f.target.attemptId, expectedIncrement: result.increment, sourceIdentity: inputHash(result) };
  const review = await f.adapter.sources.inspect(source);
  const request: PolishingCodeApplyRequest = { id: 'apply-attached', projectId: f.source.projectId, ideaId: f.source.ideaId, source, reviewedSnapshot: review.snapshot,
    baseline: f.baseline.snapshot, evidenceHash: review.evidenceHash, sourceArtifactHash: inputHash(result), target: { runId: f.source.runId, mode: 'foreground', workspaceEpoch: 'apply-attached',
      projectPath: f.project, worktreeFolder: join(f.root, 'applied-worktrees') } };
  const applied = await new ReviewedResourceMaterializer(f.privateDirectory, f.workspaces).materialize(request, []);
  expect(applied.increment.tests).toEqual(['Not run on this copied snapshot. Review the original session evidence for earlier checks.']);
  expect(await readFile(join(applied.increment.worktree!, 'game.ts'), 'utf8')).toBe('foreground polished code\n');
  expect(await readFile(join(f.lease.cwd, 'game.ts'), 'utf8')).toBe('reviewed partial\n');
  expect((await new ForegroundPolishingLedger(f.privateDirectory).read(f.target.jobId))?.state).toBe('completed');
  expect(f.execute).toHaveBeenCalledOnce();
}, 120000);
it('refuses a changed source or a foreign private baseline authorization before starting the paid agent', async () => {
  const f = await fixture();
  await writeFile(join(f.lease.cwd, 'game.ts'), 'independent human edit\n');
  await expect(f.adapter.run(f.input, f.workspaces, f.execute)).rejects.toThrow(); expect(f.execute).not.toHaveBeenCalled();
  await writeFile(join(f.lease.cwd, 'game.ts'), 'reviewed partial\n'); f.input.workflow!.attemptId = 'foreign-attempt';
  await expect(f.adapter.run(f.input, f.workspaces, f.execute)).rejects.toThrow(); expect(f.execute).not.toHaveBeenCalled();
}, 120000);
it.each(['unproven', 'cancelled'] as const)('does not publish completion or permit Apply for a %s foreground session', async outcome => {
  const f = await fixture();
  if (outcome === 'unproven') f.proof.mockResolvedValue(false);
  else {
    const execute = f.execute.getMockImplementation(); if (!execute) throw new Error('Missing contained provider fixture');
    f.execute.mockImplementation(async (input, workspaces) => { await execute(input, workspaces); throw new ProviderFailureError(providerFailureFor('cancelled')); });
  }
  await expect(f.adapter.run(f.input, f.workspaces, f.execute)).rejects.toThrow();
  const ledger = await new ForegroundPolishingLedger(f.privateDirectory).read(f.target.jobId);
  expect(ledger?.state).toBe(outcome === 'unproven' ? 'attention' : 'failed'); expect(ledger?.result).toBeUndefined();
  const aux = (await f.storage.load()).find(row => row.runId === f.target.runId)!;
  const source: BackgroundBuildRetrySource = { ...f.source, runId: f.target.runId, sourceWorkspaceId: aux.id, sourceJobId: f.target.jobId,
    sourceAttemptId: f.target.attemptId, expectedIncrement: undefined, sourceIdentity: 'ctx-unaccepted-result' };
  const inspected = await f.adapter.sources.inspect(source);
  await expect(new ReviewedResourceMaterializer(f.privateDirectory, f.workspaces).materialize({ id: 'never-apply', projectId: source.projectId, ideaId: source.ideaId,
    source, reviewedSnapshot: inspected.snapshot, baseline: f.baseline.snapshot, evidenceHash: inspected.evidenceHash, sourceArtifactHash: inputHash({ outcome }),
    target: { runId: f.source.runId, mode: 'foreground', workspaceEpoch: 'never-apply', projectPath: f.project, worktreeFolder: join(f.root, 'never-created') } }, [])).rejects.toThrow();
  await expect(f.adapter.run(f.input, f.workspaces, f.execute)).rejects.toThrow('incomplete'); expect(f.execute).toHaveBeenCalledOnce();
  expect(await readFile(join(f.lease.cwd, 'game.ts'), 'utf8')).toBe('reviewed partial\n');
}, 120000);
