import type { StudioStore } from './studio-store';
import type { InternalState } from './ports';
import type { AgentTaskPort, AgentTaskResult } from './agent-task';
import type { CouncilWorkflowStep } from '../domain/configured-workflow';
import { workflowArtifactCheck, workflowArtifactHash, workflowProposalRevision, type WorkflowRun } from '../domain/configured-workflow-run';
import { configuredIdea, configuredInputs } from './configured-workflow-policy';

const now = () => new Date().toISOString();
function touch(run: WorkflowRun) { run.revision++; run.updatedAt = now(); }

/** Admission and completion are distinct durable boundaries; polling never resubmits a child. */
export class ConfiguredWorkflowCouncil {
  private readonly active = new Map<string, { controller: AbortController; promise: Promise<void> }>();
  constructor(private readonly store: StudioStore, private readonly port: AgentTaskPort | undefined, private readonly advance: (state: InternalState, ideaId: string) => void) {}
  busy(id: string): boolean { return this.active.has(id); }
  reserve(state: InternalState, ideaId: string, step: CouncilWorkflowStep): void {
    if (!this.port?.result) throw new Error('Ask Council is unavailable in this host. Open desktop Obsidian.');
    const idea = configuredIdea(state, ideaId); const run = idea.workflowRun!;
    if (idea.screening?.verdict === 'flagged') throw new Error('Resolve this request’s moderation flag before asking the Council.');
    const inputs = configuredInputs(run, step); const id = crypto.randomUUID();
    run.attempts.push({ id, stepId: step.id, stepName: step.name, kind: 'council', status: 'queued', inputs: inputs.map(item => item.id), startedAt: now() });
    run.activeAttemptId = id; run.state = 'running'; touch(run);
  }
  run(ideaId: string): Promise<void> {
    const active = this.active.get(ideaId); if (active) return active.promise;
    const run = this.store.snapshot().ideas.find(item => item.id === ideaId)?.workflowRun;
    if (!run?.attempts.some(item => item.id === run.activeAttemptId && item.kind === 'council' && item.status === 'queued')) return Promise.resolve();
    const controller = new AbortController();
    const promise = this.dispatch(ideaId, controller).catch(async () => {
      await this.store.transaction(state => {
        const run = state.ideas.find(item => item.id === ideaId)?.workflowRun;
        const attempt = run?.attempts.find(item => item.id === run.activeAttemptId);
        if (!run || attempt?.kind !== 'council') return;
        attempt.status = 'failed'; attempt.finishedAt = now();
        run.state = 'attention'; run.error = 'Council preparation failed. Review the request and selected inputs before retrying.';
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
      if (workflowProposalRevision(idea) !== run.proposalRevision) throw new Error('The request changed before Council admission.');
      const context = JSON.stringify({ untrustedRequest: { id: idea.id, projectId: run.projectId, title: idea.title, description: idea.description }, boundArtifacts: configuredInputs(run, step) });
      if (context.length > 60000) throw new Error('Council context exceeds 60000 characters. Reduce the selected inputs.');
      attempt.status = 'running'; attempt.nudgeState = 'reserved'; attempt.nudgeSourcePath = `CoForge/Automations/nudge-${attempt.id}.md`; touch(run);
      return { projectId: run.projectId, ideaId, workflowRunId: run.id, attemptId: attempt.id, stepId: step.id, councilId: step.councilId, agentId: '', teamId: '', prompt: step.instructions, context, sourcePath: attempt.nudgeSourcePath,
        limits: { timeoutSeconds: run.definition.limits.timeoutSeconds, maxTurns: run.definition.limits.maxTurns, maxBudgetUsd: run.definition.limits.maxBudgetUsd },
        ...(run.automationEvent ? { automationEvent: structuredClone(run.automationEvent) } : {}), signal: controller.signal };
    });
    if (!input) return;
    try {
      controller.signal.throwIfAborted();
      const receipt = await this.port!.create(input);
      if (controller.signal.aborted) await this.port?.cancel?.(receipt.runId);
      await this.store.transaction(state => {
        const run = state.ideas.find(item => item.id === ideaId)?.workflowRun;
        if (run?.id !== input.workflowRunId) return;
        const attempt = run.attempts.find(item => item.id === input.attemptId)!;
        attempt.nudgeRunId = receipt.runId; attempt.nudgeSourcePath = receipt.sourcePath; attempt.nudgeState = 'submitted'; touch(run);
        if (receipt.sourceId) attempt.councilSourceId = receipt.sourceId;
      });
    } catch {
      await this.store.transaction(state => {
        const run = state.ideas.find(item => item.id === ideaId)?.workflowRun;
        if (run?.id !== input.workflowRunId) return;
        const attempt = run.attempts.find(item => item.id === input.attemptId)!;
        attempt.nudgeState = 'unknown'; attempt.status = 'failed'; attempt.finishedAt = now();
        if (run.state !== 'stopped') run.state = 'attention';
        run.error = 'Council admission is uncertain. Inspect the original task and acknowledge recovery before a fresh attempt.'; delete run.activeAttemptId; touch(run);
      });
    }
  }
  async reconcile(ideaId: string): Promise<void> {
    const original = this.store.snapshot().ideas.find(item => item.id === ideaId)?.workflowRun;
    const attempt = original?.attempts.find(item => item.id === original.activeAttemptId);
    if (!original || !['running', 'attention'].includes(original.state) || attempt?.kind !== 'council' || attempt.nudgeState !== 'submitted' || !attempt.nudgeRunId || !this.port?.result) return;
    let result: AgentTaskResult;
    try { result = await this.port.result(attempt.nudgeRunId); }
    catch { result = { state: 'missing' as const }; }
    if (result.state === 'pending') return;
    if (original.state === 'attention' && result.state !== 'completed') return;
    await this.store.transaction(state => {
      const idea = state.ideas.find(item => item.id === ideaId); const run = idea?.workflowRun;
      if (!idea || run?.id !== original.id || run.activeAttemptId !== attempt.id || !['running', 'attention'].includes(run.state)) return;
      const current = run.attempts.find(item => item.id === attempt.id)!;
      try {
        configuredIdea(state, ideaId);
        if (idea.screening?.verdict === 'flagged') throw new Error('Resolve this request’s moderation flag before using the Council answer.');
        if (result.state !== 'completed') throw new Error('The Council needs attention. Inspect its original child run before continuing.');
        if (result.markdown.length > 16000) throw new Error('The Council report exceeds the 16000-character workflow result limit. Its complete answers remain in the child run; no result was truncated.');
        if (result.projectId !== run.projectId || (current.councilSourceId ? result.sourceId !== current.councilSourceId : result.sourcePath !== current.nudgeSourcePath) || workflowProposalRevision(idea) !== run.proposalRevision) throw new Error('The request or Council result identity changed. Inspect the original run.');
        const step = run.definition.steps[run.cursor];
        if (step?.kind !== 'council' || step.id !== current.stepId) throw new Error('The Council step changed.');
        const inputs = configuredInputs(run, step);
        if (JSON.stringify(inputs.map(item => item.id)) !== JSON.stringify(current.inputs)) throw new Error('The bound Council inputs changed.');
        const artifact = { id: crypto.randomUUID(), runId: run.id, stepId: step.id, attemptId: attempt.id, proposalRevision: run.proposalRevision, output: 'markdown' as const, markdown: result.markdown, createdAt: now() };
        run.artifacts.push(workflowArtifactCheck({ ...artifact, contentHash: workflowArtifactHash(artifact) }));
        current.status = 'succeeded'; current.finishedAt = now(); delete run.activeAttemptId;
        run.cursor++; run.state = 'ready'; delete run.error; touch(run); this.advance(state, ideaId);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'The Council result needs review.';
        if (run.state === 'attention' && run.error === message && current.status === 'failed') return;
        current.status = 'failed'; current.finishedAt = now();
        run.state = 'attention'; run.error = message;
        // Keep the original child identity so retrying cannot dispatch a replacement.
        touch(run);
      }
    });
  }
  async cancel(id: string): Promise<void> {
    this.active.get(id)?.controller.abort();
    const run = this.store.snapshot().ideas.find(item => item.id === id)?.workflowRun;
    const attempt = run?.attempts.find(item => item.id === run.activeAttemptId);
    if (attempt?.kind === 'council' && attempt.nudgeRunId) await this.port?.cancel?.(attempt.nudgeRunId);
  }
  async dispose(): Promise<void> { for (const value of this.active.values()) value.controller.abort(); await Promise.allSettled([...this.active.values()].map(value => value.promise)); }
}
