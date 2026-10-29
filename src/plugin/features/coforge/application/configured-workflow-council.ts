import type { StudioStore } from './studio-store';
import type { InternalState } from './ports';
import { AgentTaskNotStartedError, type AgentTaskPort, type AgentTaskReceipt, type AgentTaskResult } from './agent-task';
import type { CouncilWorkflowStep, WorkflowDefinition } from '../domain/configured-workflow';
import { workflowArtifactCheck, workflowArtifactHash, workflowProposalRevision, type WorkflowAttempt, type WorkflowRun } from '../domain/configured-workflow-run';
import { councilTaskBindingCheck, type WorkflowCouncilBinding } from '../domain/workflow-council-binding';
import { configuredIdea } from './configured-workflow-policy';
import { councilWorkflowInputs, workflowCouncilBinding } from './workflow-council-context';

const now = () => new Date().toISOString();
function touch(run: WorkflowRun) { run.revision++; run.updatedAt = now(); }
interface CouncilStop { ideaId: string; workflowRunId: string; attemptId: string; childRunId: string }
interface PendingReceipt { workflowRunId: string; attemptId: string; receipt: AgentTaskReceipt }

/** Admission and completion are separate durable boundaries; polling never resubmits a child. */
export class ConfiguredWorkflowCouncil {
  private disposed = false;
  private readonly active = new Map<string, { controller: AbortController; promise: Promise<void> }>();
  private readonly receipts = new Map<string, PendingReceipt>();
  private readonly cancellations = new Map<string, Promise<void>>();
  private readonly cancellationOutcomes = new Map<string, 'confirmed' | 'unknown'>();
  constructor(private readonly store: StudioStore, private readonly port: AgentTaskPort | undefined, private readonly advance: (state: InternalState, ideaId: string) => void) {}
  busy(id: string): boolean { return this.active.has(id); }
  async prepare(definition: WorkflowDefinition, projectId: string): Promise<WorkflowCouncilBinding[]> {
    const bindings: WorkflowCouncilBinding[] = [];
    for (const step of definition.steps) {
      if (step.kind !== 'council') continue;
      if (!this.port?.prepareCouncil || !this.port.result) throw new AgentTaskNotStartedError('Live Council workflows require desktop Obsidian. Configure the Council there before starting.');
      const previous = bindings.find(item => item.binding.councilId === step.councilId)?.binding;
      const binding = previous ?? councilTaskBindingCheck(await this.port.prepareCouncil(projectId, step.councilId));
      if (binding.projectId !== projectId || binding.councilId !== step.councilId) throw new AgentTaskNotStartedError('The captured Council belongs to a different project or selection.');
      bindings.push({ stepId: step.id, binding });
    }
    return bindings;
  }
  reserve(state: InternalState, ideaId: string, step: CouncilWorkflowStep): void {
    if (!this.port?.result) throw new AgentTaskNotStartedError('Ask Council is unavailable in this host. Open desktop Obsidian.');
    const idea = configuredIdea(state, ideaId); const run = idea.workflowRun!;
    workflowCouncilBinding(run, step);
    if (idea.screening?.verdict === 'flagged') throw new AgentTaskNotStartedError('Resolve this request’s moderation flag before asking the Council.');
    const inputs = councilWorkflowInputs(run, step); const id = crypto.randomUUID();
    run.attempts.push({ id, stepId: step.id, stepName: step.name, kind: 'council', status: 'queued', inputs: inputs.map(item => item.id), startedAt: now() });
    run.activeAttemptId = id; run.state = 'running'; touch(run);
  }
  run(ideaId: string): Promise<void> {
    const active = this.active.get(ideaId); if (active) return active.promise;
    const run = this.store.snapshot().ideas.find(item => item.id === ideaId)?.workflowRun;
    if (!run?.attempts.some(item => item.id === run.activeAttemptId && item.kind === 'council' && item.status === 'queued')) return Promise.resolve();
    const controller = new AbortController();
    const promise = this.dispatch(ideaId, controller).catch(async () => {
      const pending = this.receipts.get(ideaId);
      if (pending) {
        const stop = await this.recordReceipt(ideaId, pending.workflowRunId, pending.attemptId, pending.receipt, true);
        if (stop) await this.cancel(stop);
        return;
      }
      await this.store.transaction(state => {
        const run = state.ideas.find(item => item.id === ideaId)?.workflowRun;
        const attempt = run?.attempts.find(item => item.id === run.activeAttemptId);
        if (!run || attempt?.kind !== 'council' || attempt.nudgeRunId) return;
        attempt.status = 'failed'; attempt.finishedAt = now();
        if (run.state !== 'stopped') run.state = 'attention';
        if (attempt.nudgeState === 'reserved') {
          attempt.nudgeState = 'unknown';
          run.error = 'Council admission may have occurred before its result could be saved. Inspect the original source and acknowledge recovery before a fresh attempt.';
        } else run.error = 'Council preparation could not be saved. Review its source and captured setup before retrying.';
        delete run.activeAttemptId; touch(run);
      });
    }).finally(() => this.active.delete(ideaId));
    this.active.set(ideaId, { controller, promise }); return promise;
  }
  private async dispatch(ideaId: string, controller: AbortController): Promise<void> {
    const input = await this.store.transaction(state => {
      const idea = state.ideas.find(item => item.id === ideaId); const run = idea?.workflowRun;
      const attempt = run?.attempts.find(item => item.id === run.activeAttemptId); const step = run?.definition.steps[run.cursor];
      if (!idea || !run || run.state !== 'running' || attempt?.kind !== 'council' || attempt.status !== 'queued' || step?.kind !== 'council') return null;
      if (workflowProposalRevision(idea) !== run.proposalRevision) throw new AgentTaskNotStartedError('The request changed before Council admission.');
      const context = JSON.stringify({ untrustedRequest: { id: idea.id, projectId: run.projectId, title: idea.title, description: idea.description }, boundArtifacts: councilWorkflowInputs(run, step) });
      if (context.length > 60000) throw new AgentTaskNotStartedError('Council context exceeds 60000 characters. Reduce the selected inputs.');
      attempt.status = 'running'; attempt.nudgeState = 'reserved'; attempt.nudgeSourcePath = `CoForge/Automations/nudge-${attempt.id}.md`; touch(run);
      return { projectId: run.projectId, ideaId, workflowRunId: run.id, attemptId: attempt.id, stepId: step.id, title: `${idea.title} · ${step.name}`.slice(0, 160), councilId: step.councilId, councilBinding: workflowCouncilBinding(run, step), agentId: '', teamId: '', prompt: step.instructions, context, sourcePath: attempt.nudgeSourcePath,
        limits: { timeoutSeconds: run.definition.limits.timeoutSeconds, maxTurns: run.definition.limits.maxTurns, maxBudgetUsd: run.definition.limits.maxBudgetUsd },
        ...(run.automationEvent ? { automationEvent: structuredClone(run.automationEvent) } : {}), signal: controller.signal };
    });
    if (!input) return;
    let receipt: AgentTaskReceipt | undefined;
    try {
      if (controller.signal.aborted) throw new AgentTaskNotStartedError('The workflow was stopped before Council admission.');
      receipt = await this.port!.create(input);
      this.receipts.set(ideaId, { workflowRunId: input.workflowRunId, attemptId: input.attemptId, receipt });
      const stop = await this.recordReceipt(ideaId, input.workflowRunId, input.attemptId, receipt, false);
      if (stop) await this.cancel(stop);
    } catch (error) {
      if (receipt) {
        const stop = await this.recordReceipt(ideaId, input.workflowRunId, input.attemptId, receipt, true);
        if (stop && !this.store.snapshot().ideas.find(item => item.id === ideaId)?.workflowRun?.attempts.some(item => item.id === input.attemptId && item.councilCancellation === 'unknown')) await this.cancel(stop);
        return;
      }
      await this.store.transaction(state => {
        const run = state.ideas.find(item => item.id === ideaId)?.workflowRun;
        if (run?.id !== input.workflowRunId) return;
        const attempt = run.attempts.find(item => item.id === input.attemptId)!;
        attempt.status = run.state === 'stopped' ? 'cancelled' : 'failed'; attempt.finishedAt = now();
        if (error instanceof AgentTaskNotStartedError) {
          delete attempt.nudgeState; attempt.error = error.message;
          run.error = `Council was not started. ${error.message}`;
        } else {
          attempt.nudgeState = 'unknown'; attempt.error = 'Council admission could not be confirmed.';
          run.error = 'Council admission is uncertain. Inspect the original source and acknowledge recovery before a fresh attempt.';
        }
        if (run.state !== 'stopped') run.state = 'attention'; delete run.activeAttemptId; touch(run);
      });
    }
  }
  private async recordReceipt(ideaId: string, workflowRunId: string, attemptId: string, receipt: AgentTaskReceipt, recovering: boolean): Promise<CouncilStop | undefined> {
    const stop = await this.store.transaction(state => {
      const run = state.ideas.find(item => item.id === ideaId)?.workflowRun;
      if (run?.id !== workflowRunId) throw new Error('The original workflow is unavailable. Inspect its retained Council source.');
      const attempt = run.attempts.find(item => item.id === attemptId)!;
      attempt.nudgeRunId = receipt.runId; attempt.nudgeSourcePath = receipt.sourcePath; attempt.nudgeState = 'submitted';
      if (receipt.sourceId) attempt.councilSourceId = receipt.sourceId;
      if (run.state === 'stopped' || attempt.status === 'cancelled') { attempt.status = 'cancelled'; touch(run); return this.stopping(run, attempt); }
      attempt.status = 'running'; run.activeAttemptId = attempt.id;
      if (recovering) { run.state = 'attention'; run.error = 'The Council was admitted, but saving its receipt failed. Inspect the original discussion and check its answer; do not submit it again.'; }
      touch(run);
    });
    this.receipts.delete(ideaId);
    return stop;
  }
  async reconcile(ideaId: string): Promise<void> {
    const original = this.store.snapshot().ideas.find(item => item.id === ideaId)?.workflowRun;
    const attempt = original?.attempts.find(item => item.id === original.activeAttemptId);
    if (!original || !['running', 'attention'].includes(original.state) || attempt?.kind !== 'council' || attempt.nudgeState !== 'submitted' || !attempt.nudgeRunId || !this.port?.result) return;
    let result: AgentTaskResult;
    try { result = await this.port.result(attempt.nudgeRunId); } catch { result = { state: 'missing' }; }
    if (result.state === 'pending' || (original.state === 'attention' && result.state !== 'completed')) return;
    await this.store.transaction(state => {
      const idea = state.ideas.find(item => item.id === ideaId); const run = idea?.workflowRun;
      if (!idea || run?.id !== original.id || run.activeAttemptId !== attempt.id || !['running', 'attention'].includes(run.state)) return;
      const current = run.attempts.find(item => item.id === attempt.id)!;
      try {
        configuredIdea(state, ideaId);
        if (idea.screening?.verdict === 'flagged') throw new Error('Resolve this request’s moderation flag before using the Council answer.');
        if (result.state !== 'completed') throw new Error(result.state === 'cancelled' ? 'The Council discussion was cancelled. Read its retained answers, then stop this workflow before starting a new one.' : 'The Council needs attention. Inspect its original discussion, resolve recovery there and check its answer again.');
        if (result.markdown.length > 16000) throw new Error('The Council report exceeds the 16000-character workflow result limit. Read the complete child answers, stop this workflow, reduce the Council output limits or protocol, then start a new workflow. No answer was truncated.');
        if (result.projectId !== run.projectId || (current.councilSourceId ? result.sourceId !== current.councilSourceId : result.sourcePath !== current.nudgeSourcePath) || workflowProposalRevision(idea) !== run.proposalRevision) throw new Error('The request or Council result identity changed. Inspect the original discussion and start a fresh workflow for changed inputs.');
        const step = run.definition.steps[run.cursor];
        if (step?.kind !== 'council' || step.id !== current.stepId) throw new Error('The Council step changed.');
        const inputs = councilWorkflowInputs(run, step);
        if (JSON.stringify(inputs.map(item => item.id)) !== JSON.stringify(current.inputs)) throw new Error('The bound Council inputs changed.');
        const artifact = { id: crypto.randomUUID(), runId: run.id, stepId: step.id, attemptId: attempt.id, proposalRevision: run.proposalRevision, output: 'markdown' as const, markdown: result.markdown, createdAt: now() };
        run.artifacts.push(workflowArtifactCheck({ ...artifact, contentHash: workflowArtifactHash(artifact) }));
        current.status = 'succeeded'; current.finishedAt = now(); delete run.activeAttemptId;
        run.cursor++; run.state = 'ready'; delete run.error; touch(run); this.advance(state, ideaId);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'The Council result needs review.';
        if (run.state === 'attention' && run.error === message && current.status === 'failed') return;
        current.status = 'failed'; current.finishedAt = now(); run.state = 'attention'; run.error = message; touch(run);
      }
    });
  }
  stopping(run: WorkflowRun, attempt: WorkflowAttempt | undefined): CouncilStop | undefined {
    const pending = this.receipts.get(run.ideaId);
    if (attempt?.kind === 'council' && pending?.workflowRunId === run.id && pending.attemptId === attempt.id) {
      attempt.nudgeRunId = pending.receipt.runId; attempt.nudgeSourcePath = pending.receipt.sourcePath; attempt.nudgeState = 'submitted';
      if (pending.receipt.sourceId) attempt.councilSourceId = pending.receipt.sourceId;
    }
    if (attempt?.kind !== 'council' || !attempt.nudgeRunId) return;
    const outcome = this.cancellationOutcomes.get(`${run.id}:${attempt.id}`);
    if (outcome) {
      attempt.councilCancellation = outcome;
      if (outcome === 'unknown') run.error = 'The workflow is stopped, but Council cancellation could not be confirmed. Inspect the original discussion and acknowledge recovery before starting another workflow.';
      return;
    }
    if (attempt.councilCancellation !== 'unknown' && attempt.councilCancellation !== 'confirmed') { attempt.councilCancellation = 'requested'; delete attempt.nudgeAcknowledgedAt; }
    return { ideaId: run.ideaId, workflowRunId: run.id, attemptId: attempt.id, childRunId: attempt.nudgeRunId };
  }
  abort(id: string): void { this.active.get(id)?.controller.abort(); }
  cancel(target: CouncilStop): Promise<void> {
    const key = `${target.workflowRunId}:${target.attemptId}`;
    const previous = this.cancellations.get(key); if (previous) return previous;
    const work = this.cancelOnce(target, key); this.cancellations.set(key, work); return work;
  }
  private async cancelOnce(target: CouncilStop, key: string): Promise<void> {
    const pending = this.receipts.get(target.ideaId);
    if (pending?.workflowRunId === target.workflowRunId && pending.attemptId === target.attemptId) this.receipts.delete(target.ideaId);
    let failed = false;
    try { if (!this.port?.cancel) throw new Error('Cancellation unavailable'); await this.port.cancel(target.childRunId); } catch { failed = true; }
    this.cancellationOutcomes.set(key, failed ? 'unknown' : 'confirmed');
    if (this.disposed) return;
    await this.store.transaction(state => {
      const idea = state.ideas.find(item => item.id === target.ideaId);
      const run = [idea?.workflowRun, ...(idea?.workflowHistory ?? [])].find(item => item?.id === target.workflowRunId);
      const attempt = run?.attempts.find(item => item.id === target.attemptId);
      if (!run || !attempt) return;
      attempt.councilCancellation = failed ? 'unknown' : 'confirmed';
      if (failed) run.error = 'The workflow is stopped, but Council cancellation could not be confirmed. Inspect the original discussion and acknowledge recovery before starting another workflow.';
      touch(run);
    });
    if (failed) throw new Error('The workflow is stopped. Inspect the original Council discussion because its cancellation could not be confirmed.');
  }
  async dispose(): Promise<void> { this.disposed = true; for (const value of this.active.values()) value.controller.abort(); await Promise.allSettled([...this.active.values()].map(value => value.promise)); }
}
