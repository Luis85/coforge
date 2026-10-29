import type { StudioStore } from './studio-store';
import type { InternalState } from './ports';
import { uncertainTaskAttempt, type AgentTaskPort, type AgentTaskReceipt } from './agent-task';
import type { NudgeWorkflowStep } from '../domain/configured-workflow';
import type { WorkflowRun } from '../domain/configured-workflow-run';
import { workflowProposalRevision } from '../domain/configured-workflow-run';
import { configuredInputs, configuredIdea } from './configured-workflow-policy';
import { recordOperation } from './population';
const time = () => new Date().toISOString();
function touch(run: WorkflowRun) { run.revision++; run.updatedAt = time(); }

/** A nudge admits an independent agent task; it never invents an AI output or waits for child completion. */
export class ConfiguredWorkflowNudges {
  private readonly active = new Map<string, { controller: AbortController; promise: Promise<void> }>();
  constructor(private readonly store: StudioStore, private readonly port: AgentTaskPort | undefined, private readonly advance: (state: InternalState, ideaId: string) => void) {}
  busy(ideaId: string): boolean { return this.active.has(ideaId); }
  reserve(state: InternalState, ideaId: string, step: NudgeWorkflowStep): void {
    if (!this.port) throw new Error('Agent-task nudges are unavailable in this host.');
    const idea = configuredIdea(state, ideaId); const run = idea.workflowRun!;
    if (run.attempts.some(uncertainTaskAttempt)) throw new Error('Inspect and acknowledge the uncertain task outcome before starting a fresh attempt.');
    const inputs = configuredInputs(run, step);
    const id = crypto.randomUUID();
    run.attempts.push({ id, stepId: step.id, stepName: step.name, kind: 'nudge', status: 'queued', inputs: inputs.map(input => input.id), startedAt: time() });
    run.activeAttemptId = id; run.state = 'running'; touch(run);
    recordOperation(state, 'workflow-nudge-requested', 'committed', undefined, 1, run.id);
  }
  run(ideaId: string): Promise<void> {
    const previous = this.active.get(ideaId); if (previous) return previous.promise;
    const run = this.store.snapshot().ideas.find(idea => idea.id === ideaId)?.workflowRun;
    if (!run?.attempts.some(attempt => attempt.id === run.activeAttemptId && attempt.kind === 'nudge' && attempt.status === 'queued')) return Promise.resolve();
    const controller = new AbortController();
    const promise = this.dispatch(ideaId, controller).catch(async () => {
      await this.store.transaction(state => {
        const idea = state.ideas.find(idea => idea.id === ideaId); const current = idea?.workflowRun;
        const attempt = current?.attempts.find(attempt => attempt.id === current.activeAttemptId);
        if (!idea || !current || attempt?.kind !== 'nudge') return;
        attempt.status = 'failed'; attempt.error = 'The nudge did not complete. Inspect its source and run before acknowledging recovery.'; attempt.nudgeState = 'unknown'; attempt.finishedAt = time();
        if (current.state !== 'stopped') current.state = 'attention'; current.error = attempt.error; idea.lastError = attempt.error; delete current.activeAttemptId; touch(current);
      });
    }).finally(() => { this.active.delete(ideaId); });
    this.active.set(ideaId, { controller, promise }); return promise;
  }
  private async dispatch(ideaId: string, controller: AbortController): Promise<void> {
    const input = await this.store.transaction(state => {
      const idea = state.ideas.find(idea => idea.id === ideaId); const run = idea?.workflowRun;
      const attempt = run?.attempts.find(attempt => attempt.id === run.activeAttemptId); const step = run?.definition.steps[run.cursor];
      if (!idea || !run || run.state !== 'running' || !attempt || attempt.kind !== 'nudge' || attempt.status !== 'queued' || step?.kind !== 'nudge') return null;
      if (workflowProposalRevision(idea) !== run.proposalRevision) throw new Error('The request changed before the nudge could start.');
      controller.signal.throwIfAborted();
      attempt.status = 'running'; attempt.nudgeState = 'reserved'; attempt.nudgeSourcePath = `CoForge/Automations/nudge-${attempt.id}.md`; touch(run);
      const context = JSON.stringify({ untrustedRequest: { id: idea.id, projectId: run.projectId, title: idea.title, description: idea.description }, boundArtifacts: configuredInputs(run, step) });
      if (context.length > 60000) throw new Error('The complete nudge context exceeds 60000 characters. Reduce its selected input roles.');
      return { projectId: run.projectId, ideaId, workflowRunId: run.id, attemptId: attempt.id, stepId: step.id, teamId: step.teamId, agentId: step.agentId,
        prompt: step.instructions, context, sourcePath: attempt.nudgeSourcePath, limits: { timeoutSeconds: run.definition.limits.timeoutSeconds, maxTurns: run.definition.limits.maxTurns, maxBudgetUsd: run.definition.limits.maxBudgetUsd },
        ...(run.automationEvent ? { automationEvent: structuredClone(run.automationEvent) } : {}), signal: controller.signal };
    });
    if (!input) return;
    let receipt: AgentTaskReceipt | undefined;
    try {
      if (!this.port) throw new Error('Agent-task nudges are unavailable.');
      receipt = await this.port.create(input);
      if (controller.signal.aborted) await this.port.cancel?.(receipt.runId);
    } catch {
      await this.store.transaction(state => {
        const idea = state.ideas.find(idea => idea.id === ideaId); const run = idea?.workflowRun;
        if (!idea || run?.id !== input.workflowRunId) return;
        const attempt = run.attempts.find(attempt => attempt.id === input.attemptId)!;
        attempt.status = run.state === 'stopped' ? 'cancelled' : 'failed'; attempt.nudgeState = 'unknown'; attempt.finishedAt = time();
        if (receipt) { attempt.nudgeRunId = receipt.runId; attempt.nudgeSourcePath = receipt.sourcePath; }
        attempt.error = 'Agent-task admission could not be confirmed. Inspect the source and original child run, then acknowledge recovery before a fresh nudge.';
        if (run.state !== 'stopped') run.state = 'attention'; run.error = attempt.error; idea.lastError = attempt.error; delete run.activeAttemptId; touch(run);
        recordOperation(state, 'workflow-nudge-unknown', 'committed', undefined, 1, run.id);
      }); return;
    }
    const confirmed = receipt;
    await this.store.transaction(state => {
      const idea = state.ideas.find(idea => idea.id === ideaId); const run = idea?.workflowRun;
      if (!idea || run?.id !== input.workflowRunId || !confirmed) return;
      const attempt = run.attempts.find(attempt => attempt.id === input.attemptId)!;
      attempt.nudgeRunId = confirmed.runId; attempt.nudgeSourcePath = confirmed.sourcePath; attempt.finishedAt = time();
      if (run.state === 'stopped' || controller.signal.aborted) { attempt.status = 'cancelled'; attempt.nudgeState = 'cancelled'; touch(run); return; }
      attempt.status = 'succeeded'; attempt.nudgeState = 'submitted'; delete run.activeAttemptId;
      if (workflowProposalRevision(idea) !== run.proposalRevision) { run.state = 'attention'; run.error = 'The request changed during task admission. Inspect the child task before continuing.'; touch(run); return; }
      run.cursor++; run.state = 'ready'; delete run.error; delete idea.lastError; touch(run);
      recordOperation(state, 'workflow-nudge-submitted', 'committed', undefined, 1, run.id); this.advance(state, ideaId);
    });
    // Consecutive local nudges are handled by the outer drain without taking the model worker.
    const next = this.store.snapshot().ideas.find(idea => idea.id === ideaId)?.workflowRun;
    const nextAttempt = next?.attempts.find(attempt => attempt.id === next.activeAttemptId);
    if (nextAttempt?.kind === 'nudge' && nextAttempt.status === 'queued') await this.dispatch(ideaId, controller);
  }
  acknowledge(ideaId: string, revision: number, consent: boolean): Promise<void> {
    return this.store.transaction(state => {
      if (!consent) throw new Error('Explicit recovery acknowledgement is required.');
      const idea = state.ideas.find(item => item.id === ideaId); const run = idea?.workflowRun;
      if (!idea || !run || run.revision !== revision || !['attention', 'stopped', 'awaiting-review', 'finished'].includes(run.state) || this.busy(ideaId)) throw new Error('The workflow changed. Refresh before acknowledging recovery.');
      const attempts = run.attempts.filter(uncertainTaskAttempt);
      if (!attempts.length) throw new Error('There is no uncertain task or cancellation to acknowledge.');
      const error = run.error;
      for (const attempt of attempts) attempt.nudgeAcknowledgedAt = time();
      if (run.state === 'attention' && !['shipped', 'rejected'].includes(idea.status)) run.state = 'ready';
      delete run.error; if (idea.lastError === error) delete idea.lastError;
      touch(run); recordOperation(state, 'workflow-nudge-recovered', 'committed', undefined, 1, run.id);
    });
  }
  abort(ideaId: string): void { this.active.get(ideaId)?.controller.abort(); }
  async dispose(): Promise<void> { for (const active of this.active.values()) active.controller.abort(); await Promise.allSettled([...this.active.values()].map(active => active.promise)); }
}
