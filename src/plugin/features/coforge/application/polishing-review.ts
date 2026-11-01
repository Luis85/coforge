import { polishingResultArtifact } from '../domain/polishing-target';
import { polishingCodeBindingCheck } from '../domain/polishing-reference-check';
import type { PolishingRun } from '../domain/polishing';
import { findProject } from '../domain/projects';
import { isActiveJob } from '../domain/workflow';
import { backgroundBuildRetrySourceCheck } from '../domain/background-build-retry';
import type { StudioStore } from './studio-store';
import type { InternalState } from './ports';
import { PolishingCopyRetainedError, type PolishingCodePort } from './polishing-ports';
import type { BackgroundBuildRetryPort } from './background-build-retry-ports';
import { assertPolishingSource } from './polishing-policy';
import { applyPolishingAmendment, polishingCodeOwner } from './polishing-amendments';
import { recordOperation } from './population';
import type { Increment } from '../domain/types';

function context(state: InternalState, ideaId: string, id: string, revision: number, expectedStopVersion?: number) {
  const idea = state.ideas.find(item => item.id === ideaId); const pass = idea?.polishingRuns?.find(item => item.id === id);
  if (!idea || !pass || pass.review !== 'pending' || pass.workflow.revision !== revision) throw new Error('The polishing review changed. Reload its current result.');
  if (expectedStopVersion !== undefined && (pass.stopVersion ?? 0) !== expectedStopVersion) throw new Error('Stop was requested during this Apply. Its receipt remains retained for a later explicit review.');
  if (findProject(state, pass.workflow.projectId).unavailable) throw new Error('Restore this project before reviewing its polishing result.');
  if (state.jobs.some(job => job.ideaId === ideaId && (isActiveJob(job) || job.durable && !job.durable.acknowledged))) throw new Error('Settle the original executor before reviewing this polishing result.');
  assertPolishingSource(idea, pass); return { idea, pass };
}
function targetMode(pass: PolishingRun, state: InternalState, ideaId: string): 'foreground' | 'background' {
  const main = state.ideas.find(idea => idea.id === ideaId)?.workflowRun;
  const next = main?.definition.steps.slice(main.cursor).find(step => step.kind === 'ai' && step.access === 'editworktree');
  return next?.kind === 'ai' ? next.execution ? 'background' : 'foreground' : main?.workspaceId ? main.workspaceId.startsWith('bg-') ? 'background' : 'foreground' : pass.workflow.workspaceId?.startsWith('bg-') ? 'background' : 'foreground';
}
export async function applyPolishingResult(store: StudioStore, resources: BackgroundBuildRetryPort | undefined, code: PolishingCodePort | undefined, ideaId: string, id: string, revision: number, assertHostActive: () => void): Promise<void> {
  assertHostActive();
  const initial = context(store.internalSnapshot(), ideaId, id, revision); const artifact = polishingResultArtifact(initial.pass);
  const stopVersion = initial.pass.stopVersion ?? 0;
  if (initial.pass.target.kind !== 'codechange' || !artifact.increment) {
    await store.transaction(state => { assertHostActive(); context(state, ideaId, id, revision, stopVersion); applyPolishingAmendment(state, ideaId, id, revision); }, { atomicCommand: true }); return;
  }
  const run = initial.pass.workflow; const attempt = run.attempts.find(item => item.id === artifact.attemptId); const project = findProject(store.internalSnapshot(), run.projectId);
  if (!resources || !code || !run.workspaceId || !initial.pass.reviewedSnapshot || !attempt?.jobId) throw new Error('Restore the original code-polishing workspace and native copy service before applying it.');
  const source = backgroundBuildRetrySourceCheck({ projectId: run.projectId, ideaId, runId: run.id, runRevision: run.revision, proposalRevision: run.proposalRevision,
    stepId: artifact.stepId, sourceKind: 'workspace', sourceWorkspaceId: run.workspaceId, sourceJobId: attempt.jobId, sourceAttemptId: attempt.id,
    projectPath: project.projectPath, expectedIncrement: artifact.increment, sourceIdentity: artifact.contentHash });
  const inspection = await resources.inspect(source);
  assertHostActive();
  if (artifact.increment.snapshotHash && artifact.increment.snapshotHash !== inspection.increment?.snapshotHash) throw new Error('The actual polishing workspace changed after its captured result. Its verified tree hash is missing or different.');
  const reviewedTreeHash = inspection.increment?.snapshotHash ?? artifact.increment.snapshotHash;
  const view = (increment: Increment | undefined) => increment ? JSON.stringify([increment.files, increment.diff, increment.branch, increment.worktree, increment.commit]) : '';
  if (view(inspection.increment ?? undefined) !== view(artifact.increment)) throw new Error('The actual polishing workspace changed after its captured result. Inspect the current files before applying it.');
  await store.transaction(state => {
    assertHostActive();
    const { idea, pass } = context(state, ideaId, id, revision, stopVersion);
    if (pass.applyIntent) {
      if (pass.applyIntent.sourceArtifactId !== artifact.id || pass.applyIntent.sourceArtifactHash !== artifact.contentHash || pass.applyIntent.sourceHash !== inspection.evidenceHash) throw new Error('The original materialization intent changed. Inspect its retained resources.');
      if (pass.applyFailure?.intentId !== pass.applyIntent.id || pass.applyFailure.code !== 'POLISHING_COPY_RETAINED') return;
      if ((pass.applyIntentHistory?.length ?? 0) >= 25) throw new Error('The preserved copy history is full. Export its retained evidence before another copy.');
      pass.applyIntentHistory = [...(pass.applyIntentHistory ?? []), structuredClone(pass.applyIntent)];
      delete pass.applyFailure;
    }
    const operationId = crypto.randomUUID();
    pass.applyIntent = { id: operationId, sourceArtifactId: artifact.id, sourceArtifactHash: artifact.contentHash, snapshot: inspection.snapshot, sourceHash: inspection.evidenceHash,
      baseline: pass.reviewedSnapshot!, targetRunId: polishingCodeOwner(idea, pass), mode: targetMode(pass, state, ideaId), workspaceEpoch: operationId,
      primaryCheckpointHash: pass.primaryCheckpoint?.contentHash ?? 'none', createdAt: new Date().toISOString() };
  }, { atomicCommand: true });
  assertHostActive();
  const current = context(store.internalSnapshot(), ideaId, id, revision, stopVersion); const intent = current.pass.applyIntent!;
  let binding;
  try {
    const copied = await code.materialize({ id: intent.id, ideaId, projectId: run.projectId, source, reviewedSnapshot: intent.snapshot, baseline: intent.baseline,
      evidenceHash: intent.sourceHash, sourceArtifactHash: artifact.contentHash, target: { runId: intent.targetRunId, mode: intent.mode, workspaceEpoch: intent.workspaceEpoch, projectPath: project.projectPath, worktreeFolder: project.worktreeFolder } });
    assertHostActive(); binding = polishingCodeBindingCheck(copied);
  }
  catch (error) {
    assertHostActive();
    if (error instanceof PolishingCopyRetainedError) await store.transaction(state => {
      assertHostActive();
      const pass = state.ideas.find(idea => idea.id === ideaId)?.polishingRuns?.find(item => item.id === id);
      if (pass?.review === 'pending' && pass.applyIntent?.id === intent.id) pass.applyFailure = { intentId: intent.id, code: error.code, message: error.message, at: new Date().toISOString() };
    }, { atomicCommand: true });
    throw error;
  }
  if (binding.id !== intent.id || binding.ownerRunId !== intent.targetRunId || binding.mode !== intent.mode || binding.workspaceEpoch !== intent.workspaceEpoch) throw new Error('The native operator resource receipt does not match this review.');
  if (reviewedTreeHash && binding.increment.snapshotHash !== reviewedTreeHash) throw new Error('The copied resource tree hash does not match the reviewed source. Its private receipt was retained.');
  await store.transaction(state => {
    assertHostActive();
    const { pass } = context(state, ideaId, id, revision, stopVersion);
    if (JSON.stringify(pass.applyIntent) !== JSON.stringify(intent)) throw new Error('The materialization intent changed before its binding was committed.');
    applyPolishingAmendment(state, ideaId, id, revision, binding);
  }, { atomicCommand: true });
}
export async function rejectPolishingResult(store: StudioStore, ideaId: string, id: string, revision: number): Promise<void> {
  await store.transaction(state => {
    const idea = state.ideas.find(item => item.id === ideaId); const pass = idea?.polishingRuns?.find(item => item.id === id);
    if (!idea || !pass || pass.review !== 'pending' || pass.workflow.revision !== revision) throw new Error('The polishing review changed.');
    if (findProject(state, pass.workflow.projectId).unavailable) throw new Error('Restore this project before dismissing its polishing result.');
    if (pass.applyIntent && (pass.applyFailure?.intentId !== pass.applyIntent.id || pass.applyFailure.code !== 'POLISHING_COPY_RETAINED')) throw new Error('Check the original Apply receipt before dismissing this result. Its copy outcome is not settled.');
    if (state.jobs.some(job => job.ideaId === ideaId && (isActiveJob(job) || job.durable && !job.durable.acknowledged))) throw new Error('Stop and settle the polishing executor before dismissing its result.');
    pass.review = 'rejected'; pass.reviewedAt = new Date().toISOString();
    if (pass.previousStatus === 'shipped' && idea.status === 'review') idea.status = 'shipped';
    recordOperation(state, 'polishing-result-rejected', 'committed', undefined, 1, id);
  }, { atomicCommand: true });
}
export function holdPolishingRun(state: InternalState, ideaId: string, id: string): void {
  const idea = state.ideas.find(item => item.id === ideaId); const pass = idea?.polishingRuns?.find(item => item.id === id && item.review === 'pending');
  if (!idea || !pass) throw new Error('There is no current polishing pass to stop.');
  pass.stopVersion = (pass.stopVersion ?? 0) + 1;
  state.workflowStopHolds = [...new Set([...(state.workflowStopHolds ?? []), ideaId])];
  const at = new Date().toISOString(); const attempt = pass.workflow.attempts.find(item => item.id === pass.workflow.activeAttemptId);
  for (const job of state.jobs.filter(item => item.workflow?.runId === id)) {
    if (job.durable && !job.durable.acknowledged) job.durable.intent = 'cancel';
    else if (job.status === 'queued') { job.status = 'cancelled'; job.finishedAt = at; }
  }
  if (attempt?.status === 'queued') { attempt.status = 'cancelled'; attempt.finishedAt = at; delete pass.workflow.activeAttemptId; }
  if (pass.workflow.cursor !== 1) { pass.workflow.state = 'stopped'; pass.workflow.revision++; pass.workflow.updatedAt = at; }
  if (idea.status !== 'shipped') idea.status = 'inbox';
  recordOperation(state, 'polishing-pass-stopped', 'committed', undefined, 1, id);
}
