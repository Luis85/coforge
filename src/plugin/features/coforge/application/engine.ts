import { StudioError, errorMessage } from '../domain/errors';
import { recordOperation } from './population';
import type { AgentJob, AgentStage, IdeaAction, Increment } from '../domain/types';
import { riceValue, STAGE_LABELS, STAGES } from '../domain/types';
import { assertStage, heuristicSignals, isActiveJob, nextEligible, statusDuring } from '../domain/workflow';
import type { InternalState, StageResult, StageRunner, Timers } from './ports';
import { applyReview } from './review';
import { addEvent, type StudioStore } from './studio-store';
import { copySettings, findProject, ideaProjectId, projectIdeas, projectPaths, projectSettings } from '../domain/projects';
import { ideaFingerprint } from '../domain/integrity';
import { agentModelCheck, stageAgent } from '../domain/stage-agents';
import { stageUsageCheck, hasTokenUsage, type StageUsage } from '../domain/ai-usage';
import { workflowIntegrityKey } from './workflow-note-integrity';
import { workflowProposalRevision } from '../domain/configured-workflow-run';
import { ConfiguredWorkflowEngine } from './configured-workflow-engine';
import { assertWorkflowNotStopped } from './workflow-stop-policy';
import type { WorkflowPlanHandoff } from './workflow-plan-handoff';
import type { AutomationContext } from '../domain/automation-context';
import type { AgentTaskPort } from './agent-task';
import { recordAgentConversation } from './agent-conversation';
import { recordAgentSessionEvent } from './agent-session';
import { providerFailureFor, providerFailureInfo, providerFailureMessage } from '../domain/provider-failure';
import { DurableBuildCoordinator } from './durable-build-coordinator';
import { DurableBuildCapacityError, type DurableBuildPort } from './durable-build-ports';
import { WorkflowJobLanes, workerBackedJob } from './workflow-job-lanes';
import { inspectDurableBuildEvidence, recoverDurableBuild } from './durable-build-recovery';
import { BackgroundBuildRetries } from './background-build-retry';
import type { BackgroundBuildRetryPort } from './background-build-retry-ports';
import type { BackgroundBuildRetryConsent } from '../domain/background-build-retry';
import { PolishingPasses } from './polishing-passes';
import type { PolishingCodePort } from './polishing-ports';
import { applyPolishingResult, rejectPolishingResult, holdPolishingRun } from './polishing-review';
import { assertPolishingMetadata, assertPolishingResolved } from './workflow-run-owner';
import { polishingSaveOptions, workflowRunSaveOptions } from './polishing-save-options';
import { effectivePolishingIdea } from './polishing-amendments';
import { HostOperationLifetime } from './host-operation-lifetime';
import { managedWorkflowContinuation } from './managed-workflow-continuation';

function assertRuntime(state: InternalState, stage: AgentStage, projectId: string, provider = stageAgent(projectSettings(state, projectId), stage).provider): void {
  const project = findProject(state, projectId);
  if (project.unavailable) throw new StudioError('Restore this project note before running agents.', 409);
  if (provider === 'herdr') {
    if (!state.runtime.herdrWorkflow?.ready) throw new StudioError(state.runtime.herdrWorkflow?.message || 'Connect Herdr and load its recovery journals before running workflow steps.', 409);
    if (!project.projectPath) throw new StudioError('Set this project’s workspace before running Herdr workflow steps.', 409);
    if (stage === 'implement' && !project.allowImplementation) throw new StudioError('Real implementation is disabled for this project.', 409);
    return;
  }
  if (provider !== 'claude' && provider !== 'codex') return;
  if (provider === 'codex' && !state.runtime.codexAvailable) throw new StudioError('Codex CLI is not available. Install it, sign in locally, then check Runtime settings.', 409);
  if (provider === 'claude' && !state.runtime.cliAvailable) throw new StudioError('Claude Code CLI is not available. Install it, sign in locally, then check the runtime in CoForge settings.', 409);
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
    const signals = heuristicSignals(`${idea.title}\n${idea.description}\n${idea.requestObject ? JSON.stringify(idea.requestObject) : ''}\n${idea.contexts?.map(context => context.text).join('\n') ?? ''}`);
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
  recordOperation(state, 'job-completed', 'committed', undefined, 1, job.id);
  if (result.costUsd !== undefined) job.costUsd = result.costUsd;
  job.logs.push(`${STAGE_LABELS[job.stage]} finished. ${idea.id} is ${idea.status}.`);
  if (state.runtime.activeJobId === job.id) delete state.runtime.activeJobId;
  addEvent(state, 'agent', `${STAGE_LABELS[job.stage]} finished for ${idea.id}${job.provider === 'demo' ? ' (demo)' : ''}. ${idea.status === 'review' ? 'Streamer review required.' : ''}`.trim(), idea.id);
}

export interface EngineOptions { polishingSources?: BackgroundBuildRetryPort; polishingCode?: PolishingCodePort; backgroundBuildRetries?: BackgroundBuildRetryPort; durableBuilds?: DurableBuildPort; outputTemplates?: import('./workflow-output-templates').WorkflowOutputTemplateActions; agentTasks?: AgentTaskPort; runners: { demo: StageRunner; claude: StageRunner; codex?: StageRunner; herdr?: StageRunner; mcp?: StageRunner }; timers: Timers; onError?: (error: Error) => void; assertWorkflowReviewable?: (workspaceId: string, expectedIncrement: Increment) => Promise<void> }

/** Vault-wide Build and short-task pools with bounded FIFO queues and explicit cancellation. */
export class WorkflowEngine {
  private readonly configured: ConfiguredWorkflowEngine;
  private readonly lanes: WorkflowJobLanes;
  private readonly durable: DurableBuildCoordinator;
  private readonly buildRetries: BackgroundBuildRetries;
  private readonly polishing: PolishingPasses;
  private readonly hostLifetime = new HostOperationLifetime();
  private timer: number | null = null;
  private readonly lastAutomaticTick = new Map<string, number>();
  private lastProjectId: string | null = null;
  private stopped = false;
  private dispatchDeferred = false;
  private pulsing = false;
  constructor(readonly store: StudioStore, private readonly options: EngineOptions) {
    this.configured = new ConfiguredWorkflowEngine(store, { dispatchAllowed: () => !this.stopped && !this.dispatchDeferred, durableBuilds: options.durableBuilds, outputTemplates: options.outputTemplates, agentTasks: options.agentTasks, runners: options.runners, cost: (id, value) => this.recordCost(id, value), usage: (id, value) => this.recordTokens(id, value) });
    this.durable = new DurableBuildCoordinator(store, options.durableBuilds, (state, job, result) => this.configured.complete(state, job, result), ideaId => this.configured.flushDelegated(ideaId).catch(error => this.report(error)));
    this.lanes = new WorkflowJobLanes(store, (job, controller) => this.dispatch(job, controller), error => this.report(error));
    this.buildRetries = new BackgroundBuildRetries(store, options.backgroundBuildRetries, options.durableBuilds, ideaId => this.lanes.hasActiveIdea(ideaId), (state, ideaId, approval) => this.configured.queueBackgroundRetry(state, ideaId, approval));
    this.polishing = new PolishingPasses(store, options.backgroundBuildRetries, options.durableBuilds, options.agentTasks, ideaId => this.lanes.hasActiveIdea(ideaId), (state, ideaId, pass, ids) => this.configured.queuePolishing(state, ideaId, pass, ids), options.polishingSources);
  }
  acknowledgeWorkflowNudge(ideaId: string, revision: number, consent: boolean) { return this.configured.acknowledgeNudge(ideaId, revision, consent); }
  async startWorkflow(ideaId: string) { const run = await this.configured.start(ideaId); this.kick(); return run; }
  async restartWorkflowFromOperator(ideaId: string) { const run = await this.configured.restart(ideaId); this.kick(); return run; }
  previewBackgroundBuildRetry(ideaId: string) { return this.buildRetries.preview(ideaId); }
  async confirmBackgroundBuildRetry(ideaId: string, previewId: string, consent: BackgroundBuildRetryConsent): Promise<void> { await this.buildRetries.confirm(ideaId, previewId, consent); this.kick(); }
  previewPolishingPass(ideaId: string, feedback: string) { return this.polishing.preview(ideaId, feedback); }
  async confirmPolishingPass(ideaId: string, previewId: string, consent: BackgroundBuildRetryConsent): Promise<void> { await this.polishing.confirm(ideaId, previewId, consent); this.kick(); }
  async applyPolishingResult(ideaId: string, runId: string, revision: number): Promise<void> { return applyPolishingResult(this.store, this.options.polishingSources ?? this.options.backgroundBuildRetries, this.options.polishingCode, ideaId, runId, revision, this.hostLifetime.capture()); }
  rejectPolishingResult(ideaId: string, runId: string, revision: number): Promise<void> { return rejectPolishingResult(this.store, ideaId, runId, revision); }
  async stopPolishingPass(ideaId: string, runId: string): Promise<void> {
    await this.store.transaction(state => holdPolishingRun(state, ideaId, runId), { atomicCommand: true });
    for (const job of this.store.snapshot().jobs.filter(item => item.ideaId === ideaId && item.workflow?.runId === runId && isActiveJob(item))) {
      if (job.durable) await this.durable.reconcile(ideaId); else this.lanes.abort(job.id);
    }
  }
  async startTriggeredWorkflow(ideaId: string, event: AutomationContext, expectedDefinitionJson: string) { const run = await this.configured.start(ideaId, true, undefined, false, event, expectedDefinitionJson); this.kick(); return run; }
  async startMcpWorkflow(ideaId: string) { const run = await this.configured.start(ideaId, true, undefined, true); this.kick(); return run; }
  async startWorkflowFromPlan(ideaId: string, handoff: WorkflowPlanHandoff) { const run = await this.configured.start(ideaId, true, handoff); this.kick(); return run; }
  async runWorkflowStep(ideaId: string) {
    const continuation = () => { const state = this.store.snapshot(); return managedWorkflowContinuation(state.ideas.find(idea => idea.id === ideaId)?.workflowRun, state.jobs); };
    if (continuation() === 'settling') await this.durable.reconcile(ideaId);
    if (['settling', 'unverified'].includes(continuation() ?? '')) throw new Error('The original agent session is still being settled. Check its session status before continuing; no agent was restarted.');
    const run = await this.configured.next(ideaId); this.kick(); return run;
  }
  async completeWorkflowManual(ideaId: string, revision: number, checkedIds: string[], note = '') { const run = await this.configured.manual(ideaId, revision, checkedIds, note); this.kick(); return run; }
  async stopWorkflow(ideaId: string) {
    const auxiliary = this.store.snapshot().ideas.find(item => item.id === ideaId)?.polishingRuns?.find(item => item.review === 'pending' && ['ready', 'running', 'awaiting-review'].includes(item.workflow.state));
    if (auxiliary) { await this.stopPolishingPass(ideaId, auxiliary.id); const updated = this.store.snapshot().ideas.find(item => item.id === ideaId); return updated?.workflowRun ?? updated?.polishingRuns?.find(item => item.id === auxiliary.id)?.workflow ?? auxiliary.workflow; }
    const job = this.store.snapshot().jobs.find(item => item.ideaId === ideaId && isActiveJob(item));
    const run = await this.configured.stop(ideaId);
    if (job?.durable) await this.durable.reconcile(ideaId);
    else if (job) this.lanes.abort(job.id);
    return run;
  }

  start(): void {
    this.hostLifetime.open();
    this.stopped = false;
    this.dispatchDeferred = false;
    this.lanes.open(); this.durable.attach();
    if (this.timer) return;
    this.timer = this.options.timers.setInterval(() => {
      if (this.pulsing || this.stopped) return;
      this.pulsing = true;
      void this.durable.reconcile().catch(error => this.report(error)).then(() => { if (!this.stopped) return this.tick(false); }).then(() => { if (!this.stopped) this.lanes.poke(); }).catch(error => this.report(error)).finally(() => { this.pulsing = false; });
    }, 750);
    this.kick();
  }
  preventDispatchUntilStart(): void { this.dispatchDeferred = true; this.lanes.pause(); }

  async stop(): Promise<void> {
    this.hostLifetime.close();
    this.buildRetries.clear();
    this.polishing.clear();
    this.stopped = true;
    if (this.timer !== null) this.options.timers.clearInterval(this.timer);
    this.timer = null;
    await this.durable.detach();
    await this.lanes.close();
    await this.configured.dispose();
    await this.store.flush();
  }

  async submit(ideaId: string, stage: AgentStage, automatic = false): Promise<AgentJob> {
    const job = await this.store.transaction(state => {
      const idea = state.ideas.find(i => i.id === ideaId);
      if (!idea) throw new StudioError('Idea not found.', 404);
      assertPolishingMetadata(state, ideaId);
      assertPolishingResolved(idea);
      const projectId = ideaProjectId(idea);
      const settings = projectSettings(state, projectId);
      assertWorkflowNotStopped(state, ideaId);
      if (settings.workflow || idea.workflowRun || Object.hasOwn(state.integrity, workflowIntegrityKey(idea))) throw new StudioError('Use this project’s configured workflow controls instead of legacy stage actions. Restore missing managed progress before reviewing preserved changes.', 409);
      const agent = stageAgent(settings, stage);
      if (agent.provider === 'herdr' && !this.options.runners.herdr) throw new StudioError('Herdr workflow execution is unavailable in this host.', 409);
      if (automatic && settings.paused) throw new StudioError('Automation is paused.', 409);
      assertStage(idea, stage);
      if (state.jobs.some(j => j.ideaId === ideaId && isActiveJob(j))) throw new StudioError('This idea already has a queued or running job.', 409);
      if (state.jobs.filter(j => j.status === 'queued').length >= 50) throw new StudioError('The queue is full. Wait for current work to finish.', 409);
      assertRuntime(state, stage, projectId, agent.provider);
      delete idea.lastError;
      state.manualHolds = state.manualHolds.filter(id => id !== ideaId);
      const queued: AgentJob = {
        id: crypto.randomUUID(), ideaId, projectId, stage, status: 'queued', provider: agent.provider, ...(agent.provider !== 'demo' ? { model: agent.model } : {}), ...(agent.provider === 'herdr' ? { herdrAgent: agent.herdrAgent ?? 'claude' } : {}), startedAt: new Date().toISOString(),
        logs: [`${STAGE_LABELS[stage]} queued for ${ideaId} (${agent.provider}).`],
      };
      state.jobs.push(queued);
      recordOperation(state, 'job-queued', 'none', undefined, 1, queued.id);
      addEvent(state, 'agent', `${STAGE_LABELS[stage]} queued for ${ideaId}.`, ideaId);
      return queued;
    }, workflowRunSaveOptions(undefined, this.store.internalSnapshot().ideas.find(idea => idea.id === ideaId)));
    this.kick();
    return job;
  }

  async tick(manual = true): Promise<AgentJob | null> {
    if (this.dispatchDeferred || this.stopped) return null;
    const state = this.store.internalSnapshot();
    if (state.jobs.filter(job => job.status === 'queued').length >= 50) return null;
    const index = state.projects.findIndex(project => project.id === this.lastProjectId);
    const projects = manual ? state.projects.filter(project => project.id === state.activeProjectId)
      : [...state.projects.slice(index + 1), ...state.projects.slice(0, index + 1)];
    for (const project of projects) {
      const settings = projectSettings(state, project.id);
      if (settings.workflow || projectIdeas(state, project.id).some(idea => idea.workflowRun)) {
        const interval = settings.workflow?.limits.intervalSeconds ?? settings.intervalSeconds;
        if (!manual && settings.paused) continue;
        const allowNew = manual || Date.now() - (this.lastAutomaticTick.get(project.id) ?? 0) >= interval * 1000;
        const previousRuns = new Set(projectIdeas(state, project.id).map(idea => idea.workflowRun?.id));
        const configured = await this.configured.tick(project.id, manual, allowNew);
        if (this.store.snapshot().ideas.some(idea => ideaProjectId(idea) === project.id && idea.workflowRun && !previousRuns.has(idea.workflowRun.id))) this.lastAutomaticTick.set(project.id, Date.now());
        if (configured) { this.lastProjectId = project.id; this.kick(); return configured; }
        if (settings.workflow) continue;
      }
      if (project.unavailable || (!manual && (settings.paused || Date.now() - (this.lastAutomaticTick.get(project.id) ?? 0) < settings.intervalSeconds * 1000))) continue;
      const next = nextEligible({ ...state, ideas: projectIdeas(state, project.id).filter(idea => !idea.workflowRun && !idea.polishingRuns?.some(run => run.review === 'pending')), settings, jobs: state.jobs.filter(job => job.projectId === project.id) });
      if (!next) continue;
      this.lastAutomaticTick.set(project.id, Date.now());
      this.lastProjectId = project.id;
      return this.submit(next.idea.id, next.stage, !manual);
    }
    return null;
  }

  async action(ideaId: string, action: IdeaAction, note = ''): Promise<unknown> {
    const currentIdea = this.store.snapshot().ideas.find(item => item.id === ideaId); if (currentIdea && ['approve', 'changes', 'reject'].includes(action)) { assertPolishingMetadata(this.store.internalSnapshot(), ideaId); assertPolishingResolved(currentIdea); }
    if ((STAGES as readonly string[]).includes(action)) return this.submit(ideaId, action as AgentStage);
    let expectedReview: { runId: string; revision: number; increment: string } | undefined;
    if (action === 'approve') {
      const idea = this.store.snapshot().ideas.find(item => item.id === ideaId);
      const run = idea?.workflowRun;
      if (run && idea.increment && (run.workspaceId || !idea.increment.simulated)) {
        if (!run.workspaceId || !this.options.assertWorkflowReviewable) throw new Error('Verify the attributed run workspace before accepting real code changes.');
        expectedReview = { runId: run.id, revision: run.revision, increment: JSON.stringify(idea.increment) };
        await this.options.assertWorkflowReviewable(run.workspaceId, idea.increment);
      }
    }
    return this.store.transaction(state => {
      const idea = state.ideas.find(idea => idea.id === ideaId);
      const run = idea?.workflowRun;
      if (action === 'approve' && idea && run && workflowProposalRevision(idea) !== run.proposalRevision)
        throw new StudioError('The request changed during this workflow. Request changes and start a fresh run before accepting its preserved code changes.', 409);
      if (expectedReview && (run?.id !== expectedReview.runId || run.revision !== expectedReview.revision || JSON.stringify(idea?.increment) !== expectedReview.increment)) throw new Error('The workflow or reviewed changes changed during verification. Inspect the current diff again.');
      if (['approve', 'changes'].includes(action) && run && run.state !== 'awaiting-review') throw new Error('Finish or stop this workflow before the final host review.');
      const result = applyReview(state, ideaId, action as Exclude<IdeaAction, AgentStage>, note);
      this.configured.review(state, ideaId, action);
      return result;
    }, workflowRunSaveOptions(currentIdea?.workflowRun, currentIdea));
  }

  async cancel(jobId: string): Promise<void> {
    const auxiliaryJob = this.store.snapshot().jobs.find(job => job.id === jobId && job.workflow?.polishingId);
    if (auxiliaryJob) {
      if (!isActiveJob(auxiliaryJob)) throw new Error('Only queued or running jobs can be cancelled.');
      const pass = this.store.snapshot().ideas.find(idea => idea.id === auxiliaryJob.ideaId)?.polishingRuns?.find(item => item.id === auxiliaryJob.workflow!.polishingId);
      if (pass) { await this.stopPolishingPass(auxiliaryJob.ideaId, pass.id); return; }
      if (auxiliaryJob.durable) { await this.durable.cancel(auxiliaryJob.id); return; }
    }
    const workerJob = this.store.snapshot().jobs.find(job => job.id === jobId && (job.durable || workerBackedJob(job)));
    if (workerJob) {
      if (!isActiveJob(workerJob)) throw new Error('Only queued or running jobs can be cancelled.');
      const state = this.store.snapshot(); const idea = state.ideas.find(item => item.id === workerJob.ideaId);
      const available = idea && idea.workflowRun?.id === workerJob.workflow?.runId && !['shipped', 'rejected'].includes(idea.status) && !state.projects?.find(project => project.id === ideaProjectId(idea))?.unavailable;
      if (workerJob.durable && !available) await this.durable.cancel(workerJob.id); else await this.stopWorkflow(workerJob.ideaId);
      this.kick(); return;
    }
    if (this.lanes.abort(jobId)) return;
    await this.store.transaction(state => {
      const job = state.jobs.find(j => j.id === jobId);
      if (!job) throw new StudioError('Job not found.', 404);
      if (job.status !== 'queued') throw new StudioError('Only queued or running jobs can be cancelled.', 409);
      job.status = 'cancelled'; job.finishedAt = new Date().toISOString(); job.logs.push('Cancelled by the streamer.');
      if (job.workflow) {
        const run = state.ideas.find(idea => idea.id === job.ideaId)?.workflowRun;
        if (run?.id === job.workflow.runId && run.activeAttemptId === job.workflow.attemptId) {
          const attempt = run.attempts.find(item => item.id === run.activeAttemptId);
          if (attempt) { attempt.status = 'cancelled'; attempt.finishedAt = job.finishedAt; }
          run.state = 'attention'; run.error = 'The queued step was cancelled. Explicitly retry when ready.';
          run.revision++; run.updatedAt = job.finishedAt; delete run.activeAttemptId;
        }
      }
      recordOperation(state, 'job-cancelled');
      const idea = state.ideas.find(i => i.id === job.ideaId);
      if (idea) idea.lastError = 'Run cancelled. Start the stage manually when ready.';
      addEvent(state, 'agent', `Queued ${job.stage} run for ${job.ideaId} cancelled.`, job.ideaId);
    });
  }

  async waitUntilIdle(): Promise<void> {
    await this.lanes.idle();
    await this.store.flush();
  }

  private kick(): void {
    if (!this.stopped && !this.dispatchDeferred) this.lanes.kick();
  }
  async reconcileDurableBuild(ideaId?: string, runId?: string): Promise<void> {
    await this.durable.reconcile(ideaId, runId); if (!this.stopped && !this.dispatchDeferred) this.lanes.poke();
    const failed = ideaId && this.store.durableBuildJobIds(ideaId).filter(id => !runId || this.store.durableBuildJob(id)?.workflow?.runId === runId).map(id => this.store.durableBuildError(id)).find(Boolean);
    if (failed) throw new Error(failed);
  }
  async configureConcurrency(): Promise<void> { try { await this.durable.configure(); } finally { if (!this.stopped && !this.dispatchDeferred) this.lanes.poke(); } }
  async syncDurableBuildCapacity(): Promise<void> { await this.durable.configure(); }
  async cleanupUnstartedBackground(): Promise<void> {
    const port = this.options.durableBuilds; if (!port) return;
    const jobs = this.store.snapshot().jobs.filter(job => workerBackedJob(job) && !job.durable && ['failed', 'cancelled'].includes(job.status));
    await Promise.allSettled(jobs.map(job => port.cancelUnstarted(job.id)));
  }
  inspectDurableBuildEvidence(ideaId: string, revision: number, runId?: string) { return inspectDurableBuildEvidence(this.store, this.options.durableBuilds, ideaId, revision, runId); }
  async recoverDurableBuild(ideaId: string, revision: number, consent: boolean, runId?: string): Promise<void> { await recoverDurableBuild(this.store, this.options.durableBuilds, ideaId, revision, consent, (id, snapshot) => this.durable.applyRecovered(id, snapshot), runId); this.kick(); }
  private async dispatch(job: AgentJob, controller: AbortController): Promise<void> {
    if (this.dispatchDeferred || this.stopped) return;
    try {
      if (workerBackedJob(job)) { await this.configured.verifyCoworker(job); await this.durable.launch(job); }
      else if (job.workflow) await this.configured.run(job, controller.signal);
      else await this.run(job, controller);
    } catch (error) {
      if (this.stopped) return;
      if (this.store.snapshot().jobs.find(item => item.id === job.id)?.durable) return;
      if (error instanceof DurableBuildCapacityError) { await this.store.transaction(state => { const current = state.jobs.find(item => item.id === job.id); if (current) current.error = 'Waiting for background worker capacity. No provider request was started.'; }, polishingSaveOptions(job, () => this.store.internalSnapshot())); throw error; }
      if (job.workflow) await this.configured.fail(job, controller.signal.aborted, error); else await this.fail(job, controller.signal.aborted, error);
    }
  }

  private async run(next: AgentJob, controller: AbortController): Promise<void> {
    const snapshot = await this.store.transaction(state => {
      const job = state.jobs.find(j => j.id === next.id);
      const idea = state.ideas.find(i => i.id === next.ideaId);
      if (!job || job.status !== 'queued') return null;
      if (job.provider === 'mcp') throw new Error('MCP attempts require a configured workflow.');
      if (!idea) throw new Error('The idea was removed before its run started.');
      const projectId = next.projectId ?? ideaProjectId(idea);
      if (ideaProjectId(idea) !== projectId) throw new Error('The idea moved to another project before its run started.');
      assertRuntime(state, job.stage, projectId, job.provider);
      assertStage(idea, job.stage);
      job.status = 'running'; job.startedAt = new Date().toISOString();
      const agent = stageAgent(projectSettings(state, projectId), job.stage);
      if (job.provider !== 'demo') job.model = agentModelCheck(job.model ?? agent.model);
      else delete job.model;
      recordOperation(state, 'job-started');
      state.runtime.activeJobId = job.id;
      if (job.stage === 'implement') idea.status = 'building';
      idea.updatedAt = job.startedAt;
      return { idea: structuredClone(idea), settings: { ...copySettings(projectSettings(state, projectId)), provider: job.provider, model: job.model ?? agent.model, ...(job.herdrAgent ? { herdrAgent: job.herdrAgent } : {}) },
        integration: { ...state.integration, ...projectPaths(findProject(state, projectId)) } };
    }, polishingSaveOptions(next, () => this.store.internalSnapshot()));
    if (!snapshot) return;
    const fingerprint = ideaFingerprint(snapshot.idea);
    const runner = this.options.runners[next.provider];
    if (!runner) throw new Error('The selected workflow runner is unavailable.');
    const result = await runner({
      jobId: next.id, stage: next.stage, ...snapshot, idea: effectivePolishingIdea(snapshot.idea), signal: controller.signal,
      onConversation: event => recordAgentConversation(this.store, next.id, event),
      onSessionEvent: event => recordAgentSessionEvent(this.store, next.id, event),
      onUsage: cost => this.recordCost(next.id, cost),
      onTokenUsage: usage => this.recordTokens(next.id, usage),
      onLog: message => {
        void this.store.transaction(state => {
          const job = state.jobs.find(j => j.id === next.id);
          if (job) job.logs = [...job.logs, message.slice(0, 8000)].slice(-200);
        }, polishingSaveOptions(next, () => this.store.internalSnapshot())).catch(error => this.report(error));
      },
    });
    if (result.costUsd !== undefined) await this.recordCost(next.id, result.costUsd);
    if (result.usage !== undefined) await this.recordTokens(next.id, result.usage);
    controller.signal.throwIfAborted();
    await this.store.transaction(state => {
      const job = state.jobs.find(j => j.id === next.id);
      if (!job) throw new Error('The run record disappeared before its result was saved.');
      const idea = state.ideas.find(item => item.id === job.ideaId);
      if (!idea || ideaFingerprint(idea) !== fingerprint) throw new Error('The request or its project changed while the run was active. Its result was discarded.');
      applyResult(state, job, result);
    }, polishingSaveOptions(next, () => this.store.internalSnapshot()));
  }

  private async fail(next: AgentJob, cancelled: boolean, error: unknown): Promise<void> {
    const failure = providerFailureInfo(error) ?? (cancelled ? providerFailureFor('cancelled') : undefined);
    const message = failure ? providerFailureMessage(failure) : errorMessage(error);
    await this.store.transaction(state => {
      const job = state.jobs.find(j => j.id === next.id);
      if (job) { job.status = cancelled ? 'cancelled' : 'failed'; job.error = message; job.failure = failure; job.finishedAt = new Date().toISOString(); job.logs.push(message); }
      if (job) recordOperation(state, cancelled ? 'job-cancelled' : 'job-failed', cancelled ? 'committed' : 'none');
      const idea = state.ideas.find(i => i.id === next.ideaId);
      if (idea) { idea.lastError = message; idea.updatedAt = new Date().toISOString(); if (idea.status === 'building') idea.status = 'planned'; }
      if (state.runtime.activeJobId === next.id) delete state.runtime.activeJobId;
      addEvent(state, 'agent', `${STAGE_LABELS[next.stage]} ${cancelled ? 'cancelled' : 'failed'} for ${next.ideaId}. Manual retry required.`, next.ideaId);
    }, polishingSaveOptions(next, () => this.store.internalSnapshot()));
  }
  private async recordCost(id: string, cost: number): Promise<void> {
    if (!Number.isFinite(cost) || cost < 0 || cost > 1000000000) throw new Error('The provider returned invalid usage cost. No amount was inferred.');
    await this.store.transaction(state => { const job = state.jobs.find(job => job.id === id); if (!job) throw new Error('The task disappeared before its usage cost was saved.'); if (job.costUsd !== cost) { job.costUsd = cost; recordOperation(state, 'ai-cost-reported', 'committed', undefined, 1, id); } }, polishingSaveOptions(this.store.durableBuildJob(id), () => this.store.internalSnapshot()));
  }

  private report(error: unknown): void {
    this.options.onError?.(error instanceof Error ? error : new Error(String(error)));
  }
  private async recordTokens(id: string, input: StageUsage): Promise<void> {
    const usage = stageUsageCheck(input); if (!hasTokenUsage(usage)) return;
    await this.store.transaction(state => {
      const job = state.jobs.find(job => job.id === id); if (!job) throw new Error('The task disappeared before its token usage was saved.');
      const next = { ...job.usage, ...usage };
      if (JSON.stringify(next) !== JSON.stringify(job.usage)) { job.usage = next; recordOperation(state, 'ai-usage-reported', 'committed', undefined, 1, id); }
    }, polishingSaveOptions(this.store.durableBuildJob(id), () => this.store.internalSnapshot()));
  }
}
