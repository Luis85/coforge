import { workflowDefinition } from '../domain/configured-workflow';
import { WORKFLOW_ATTEMPT_RESERVE_BYTES, WORKFLOW_HISTORY_LIMIT_BYTES, WORKFLOW_RUN_LIMIT_BYTES, workflowSerializedSize, workflowProposalRevision, type ConfiguredStepExecution, type WorkflowRun } from '../domain/configured-workflow-run';
import { copySettings, findProject, ideaProjectId, projectPaths, projectSettings } from '../domain/projects';
import type { AgentJob, IdeaAction } from '../domain/types';
import { isActiveJob } from '../domain/workflow';
import { errorMessage } from '../domain/errors';
import { cleanText } from '../domain/sanitize';
import type { StageUsage } from '../domain/ai-usage';
import type { StageInput, StageRunner, InternalState } from './ports';
import { recordOperation } from './population';
import type { StudioStore } from './studio-store';
import { attachWorkflowPlan, type WorkflowPlanHandoff } from './workflow-plan-handoff';
import { appendWorkflowArtifact, applyConfiguredOutput, compatibilityStage, configuredAttempt, configuredChanges, configuredIdea, configuredInputs, configuredRuntime, projectWorkflowChanges } from './configured-workflow-policy';

interface ConfiguredHost {
  runners: { demo: StageRunner; claude: StageRunner; herdr?: StageRunner; mcp?: StageRunner };
  cost(id: string, value: number): Promise<void>; usage(id: string, value: StageUsage): Promise<void>;
}
const time = () => new Date().toISOString();
function touch(run: WorkflowRun): void { run.revision++; run.updatedAt = time(); }
function finish(state: InternalState, ideaId: string): WorkflowRun {
  const idea = configuredIdea(state, ideaId);
  const run = idea.workflowRun!;
  projectWorkflowChanges(idea, run);
  run.state = idea.increment?.files.length ? 'awaiting-review' : 'finished';
  delete run.activeAttemptId;
  touch(run);
  recordOperation(state, run.state === 'awaiting-review' ? 'workflow-run-awaiting-review' : 'workflow-run-finished', 'committed', undefined, 1, run.id);
  return run;
}

/** Ordered, pinned execution. Legacy stages are transport labels, never progress authority. */
export class ConfiguredWorkflowEngine {
  constructor(private readonly store: StudioStore, private readonly host: ConfiguredHost) {}
  private automatic(state: InternalState, ideaId: string): void {
    try { this.queue(state, ideaId, false); }
    catch { const run = state.ideas.find(idea => idea.id === ideaId)?.workflowRun; if (run) run.error = 'The next step is not ready. Review its requirements before continuing.'; }
  }
  private queue(state: InternalState, ideaId: string, explicit: boolean): AgentJob | null {
    const idea = configuredIdea(state, ideaId);
    const run = idea.workflowRun;
    if (!run || run.state !== 'ready' || workflowProposalRevision(idea) !== run.proposalRevision) throw new Error('Start a fresh workflow for this request revision.');
    if (run.external && !explicit) return null;
    if (state.jobs.some(job => job.ideaId === ideaId && isActiveJob(job))) throw new Error('This request already has an active attempt.');
    const step = run.definition.steps[run.cursor];
    if (!step) { finish(state, ideaId); return null; }
    if (run.attempts.length >= 100) throw new Error('The run reached its attempt limit. Preserve it and start a new run.');
    if (workflowSerializedSize(run) > WORKFLOW_RUN_LIMIT_BYTES - WORKFLOW_ATTEMPT_RESERVE_BYTES) throw new Error('This run has no reserved evidence capacity for another attempt. Preserve/export its history and start a fresh run; no agent was started.');
    const settings = projectSettings(state, run.projectId);
    if (step.kind === 'ai' && !explicit && (settings.paused || !step.automatic || idea.voters.length < (step.minVotes ?? 0))) return null;
    const id = crypto.randomUUID();
    const at = time();
    if (explicit) state.manualHolds = state.manualHolds.filter(id => id !== ideaId);
    if (step.kind !== 'ai') {
      run.attempts.push({ id, stepId: step.id, stepName: step.name, kind: step.kind, status: 'waiting-human', inputs: [], startedAt: at });
      run.activeAttemptId = id; run.state = 'waiting-human'; touch(run);
      recordOperation(state, 'workflow-manual-waiting', 'committed', undefined, 1, id);
      return null;
    }
    const provider = run.external ? 'mcp' : step.provider;
    configuredRuntime(state, idea, step, run.external);
    if (!this.host.runners[provider]) throw new Error('This step’s selected provider is unavailable.');
    if (state.jobs.filter(job => job.status === 'queued').length >= 50) throw new Error('The queue is full.');
    const inputs = configuredInputs(run, step);
    const snapshot: ConfiguredStepExecution = { runId: run.id, definitionRevision: run.definition.revision, proposalRevision: run.proposalRevision,
      attemptId: id, step: structuredClone(step), inputArtifacts: structuredClone(inputs), ...(run.workspaceId ? { workspaceId: run.workspaceId } : {}) };
    const job: AgentJob = { id: crypto.randomUUID(), ideaId, projectId: run.projectId, stage: compatibilityStage(step.output), provider,
      ...(!run.external ? { model: step.model, ...(step.provider === 'herdr' ? { herdrAgent: step.herdrAgent ?? 'claude' } : {}) } : {}), workflow: snapshot,
      status: 'queued', startedAt: at, logs: [`${step.name} queued.`] };
    run.attempts.push({ id, stepId: step.id, stepName: step.name, kind: 'ai', status: 'queued', jobId: job.id, inputs: inputs.map(item => item.id), startedAt: at });
    run.activeAttemptId = id; run.state = 'running'; touch(run);
    state.jobs.push(job); delete idea.lastError; recordOperation(state, 'job-queued', 'none', undefined, 1, job.id);
    return job;
  }
  async start(ideaId: string, explicit = true, handoff?: WorkflowPlanHandoff, external = false): Promise<WorkflowRun> {
    await this.store.transaction(state => {
      const idea = configuredIdea(state, ideaId);
      const projectId = ideaProjectId(idea);
      const settings = projectSettings(state, projectId);
      if (state.jobs.some(job => job.ideaId === ideaId && isActiveJob(job)) || idea.workflowRun?.state === 'waiting-human' || idea.workflowRun?.state === 'awaiting-review')
        throw new Error('Finish, stop or review the existing workflow first.');
      if (idea.increment?.files.length && idea.status === 'review') throw new Error('Review the existing code changes before starting a fresh run.');
      if (idea.workflowRun) {
        if ((idea.workflowHistory?.length ?? 0) >= 25) throw new Error('This request’s preserved run history is full.');
        if (workflowSerializedSize([...(idea.workflowHistory ?? []), idea.workflowRun]) > WORKFLOW_HISTORY_LIMIT_BYTES) throw new Error('This request’s workflow history exceeds 8 MiB. Preserve/export its evidence before starting another run.');
        idea.workflowHistory = [...(idea.workflowHistory ?? []), structuredClone(idea.workflowRun)];
      }
      const project = findProject(state, projectId);
      const at = time();
      idea.workflowRun = { id: crypto.randomUUID(), ideaId, projectId, definition: workflowDefinition(settings),
        ...(external ? { external: true } : {}),
        proposalRevision: workflowProposalRevision(idea), revision: 0, cursor: 0, state: 'ready', attempts: [], artifacts: [], createdAt: at, updatedAt: at,
        projectContext: { name: settings.projectName, brief: settings.projectBrief, agentPrompt: settings.agentPrompt, projectPath: project.projectPath, worktreeFolder: project.worktreeFolder } };
      if (handoff) attachWorkflowPlan(idea.workflowRun, handoff, () => crypto.randomUUID());
      delete idea.lastError;
      recordOperation(state, 'workflow-run-started', 'committed', undefined, 1, idea.workflowRun.id);
      this.queue(state, ideaId, explicit);
    });
    return structuredClone(this.store.snapshot().ideas.find(idea => idea.id === ideaId)!.workflowRun!);
  }
  async next(ideaId: string): Promise<WorkflowRun> {
    if (!this.store.snapshot().ideas.find(idea => idea.id === ideaId)?.workflowRun) return this.start(ideaId);
    await this.store.transaction(state => {
      const idea = configuredIdea(state, ideaId);
      const run = idea.workflowRun!;
      if (run.state === 'stopped' || ['finished', 'awaiting-review', 'waiting-human', 'running'].includes(run.state)) throw new Error('This workflow cannot run another step in its current state.');
      if (run.state === 'attention') {
        const stale = run.artifacts.filter(artifact => run.definition.steps.findIndex(step => step.id === artifact.stepId) >= run.cursor).map(artifact => artifact.id);
        run.invalidatedArtifactIds = [...new Set([...(run.invalidatedArtifactIds ?? []), ...stale])];
        run.state = 'ready'; delete run.error;
      }
      this.queue(state, ideaId, true);
    });
    return structuredClone(this.store.snapshot().ideas.find(idea => idea.id === ideaId)!.workflowRun!);
  }
  async manual(ideaId: string, expectedRevision: number, checkedIds: string[], note = ''): Promise<WorkflowRun> {
    await this.store.transaction(state => {
      const idea = configuredIdea(state, ideaId);
      const run = idea.workflowRun;
      const step = run?.definition.steps[run.cursor];
      const attempt = run?.attempts.find(item => item.id === run.activeAttemptId);
      if (!run || !step || step.kind === 'ai' || run.state !== 'waiting-human' || run.revision !== expectedRevision || !attempt || workflowProposalRevision(idea) !== run.proposalRevision)
        throw new Error('The manual step changed. Refresh before continuing.');
      if (step.kind === 'checklist' && (new Set(checkedIds).size !== checkedIds.length || checkedIds.some(id => !step.items.some(item => item.id === id)) || step.items.some(item => item.required && !checkedIds.includes(item.id))))
        throw new Error('Complete every required checklist item before continuing.');
      if (step.kind === 'approval' && checkedIds.length) throw new Error('Approval steps do not contain checklist items.');
      attempt.status = 'succeeded'; attempt.checkedIds = [...checkedIds]; attempt.note = note.slice(0, 3000); attempt.finishedAt = time();
      run.cursor++; run.state = 'ready'; delete run.activeAttemptId; touch(run);
      recordOperation(state, 'workflow-manual-completed', 'committed', undefined, 1, attempt.id);
      if (run.cursor === run.definition.steps.length) finish(state, ideaId); else this.automatic(state, ideaId);
    });
    return structuredClone(this.store.snapshot().ideas.find(idea => idea.id === ideaId)!.workflowRun!);
  }
  async stop(ideaId: string): Promise<WorkflowRun> {
    await this.store.transaction(state => {
      const idea = configuredIdea(state, ideaId);
      const run = idea.workflowRun;
      if (!run || ['finished', 'awaiting-review'].includes(run.state)) throw new Error('There is no active workflow to stop.');
      run.state = 'stopped'; touch(run);
      const attempt = run.attempts.find(item => item.id === run.activeAttemptId);
      if (attempt?.kind !== 'ai' || attempt.status === 'queued') {
        if (attempt) { attempt.status = 'cancelled'; attempt.finishedAt = time(); }
        delete run.activeAttemptId;
      }
      projectWorkflowChanges(idea, run);
      if (!run.activeAttemptId && idea.increment?.files.length) run.state = 'awaiting-review';
      recordOperation(state, 'workflow-run-stopped', 'committed', undefined, 1, run.id);
      if (run.state === 'awaiting-review') recordOperation(state, 'workflow-run-awaiting-review', 'committed', undefined, 1, run.id);
    });
    return structuredClone(this.store.snapshot().ideas.find(idea => idea.id === ideaId)!.workflowRun!);
  }
  async tick(projectId: string, manual: boolean, allowNew = true): Promise<AgentJob | null> {
    const state = this.store.internalSnapshot();
    const settings = projectSettings(state, projectId);
    if (!manual && settings.paused) return null;
    const ideas = state.ideas.filter(idea => ideaProjectId(idea) === projectId && ((settings.workflow && allowNew) || idea.workflowRun) && !['shipped', 'rejected', 'flagged'].includes(idea.status) && !idea.lastError && !state.manualHolds.includes(idea.id));
    const candidate = [...ideas.filter(idea => idea.workflowRun), ...ideas.filter(idea => !idea.workflowRun)].find(idea => {
      const run = idea.workflowRun;
      if (run && run.state !== 'ready') return false;
      if (!run && idea.increment?.files.length && idea.status === 'review') return false;
      if (run && workflowSerializedSize(run) > WORKFLOW_RUN_LIMIT_BYTES - WORKFLOW_ATTEMPT_RESERVE_BYTES) return false;
      const step = (run?.definition ?? settings.workflow)?.steps[run?.cursor ?? 0];
      if (!step || (step.kind === 'ai' && !manual && !step.automatic)) return false;
      if (step.kind === 'ai') {
        try { configuredRuntime(state, idea, step); if (run) configuredInputs(run, step); }
        catch { return false; }
      }
      return true;
    });
    if (!candidate) return null;
    try {
      if (candidate.workflowRun) await this.store.transaction(next => { this.queue(next, candidate.id, manual); });
      else await this.start(candidate.id, manual);
    } catch { return null; }
    return this.store.snapshot().jobs.find(job => job.ideaId === candidate.id && job.status === 'queued') ?? null;
  }
  async run(job: AgentJob, signal: AbortSignal): Promise<void> {
    const input = await this.store.transaction(state => {
      const current = state.jobs.find(item => item.id === job.id);
      if (!current || current.status !== 'queued') return null;
      const { idea, run, attempt, snapshot } = configuredAttempt(state, current);
      configuredRuntime(state, idea, snapshot.step, run.external);
      const project = findProject(state, run.projectId);
      if (run.projectContext && (run.projectContext.projectPath !== project.projectPath || run.projectContext.worktreeFolder !== project.worktreeFolder)) throw new Error('This run’s project directory changed. Stop and start a fresh workflow.');
      current.status = 'running'; current.startedAt = time(); attempt.status = 'running'; attempt.startedAt = current.startedAt; touch(run);
      state.runtime.activeJobId = current.id; recordOperation(state, 'job-started');
      const settings = { ...copySettings(projectSettings(state, run.projectId)), ...run.definition.limits, provider: snapshot.step.provider, model: snapshot.step.model,
        ...(snapshot.step.herdrAgent ? { herdrAgent: snapshot.step.herdrAgent } : {}), ...(run.projectContext ? { projectName: run.projectContext.name, projectBrief: run.projectContext.brief, agentPrompt: run.projectContext.agentPrompt } : {}) };
      return { jobId: current.id, stage: current.stage, idea: structuredClone(idea), settings, integration: { ...state.integration, ...projectPaths(project) }, workflow: structuredClone(snapshot), signal };
    });
    if (!input) return;
    signal.throwIfAborted();
    const runner = this.host.runners[job.provider];
    if (!runner) throw new Error('The configured workflow runner is unavailable.');
    const payload: StageInput = { ...input, onUsage: cost => this.host.cost(job.id, cost), onTokenUsage: usage => this.host.usage(job.id, usage),
      onWorkspace: async workspaceId => { await this.store.transaction(state => {
        const { run } = configuredAttempt(state, job, true);
        if (run.workspaceId && run.workspaceId !== workspaceId) throw new Error('This run already owns a different workspace.');
        run.workspaceId = workspaceId;
        const current = state.jobs.find(item => item.id === job.id);
        if (current?.workflow) current.workflow.workspaceId = workspaceId;
        touch(run);
      }); input.workflow.workspaceId = workspaceId; },
      onChanges: async increment => { await this.store.transaction(state => {
        const { idea, run, snapshot } = configuredChanges(state, job);
        if (increment && !increment.simulated && !run.workspaceId) throw new Error('Real code changes require a verified attributed run workspace.');
        appendWorkflowArtifact(run, snapshot, { output: 'codechange', hostSnapshot: true, summary: increment?.summary ?? 'No pending code changes.', ...(increment ? { increment } : {}) }, time());
        if (idea.workflowRun?.id === run.id && ideaProjectId(idea) === run.projectId && !['shipped', 'rejected'].includes(idea.status)) projectWorkflowChanges(idea, run);
        touch(run);
      }); },
      onLog: message => { void this.store.transaction(state => {
        const current = state.jobs.find(item => item.id === job.id); if (current) current.logs = [...current.logs, message.slice(0, 8000)].slice(-200);
      }).catch(() => undefined); },
    };
    const result = await runner(payload);
    if (result.costUsd !== undefined) await this.host.cost(job.id, result.costUsd);
    if (result.usage) await this.host.usage(job.id, result.usage);
    signal.throwIfAborted();
    await this.store.transaction(state => {
      const current = state.jobs.find(item => item.id === job.id);
      if (!current || current.status !== 'running') throw new Error('The task is no longer active.');
      const { idea, run, attempt, snapshot } = configuredAttempt(state, current);
      if (result.increment && !result.increment.simulated && !run.workspaceId) throw new Error('Real code changes require a verified attributed run workspace.');
      applyConfiguredOutput(idea, run, snapshot, result, current.provider, time());
      attempt.status = 'succeeded'; attempt.finishedAt = time(); current.status = 'succeeded'; current.finishedAt = attempt.finishedAt;
      run.cursor++; run.state = idea.screening?.verdict === 'flagged' ? 'attention' : 'ready'; delete run.activeAttemptId;
      if (run.state === 'attention') run.error = 'Resolve the moderation flag before continuing.';
      delete idea.lastError; idea.updatedAt = time(); touch(run); delete state.runtime.activeJobId; recordOperation(state, 'job-completed');
      if (run.cursor === run.definition.steps.length && run.state === 'ready') finish(state, idea.id);
      else if (run.state === 'ready') this.automatic(state, idea.id);
    });
  }
  async fail(job: AgentJob, cancelled: boolean, error: unknown): Promise<void> {
    await this.store.transaction(state => {
      const message = cleanText(`${cancelled ? 'Cancelled. ' : ''}${errorMessage(error)}`, 3900) || 'The step did not complete. Inspect its resources before explicitly retrying.';
      const current = state.jobs.find(item => item.id === job.id);
      if (current) { current.status = cancelled ? 'cancelled' : 'failed'; current.finishedAt = time(); current.error = message; }
      const idea = state.ideas.find(item => item.id === job.ideaId);
      const run = idea?.workflowRun;
      if (idea && run && run.id === job.workflow?.runId) {
        const attempt = run.attempts.find(item => item.id === job.workflow?.attemptId);
        if (attempt) { attempt.status = cancelled ? 'cancelled' : 'failed'; attempt.error = current?.error; attempt.finishedAt = time(); }
        run.state = run.state === 'stopped' ? (idea.increment?.files.length ? 'awaiting-review' : 'stopped') : 'attention';
        run.error = current?.error; delete run.activeAttemptId; idea.lastError = current?.error; touch(run);
      }
      delete state.runtime.activeJobId; recordOperation(state, cancelled ? 'job-cancelled' : 'job-failed', 'none');
    });
  }
  review(state: InternalState, ideaId: string, action: IdeaAction): void {
    const idea = state.ideas.find(item => item.id === ideaId);
    const run = idea?.workflowRun;
    if (!run) return;
    if (action === 'approve') { run.state = 'finished'; touch(run); recordOperation(state, 'workflow-run-finished', 'committed', undefined, 1, run.id); }
    if (action === 'reject') {
      run.state = 'stopped';
      const attempt = run.attempts.find(item => item.id === run.activeAttemptId);
      if (attempt?.status === 'waiting-human') { attempt.status = 'cancelled'; attempt.finishedAt = time(); }
      delete run.activeAttemptId; touch(run);
    }
    if (action === 'changes') {
      const index = run.definition.steps.findLastIndex(step => step.kind === 'ai' && step.access === 'editworktree');
      if (index >= 0) { run.cursor = index; run.state = 'attention'; run.error = 'Changes requested. Explicitly rerun the editing step.'; touch(run); }
    }
  }
}
