import { StudioError, errorMessage } from '../domain/errors';
import type { AgentJob, AgentStage, IdeaAction, Provider } from '../domain/types';
import { riceValue, STAGE_LABELS, STAGES } from '../domain/types';
import { assertStage, heuristicSignals, isActiveJob, nextEligible } from '../domain/workflow';
import type { InternalState, StageResult, StageRunner } from './ports';
import { applyReview } from './review';
import { addEvent, type StudioStore } from './studio-store';

function assertRuntime(state: InternalState, stage: AgentStage): void {
  if (state.settings.provider !== 'claude') return;
  if (!state.runtime.cliAvailable) throw new StudioError('Claude Code CLI is not available. Install it, sign in locally, then check the runtime in CoForge settings.', 409);
  if (!state.runtime.projectPath && (stage === 'plan' || stage === 'implement'))
    throw new StudioError('Set the game repository path in the CoForge plugin settings before planning or building.', 409);
  if (stage === 'implement' && !state.runtime.allowImplementation)
    throw new StudioError('Real implementation is disabled. Enable it in the CoForge plugin settings after reviewing the integration guide.', 409);
}

/** Writes a successful stage result onto the idea. Local injection heuristics always apply to screening. */
function applyResult(state: InternalState, job: AgentJob, result: StageResult): void {
  const idea = state.ideas.find(i => i.id === job.ideaId);
  if (!idea) throw new Error('The idea was removed while its run was active.');
  if (job.stage === 'screen') {
    if (!result.screening) throw new Error('The screening agent returned no valid screening result.');
    const signals = heuristicSignals(`${idea.title}\n${idea.description}`);
    idea.screening = { ...result.screening, provider: job.provider };
    if (signals.length) {
      idea.screening.verdict = 'flagged';
      idea.screening.signals = [...new Set([...idea.screening.signals, ...signals])];
      idea.screening.reason = 'Local checks detected suspicious instructions. ' + idea.screening.reason;
    }
    idea.status = idea.screening.verdict === 'flagged' ? 'flagged' : 'screened';
  } else if (job.stage === 'score') {
    if (!result.rice) throw new Error('The scoring agent returned no valid RICE estimate.');
    idea.rice = { ...result.rice, score: riceValue(result.rice) }; idea.status = 'ranked';
  } else if (job.stage === 'plan') {
    if (!result.plan) throw new Error('The planning agent returned no saved plan.');
    idea.plan = result.plan; idea.status = 'planned';
  } else {
    if (!result.increment) throw new Error('The implementation agent returned no review artifact.');
    idea.increment = result.increment; idea.status = 'review';
  }
  delete idea.lastError;
  idea.updatedAt = new Date().toISOString();
  job.status = 'succeeded'; job.finishedAt = idea.updatedAt;
  if (result.costUsd !== undefined) job.costUsd = result.costUsd;
  job.logs.push(`${STAGE_LABELS[job.stage]} finished. ${idea.id} is ${idea.status}.`);
  delete state.runtime.activeJobId;
  addEvent(state, 'agent', `${STAGE_LABELS[job.stage]} finished for ${idea.id}${job.provider === 'demo' ? ' (demo)' : ''}. ${idea.status === 'review' ? 'Streamer review required.' : ''}`.trim(), idea.id);
}

export interface EngineOptions { runners: Record<Provider, StageRunner>; onError?: (error: Error) => void }

/** One worker, a FIFO queue of at most 50 jobs, optional timed automation and explicit cancellation. */
export class WorkflowEngine {
  private drainPromise: Promise<void> | null = null;
  private controller: AbortController | null = null;
  private activeId: string | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastAutomaticTick = 0;
  private stopped = false;
  constructor(readonly store: StudioStore, private readonly options: EngineOptions) {}

  start(): void {
    this.stopped = false;
    if (this.timer) return;
    this.timer = setInterval(() => {
      const state = this.store.snapshot();
      if (state.settings.paused || this.drainPromise || Date.now() - this.lastAutomaticTick < state.settings.intervalSeconds * 1000) return;
      this.lastAutomaticTick = Date.now();
      void this.tick(false).catch(error => this.report(error));
    }, 750);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.controller?.abort();
    await this.drainPromise;
    await this.store.flush();
  }

  async submit(ideaId: string, stage: AgentStage, automatic = false): Promise<AgentJob> {
    const job = await this.store.transaction(state => {
      if (automatic && state.settings.paused) throw new StudioError('Automation is paused.', 409);
      const idea = state.ideas.find(i => i.id === ideaId);
      if (!idea) throw new StudioError('Idea not found.', 404);
      assertStage(idea, stage);
      if (state.jobs.some(j => j.ideaId === ideaId && isActiveJob(j))) throw new StudioError('This idea already has a queued or running job.', 409);
      if (state.jobs.filter(j => j.status === 'queued').length >= 50) throw new StudioError('The queue is full. Wait for current work to finish.', 409);
      assertRuntime(state, stage);
      delete idea.lastError;
      state.manualHolds = state.manualHolds.filter(id => id !== ideaId);
      const queued: AgentJob = {
        id: crypto.randomUUID(), ideaId, stage, status: 'queued', provider: state.settings.provider, startedAt: new Date().toISOString(),
        logs: [`${STAGE_LABELS[stage]} queued for ${ideaId} (${state.settings.provider}).`],
      };
      state.jobs.push(queued);
      addEvent(state, 'agent', `${STAGE_LABELS[stage]} queued for ${ideaId}.`, ideaId);
      return queued;
    });
    this.kick();
    return job;
  }

  async tick(manual = true): Promise<AgentJob | null> {
    const state = this.store.internalSnapshot();
    if ((!manual && state.settings.paused) || state.jobs.some(isActiveJob)) return null;
    const next = nextEligible(state);
    return next ? this.submit(next.idea.id, next.stage, !manual) : null;
  }

  async action(ideaId: string, action: IdeaAction, note = ''): Promise<unknown> {
    if ((STAGES as readonly string[]).includes(action)) return this.submit(ideaId, action as AgentStage);
    return this.store.transaction(state => applyReview(state, ideaId, action as Exclude<IdeaAction, AgentStage>, note));
  }

  async cancel(jobId: string): Promise<void> {
    if (this.activeId === jobId && this.controller) { this.controller.abort(); return; }
    await this.store.transaction(state => {
      const job = state.jobs.find(j => j.id === jobId);
      if (!job) throw new StudioError('Job not found.', 404);
      if (job.status !== 'queued') throw new StudioError('Only queued or running jobs can be cancelled.', 409);
      job.status = 'cancelled'; job.finishedAt = new Date().toISOString(); job.logs.push('Cancelled by the streamer.');
      const idea = state.ideas.find(i => i.id === job.ideaId);
      if (idea) idea.lastError = 'Run cancelled. Start the stage manually when ready.';
      addEvent(state, 'agent', `Queued ${job.stage} run for ${job.ideaId} cancelled.`, job.ideaId);
    });
  }

  async waitUntilIdle(): Promise<void> {
    while (this.drainPromise) await this.drainPromise;
    await this.store.flush();
  }

  private kick(): void {
    if (this.drainPromise || this.stopped) return;
    this.drainPromise = this.drain().catch(error => this.report(error)).finally(() => {
      this.drainPromise = null;
      if (!this.stopped && this.store.snapshot().jobs.some(j => j.status === 'queued')) this.kick();
    });
  }

  private async drain(): Promise<void> {
    while (!this.stopped) {
      const next = this.store.snapshot().jobs.find(j => j.status === 'queued');
      if (!next) return;
      const controller = new AbortController();
      this.controller = controller; this.activeId = next.id;
      try { await this.run(next, controller); }
      catch (error) { await this.fail(next, controller.signal.aborted, error); }
      finally { this.controller = null; this.activeId = null; }
    }
  }

  private async run(next: AgentJob, controller: AbortController): Promise<void> {
    const snapshot = await this.store.transaction(state => {
      const job = state.jobs.find(j => j.id === next.id);
      const idea = state.ideas.find(i => i.id === next.ideaId);
      if (!job || job.status !== 'queued') return null;
      if (!idea) throw new Error('The idea was removed before its run started.');
      assertStage(idea, job.stage);
      job.status = 'running'; job.startedAt = new Date().toISOString();
      state.runtime.activeJobId = job.id;
      if (job.stage === 'implement') idea.status = 'building';
      idea.updatedAt = job.startedAt;
      return { idea: structuredClone(idea), settings: { ...state.settings, provider: job.provider }, integration: { ...state.integration } };
    });
    if (!snapshot) return;
    const runner = this.options.runners[next.provider];
    const result = await runner({
      stage: next.stage, ...snapshot, signal: controller.signal,
      onLog: message => {
        void this.store.transaction(state => {
          const job = state.jobs.find(j => j.id === next.id);
          if (job) job.logs = [...job.logs, message.slice(0, 8000)].slice(-200);
        }).catch(error => this.report(error));
      },
    });
    controller.signal.throwIfAborted();
    await this.store.transaction(state => {
      const job = state.jobs.find(j => j.id === next.id);
      if (!job) throw new Error('The run record disappeared before its result was saved.');
      applyResult(state, job, result);
    });
  }

  private async fail(next: AgentJob, cancelled: boolean, error: unknown): Promise<void> {
    const message = cancelled ? 'Run cancelled. Inspect any partial worktree before retrying.' : errorMessage(error);
    await this.store.transaction(state => {
      const job = state.jobs.find(j => j.id === next.id);
      if (job) { job.status = cancelled ? 'cancelled' : 'failed'; job.error = message; job.finishedAt = new Date().toISOString(); job.logs.push(message); }
      const idea = state.ideas.find(i => i.id === next.ideaId);
      if (idea) { idea.lastError = message; idea.updatedAt = new Date().toISOString(); if (idea.status === 'building') idea.status = 'planned'; }
      delete state.runtime.activeJobId;
      addEvent(state, 'agent', `${STAGE_LABELS[next.stage]} ${cancelled ? 'cancelled' : 'failed'} for ${next.ideaId}. Manual retry required.`, next.ideaId);
    });
  }

  private report(error: unknown): void {
    this.options.onError?.(error instanceof Error ? error : new Error(String(error)));
  }
}
