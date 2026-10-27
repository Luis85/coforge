import { StudioError, errorMessage } from '../domain/errors';
import { recordOperation } from './population';
import type { AgentJob, AgentStage, IdeaAction, Provider } from '../domain/types';
import { riceValue, STAGE_LABELS, STAGES } from '../domain/types';
import { assertStage, heuristicSignals, isActiveJob, nextEligible, statusDuring } from '../domain/workflow';
import type { InternalState, StageResult, StageRunner, Timers } from './ports';
import { applyReview } from './review';
import { addEvent, type StudioStore } from './studio-store';
import { findProject, ideaProjectId, projectIdeas, projectPaths, projectSettings } from '../domain/projects';
import { ideaFingerprint } from '../domain/integrity';

function assertRuntime(state: InternalState, stage: AgentStage, projectId: string): void {
  const project = findProject(state, projectId);
  if (project.unavailable) throw new StudioError('Restore this project note before running agents.', 409);
  if (projectSettings(state, projectId).provider !== 'claude') return;
  if (!state.runtime.cliAvailable) throw new StudioError('Claude Code CLI is not available. Install it, sign in locally, then check the runtime in CoForge settings.', 409);
  if (!project.projectPath && (stage === 'plan' || stage === 'implement'))
    throw new StudioError('Set this project’s repository path in Project settings before planning or building.', 409);
  if (stage === 'implement' && !project.allowImplementation)
    throw new StudioError('Real implementation is disabled. Enable it for this project in Project settings after reviewing the integration guide.', 409);
}

/** Writes a successful stage result onto the idea. Local injection heuristics always apply to screening. */
function applyResult(state: InternalState, job: AgentJob, result: StageResult): void {
  const idea = state.ideas.find(i => i.id === job.ideaId);
  if (!idea) throw new Error('The idea was removed while its run was active.');
  // An idea changed or quarantined during the run must not receive a result produced for its old content.
  if (idea.status !== statusDuring(job.stage)) throw new Error(`${idea.id} changed while the run was active (now ${idea.status}). The result was discarded.`);
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
  recordOperation(state, 'job-completed');
  if (result.costUsd !== undefined) job.costUsd = result.costUsd;
  job.logs.push(`${STAGE_LABELS[job.stage]} finished. ${idea.id} is ${idea.status}.`);
  delete state.runtime.activeJobId;
  addEvent(state, 'agent', `${STAGE_LABELS[job.stage]} finished for ${idea.id}${job.provider === 'demo' ? ' (demo)' : ''}. ${idea.status === 'review' ? 'Streamer review required.' : ''}`.trim(), idea.id);
}

export interface EngineOptions { runners: Record<Provider, StageRunner>; timers: Timers; onError?: (error: Error) => void }

/** One worker, a FIFO queue of at most 50 jobs, optional timed automation and explicit cancellation. */
export class WorkflowEngine {
  private drainPromise: Promise<void> | null = null;
  private controller: AbortController | null = null;
  private activeId: string | null = null;
  private timer: number | null = null;
  private readonly lastAutomaticTick = new Map<string, number>();
  private lastProjectId: string | null = null;
  private stopped = false;
  constructor(readonly store: StudioStore, private readonly options: EngineOptions) {}

  start(): void {
    this.stopped = false;
    if (this.timer) return;
    this.timer = this.options.timers.setInterval(() => {
      if (this.drainPromise) return;
      void this.tick(false).catch(error => this.report(error));
    }, 750);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer !== null) this.options.timers.clearInterval(this.timer);
    this.timer = null;
    this.controller?.abort();
    await this.drainPromise;
    await this.store.flush();
  }

  async submit(ideaId: string, stage: AgentStage, automatic = false): Promise<AgentJob> {
    const job = await this.store.transaction(state => {
      const idea = state.ideas.find(i => i.id === ideaId);
      if (!idea) throw new StudioError('Idea not found.', 404);
      const projectId = ideaProjectId(idea);
      const settings = projectSettings(state, projectId);
      if (automatic && settings.paused) throw new StudioError('Automation is paused.', 409);
      assertStage(idea, stage);
      if (state.jobs.some(j => j.ideaId === ideaId && isActiveJob(j))) throw new StudioError('This idea already has a queued or running job.', 409);
      if (state.jobs.filter(j => j.status === 'queued').length >= 50) throw new StudioError('The queue is full. Wait for current work to finish.', 409);
      assertRuntime(state, stage, projectId);
      delete idea.lastError;
      state.manualHolds = state.manualHolds.filter(id => id !== ideaId);
      const queued: AgentJob = {
        id: crypto.randomUUID(), ideaId, projectId, stage, status: 'queued', provider: settings.provider, startedAt: new Date().toISOString(),
        logs: [`${STAGE_LABELS[stage]} queued for ${ideaId} (${settings.provider}).`],
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
    if (state.jobs.some(job => isActiveJob(job) && (!manual || job.projectId === state.activeProjectId))) return null;
    const index = state.projects.findIndex(project => project.id === this.lastProjectId);
    const projects = manual ? state.projects.filter(project => project.id === state.activeProjectId)
      : [...state.projects.slice(index + 1), ...state.projects.slice(0, index + 1)];
    for (const project of projects) {
      const settings = projectSettings(state, project.id);
      if (project.unavailable || (!manual && (settings.paused || Date.now() - (this.lastAutomaticTick.get(project.id) ?? 0) < settings.intervalSeconds * 1000))) continue;
      const next = nextEligible({ ...state, ideas: projectIdeas(state, project.id), settings, jobs: state.jobs.filter(job => job.projectId === project.id) });
      if (!next) continue;
      this.lastAutomaticTick.set(project.id, Date.now());
      this.lastProjectId = project.id;
      return this.submit(next.idea.id, next.stage, !manual);
    }
    return null;
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
      recordOperation(state, 'job-cancelled');
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
      const projectId = next.projectId ?? ideaProjectId(idea);
      if (ideaProjectId(idea) !== projectId) throw new Error('The idea moved to another project before its run started.');
      assertRuntime(state, job.stage, projectId);
      assertStage(idea, job.stage);
      job.status = 'running'; job.startedAt = new Date().toISOString();
      recordOperation(state, 'job-started');
      state.runtime.activeJobId = job.id;
      if (job.stage === 'implement') idea.status = 'building';
      idea.updatedAt = job.startedAt;
      return { idea: structuredClone(idea), settings: { ...projectSettings(state, projectId), automation: { ...projectSettings(state, projectId).automation }, provider: job.provider },
        integration: { ...state.integration, ...projectPaths(findProject(state, projectId)) } };
    });
    if (!snapshot) return;
    const fingerprint = ideaFingerprint(snapshot.idea);
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
      const idea = state.ideas.find(item => item.id === job.ideaId);
      if (!idea || ideaFingerprint(idea) !== fingerprint) throw new Error('The request or its project changed while the run was active. Its result was discarded.');
      applyResult(state, job, result);
    });
  }

  private async fail(next: AgentJob, cancelled: boolean, error: unknown): Promise<void> {
    const message = cancelled ? 'Run cancelled. Inspect any partial worktree before retrying.' : errorMessage(error);
    await this.store.transaction(state => {
      const job = state.jobs.find(j => j.id === next.id);
      if (job) { job.status = cancelled ? 'cancelled' : 'failed'; job.error = message; job.finishedAt = new Date().toISOString(); job.logs.push(message); }
      if (job) recordOperation(state, cancelled ? 'job-cancelled' : 'job-failed', cancelled ? 'committed' : 'none');
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
