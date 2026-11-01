import type { AiWorkflowStep, WorkflowDefinition } from '../domain/configured-workflow';
import type { PolishingConsent, PolishingPreview, PolishingRun } from '../domain/polishing';
import { backgroundBuildRetryInspectionCheck, backgroundBuildRetrySourceCheck, type BackgroundBuildRetrySource } from '../domain/background-build-retry';
import { durableBuildPolicyCheck } from '../domain/durable-build';
import { workflowProposalRevision } from '../domain/configured-workflow-run';
import { workflowRunOwner } from './workflow-run-owner';
import { polishingContext } from './polishing-policy';
import { bindWorkflowCoworkers, prepareWorkflowCoworkers } from './configured-workflow-coworkers';
import { configuredRuntime } from './configured-workflow-policy';
import type { AgentTaskPort } from './agent-task';
import type { BackgroundBuildRetryPort } from './background-build-retry-ports';
import type { DurableBuildPort } from './durable-build-ports';
import type { InternalState } from './ports';
import type { StudioStore } from './studio-store';
import type { WorkflowCoworkerBinding } from '../domain/workflow-coworker-binding';
import { recordOperation } from './population';
import { workflowSourceExecutors, resolvedWorkflowSource } from './workflow-source-executors';

type Context = ReturnType<typeof polishingContext>;
interface Receipt { preview: PolishingPreview; identity: string; definition: WorkflowDefinition; bindings: WorkflowCoworkerBinding[]; source?: BackgroundBuildRetrySource }
export class PolishingPasses {
  private readonly receipts = new Map<string, Receipt>();
  constructor(private readonly store: StudioStore, private readonly resources: BackgroundBuildRetryPort | undefined, private readonly worker: DurableBuildPort | undefined,
    private readonly agentTasks: AgentTaskPort | undefined, private readonly busy: (id: string) => boolean,
    private readonly queue: (state: InternalState, ideaId: string, run: PolishingRun, ids: { jobId: string; attemptId: string }) => void) {}
  private context(id: string, feedback: string) { return polishingContext(this.store.internalSnapshot(), id, feedback, this.busy(id)); }
  private source(context: Context): BackgroundBuildRetrySource {
    const { target, idea, project } = context; const ownerId = target.workspaceOwnerRunId ?? target.sourceRunId;
    if (target.value.increment && !target.value.increment.simulated && !target.workspaceId && idea.status !== 'shipped') throw new Error('Restore the attributed code workspace before polishing partial changes.');
    const owner = ownerId ? workflowRunOwner(idea, ownerId) : undefined;
    return backgroundBuildRetrySourceCheck({ projectId: project.id, ideaId: idea.id, ...(ownerId ? { runId: ownerId } : {}), runRevision: owner?.revision ?? 0,
      proposalRevision: workflowProposalRevision(idea), stepId: 'polish-result', projectPath: project.projectPath, sourceIdentity: context.sourceHash,
      sourceKind: target.workspaceId ? 'workspace' : 'repository', ...(target.workspaceId ? { sourceWorkspaceId: target.workspaceId } : {}),
      ...(target.sourceMaterializationId ? { sourceMaterializationId: target.sourceMaterializationId } : {}),
      ...(target.workspaceId ? { executorCandidates: workflowSourceExecutors(this.store.internalSnapshot(), ownerId, target.workspaceId) } : {}),
      ...(target.sourceJobId && target.sourceAttemptId ? target.sourceMaterializationId ? { executorJobId: target.sourceJobId, executorAttemptId: target.sourceAttemptId } : { sourceJobId: target.sourceJobId, sourceAttemptId: target.sourceAttemptId } : {}),
      ...(target.workspaceId && target.value.increment && !target.value.increment.simulated ? { expectedIncrement: target.value.increment } : {}) });
  }
  async preview(ideaId: string, feedback: string): Promise<PolishingPreview> {
    this.receipts.delete(ideaId); const context = this.context(ideaId, feedback); const configuration = context.configuration;
    const code = context.target.kind === 'codechange';
    const step: AiWorkflowStep = { id: 'polish-result', kind: 'ai', name: 'Improve & polish', instructions: configuration.instructions,
      provider: configuration.provider, model: configuration.model, ...(configuration.effort ? { effort: configuration.effort } : {}),
      ...(configuration.coworkerId ? { coworkerId: configuration.coworkerId } : {}), output: context.target.kind === 'request' ? 'markdown' : context.target.kind,
      access: code ? 'editworktree' : 'none', automatic: false,
      ...(code ? { execution: durableBuildPolicyCheck({ ...(configuration.execution ?? { mode: 'background' }), idleWarningSeconds: configuration.execution?.idleWarningSeconds ?? 1800 }) } : {}) };
    const draft: WorkflowDefinition = { format: 'coforge-workflow/v1', revision: `polish-${crypto.randomUUID()}`, name: 'Improve & polish',
      limits: { ...configuration.limits, intervalSeconds: context.project.settings.intervalSeconds }, steps: [step] };
    const bindings = await prepareWorkflowCoworkers(draft, context.project.id, this.agentTasks);
    const definition = bindWorkflowCoworkers(draft, bindings); const effective = definition.steps[0];
    if (effective?.kind !== 'ai') throw new Error('The captured polishing step is unavailable.');
    configuredRuntime(this.store.internalSnapshot(), context.idea, effective, false, !code);
    let source: BackgroundBuildRetrySource | undefined; let inspection: PolishingPreview['inspection']; let readiness: PolishingPreview['readiness'];
    if (code) {
      if (!['claude', 'codex'].includes(effective.provider) || !this.resources || !this.worker) throw new Error('Code polishing requires the native Claude or Codex background worker. No fallback was started.');
      readiness = await this.worker.readiness(); if (!readiness.ready || readiness.reviewedSnapshots !== true) throw new Error(readiness.message || 'Check reviewed snapshot support before code polishing.');
      source = this.source(context); inspection = backgroundBuildRetryInspectionCheck(await this.resources.inspect(source));
      source = resolvedWorkflowSource(source, inspection);
    }
    if (this.context(ideaId, context.feedback).identity !== context.identity) throw new Error('The polishing source changed during preview. Open the feedback modal again.');
    const inheritedLimits = { maxTurns: configuration.limits.maxTurns, maxBudgetUsd: configuration.limits.maxBudgetUsd };
    const preview: PolishingPreview = { id: crypto.randomUUID(), ideaId, feedback: context.feedback, target: context.target, sourceHash: context.sourceHash,
      ...(context.primaryCheckpoint ? { primaryCheckpoint: context.primaryCheckpoint } : {}), step: effective, ...(bindings[0] ? { coworker: bindings[0].profile } : {}),
      sourceArtifacts: context.sourceArtifacts, policySourceRevision: context.policySourceRevision, inheritedLimits,
      effectiveLimits: { maxTurns: effective.execution?.maxTurns ?? inheritedLimits.maxTurns, maxBudgetUsd: effective.execution?.maxBudgetUsd ?? inheritedLimits.maxBudgetUsd },
      ...(inspection ? { inspection } : {}), ...(readiness ? { readiness } : {}), stopHold: context.stopHold,
      oldExecutorAcknowledgementRequired: context.oldExecutorAcknowledgementRequired || !!inspection?.humanCessationRequired, createdAt: new Date().toISOString() };
    this.receipts.set(ideaId, { preview: structuredClone(preview), identity: context.identity, definition, bindings, ...(source ? { source } : {}) }); return structuredClone(preview);
  }
  async confirm(ideaId: string, previewId: string, consent: PolishingConsent): Promise<void> {
    const receipt = this.receipts.get(ideaId); const preview = receipt?.preview;
    if (!receipt || !preview || preview.id !== previewId || this.context(ideaId, preview.feedback).identity !== receipt.identity) throw new Error('The polishing preview is stale. Open the feedback modal again.');
    if (consent.changesReviewed !== true || preview.oldExecutorAcknowledgementRequired && consent.oldExecutorStopped !== true || preview.stopHold && consent.releaseStopHold !== true) throw new Error('Review this current result, inspect any original executor, and explicitly release its Stop hold.');
    const bindings = await prepareWorkflowCoworkers(receipt.definition, this.context(ideaId, preview.feedback).project.id, this.agentTasks);
    if (JSON.stringify(bindings) !== JSON.stringify(receipt.bindings)) throw new Error('The polishing CoWorker changed. Review a fresh preview.');
    const id = crypto.randomUUID(); const ids = { jobId: crypto.randomUUID(), attemptId: crypto.randomUUID() };
    if (preview.inspection && receipt.source) {
      const ready = await this.worker!.readiness(); if (!ready.ready || ready.reviewedSnapshots !== true) throw new Error('The background worker is no longer ready.');
      await this.resources!.verify(receipt.source, preview.inspection.snapshot, { kind: 'improvement', runId: id, retryId: id, ...ids });
    }
    await this.store.transaction(state => {
      const context = polishingContext(state, ideaId, preview.feedback, this.busy(ideaId));
      if (context.identity !== receipt.identity || this.receipts.get(ideaId) !== receipt) throw new Error('The source or policy changed before polishing admission. Review it again.');
      const at = new Date().toISOString();
      const pass: PolishingRun = { id, feedback: preview.feedback, target: preview.target, sourceHash: preview.sourceHash, consent: structuredClone(consent),
        ...(preview.primaryCheckpoint ? { primaryCheckpoint: preview.primaryCheckpoint } : {}), sourceArtifacts: preview.sourceArtifacts, policySourceRevision: preview.policySourceRevision,
        previousStatus: context.idea.status, createdAt: at, review: 'pending',
        ...(preview.inspection && receipt.source ? { reviewedSnapshot: preview.inspection.snapshot, reviewedSource: receipt.source } : {}),
        workflow: { id, ideaId, projectId: context.project.id, definition: receipt.definition, proposalRevision: workflowProposalRevision(context.idea), revision: 0, cursor: 0, state: 'ready', attempts: [], artifacts: [], createdAt: at, updatedAt: at,
          ...(receipt.bindings.length ? { coworkerBindings: receipt.bindings } : {}), projectContext: { name: context.project.settings.projectName, brief: context.project.settings.projectBrief, agentPrompt: context.project.settings.agentPrompt, projectPath: context.project.projectPath, worktreeFolder: context.project.worktreeFolder } } };
      context.idea.polishingRuns = [...(context.idea.polishingRuns ?? []), pass];
      if (preview.stopHold) state.workflowStopHolds = state.workflowStopHolds?.filter(value => value !== ideaId);
      this.queue(state, ideaId, pass, ids);
      recordOperation(state, 'polishing-pass-approved', 'committed', undefined, 1, id);
    }, { atomicCommand: true });
    this.receipts.delete(ideaId);
  }
  clear(): void { this.receipts.clear(); }
}
