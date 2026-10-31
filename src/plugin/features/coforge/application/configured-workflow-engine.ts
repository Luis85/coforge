import { workflowDefinition } from '../domain/configured-workflow';
import { automationContextCheck, type AutomationContext } from '../domain/automation-context';
import { WORKFLOW_ATTEMPT_RESERVE_BYTES, WORKFLOW_HISTORY_LIMIT_BYTES, WORKFLOW_RUN_LIMIT_BYTES, workflowSerializedSize, workflowProposalRevision, type ConfiguredStepExecution, type WorkflowRun } from '../domain/configured-workflow-run';
import { findProject, ideaProjectId, projectSettings } from '../domain/projects';
import type { AgentJob, IdeaAction } from '../domain/types';
import { isActiveJob } from '../domain/workflow';
import type { StageUsage } from '../domain/ai-usage';
import type { StageInput, StageRunner, StageResult, InternalState } from './ports';
import type { DurableBuildPort } from './durable-build-ports';
import { configuredJobInput, completeConfiguredJob, failConfiguredJob } from './configured-workflow-job';
import { recordOperation } from './population';
import type { StudioStore } from './studio-store';
import { recordAgentConversation } from './agent-conversation';
import { uncertainTaskAttempt, type AgentTaskPort } from './agent-task';
import { assertWorkflowNotStopped, assertDurableWorkflowMetadata, holdWorkflow, releaseWorkflowStop } from './workflow-stop-policy';
import { ConfiguredWorkflowCouncil } from './configured-workflow-council';
import { workflowCouncilProjectContext } from './workflow-council-context';
import type { WorkflowCouncilBinding } from '../domain/workflow-council-binding';
import { ConfiguredWorkflowNudges } from './configured-workflow-nudges';
import { captureWorkflowOutputTemplates, WorkflowOutputTemplateUnavailableError, type WorkflowOutputTemplateActions } from './workflow-output-templates';
import { attachWorkflowPlan, type WorkflowPlanHandoff } from './workflow-plan-handoff';
import { assertWorkflowCoworkerAvailable, bindWorkflowCoworkers, coworkerAdmissionReady, prepareWorkflowCoworkers, WorkflowCoworkerUnavailableError } from './configured-workflow-coworkers';
import { appendWorkflowArtifact, compatibilityStage, configuredAttempt, configuredChanges, configuredIdea, configuredInputs, configuredRuntime, projectWorkflowChanges } from './configured-workflow-policy';

interface ConfiguredHost {
  dispatchAllowed?(): boolean;
  durableBuilds?: DurableBuildPort;
  outputTemplates?: WorkflowOutputTemplateActions;
  agentTasks?: AgentTaskPort;
  runners: { demo: StageRunner; claude: StageRunner; codex?: StageRunner; herdr?: StageRunner; mcp?: StageRunner };
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
  private readonly nudges: ConfiguredWorkflowNudges;
  private readonly council: ConfiguredWorkflowCouncil;
  constructor(private readonly store: StudioStore, private readonly host: ConfiguredHost) {
    this.council = new ConfiguredWorkflowCouncil(store, host.agentTasks, (state, ideaId) => {
      const run = configuredIdea(state, ideaId).workflowRun!;
      if (run.cursor === run.definition.steps.length) finish(state, ideaId); else this.automatic(state, ideaId);
    });
    this.nudges = new ConfiguredWorkflowNudges(store, host.agentTasks, (state, ideaId) => {
      const run = configuredIdea(state, ideaId).workflowRun!;
      if (run.cursor === run.definition.steps.length) finish(state, ideaId); else this.automatic(state, ideaId);
    });
  }
  async dispose(): Promise<void> { await Promise.all([this.nudges.dispose(), this.council.dispose()]); }
  acknowledgeNudge(ideaId: string, revision: number, consent: boolean): Promise<void> { return this.nudges.acknowledge(ideaId, revision, consent); }
  private automatic(state: InternalState, ideaId: string): void {
    try { this.queue(state, ideaId, false); }
    catch { const run = state.ideas.find(idea => idea.id === ideaId)?.workflowRun; if (run) run.error = 'The next step is not ready. Review its requirements before continuing.'; }
  }
  private queue(state: InternalState, ideaId: string, explicit: boolean): AgentJob | null {
    assertWorkflowNotStopped(state, ideaId);
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
    if (step.kind === 'council') {
      if (!explicit && (settings.paused || !step.automatic)) return null;
      this.council.reserve(state, ideaId, step); return null;
    }
    if (step.kind === 'nudge') {
      if (!explicit && (settings.paused || !step.automatic)) return null;
      this.nudges.reserve(state, ideaId, step); return null;
    }
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
    if (step.execution && (run.external || !['claude', 'codex'].includes(provider) || !this.host.durableBuilds)) throw new Error('Background Build requires the native Claude or Codex worker. No foreground/provider fallback is allowed.');
    if (step.execution && state.runtime.durableBuild?.ready === false) throw new Error(state.runtime.durableBuild.message || 'Check the background worker before admitting another Build.');
    configuredRuntime(state, idea, step, run.external);
    if (!step.execution && !this.host.runners[provider]) throw new Error('This step’s selected provider is unavailable.');
    if (state.jobs.filter(job => job.status === 'queued').length >= 50) throw new Error('The queue is full.');
    const inputs = configuredInputs(run, step);
    const snapshot: ConfiguredStepExecution = { runId: run.id, definitionRevision: run.definition.revision, proposalRevision: run.proposalRevision,
      ...(step.coworkerId ? { coworker: structuredClone(run.coworkerBindings?.find(item => item.stepId === step.id)?.profile) } : {}),
      ...(step.outputTemplateId ? { outputTemplate: structuredClone(run.outputTemplates?.find(template => template.id === step.outputTemplateId)) } : {}),
      ...(run.automationEvent ? { automationEvent: structuredClone(run.automationEvent) } : {}),
      attemptId: id, step: structuredClone(step), inputArtifacts: structuredClone(inputs), ...(run.workspaceId ? { workspaceId: run.workspaceId } : {}) };
    const job: AgentJob = { id: crypto.randomUUID(), ideaId, projectId: run.projectId, stage: compatibilityStage(step.output), provider,
      ...(!run.external ? { model: step.model, ...(step.provider === 'herdr' ? { herdrAgent: step.herdrAgent ?? 'claude' } : {}) } : {}), workflow: snapshot,
      status: 'queued', startedAt: at, logs: [`${step.name} queued.`] };
    run.attempts.push({ id, stepId: step.id, stepName: step.name, kind: 'ai', status: 'queued', jobId: job.id, inputs: inputs.map(item => item.id), startedAt: at });
    run.activeAttemptId = id; run.state = 'running'; touch(run);
    state.jobs.push(job); delete idea.lastError; recordOperation(state, 'job-queued', 'none', undefined, 1, job.id);
    return job;
  }
  async start(ideaId: string, explicit = true, handoff?: WorkflowPlanHandoff, external = false, automationEvent?: AutomationContext, expectedDefinitionJson?: string): Promise<WorkflowRun> {
    return this.admit(ideaId, explicit, handoff, external, automationEvent, expectedDefinitionJson);
  }
  async restart(ideaId: string): Promise<WorkflowRun> { return this.admit(ideaId, true, undefined, false, undefined, undefined, true); }
  private async admit(ideaId: string, explicit = true, handoff?: WorkflowPlanHandoff, external = false, automationEvent?: AutomationContext, expectedDefinitionJson?: string, operatorRestart = false): Promise<WorkflowRun> {
    const starting = this.store.internalSnapshot();
    assertDurableWorkflowMetadata(starting, ideaId);
    if (!operatorRestart) assertWorkflowNotStopped(starting, ideaId);
    const startingIdea = starting.ideas.find(idea => idea.id === ideaId);
    const startingProject = startingIdea ? starting.projects.find(project => project.id === ideaProjectId(startingIdea)) : undefined;
    const startingDefinition = startingProject ? workflowDefinition(startingProject.settings) : undefined;
    const coworkerBindings = startingDefinition && startingIdea && startingDefinition.steps.some(step => step.kind === 'ai' && step.coworkerId !== undefined)
      ? await prepareWorkflowCoworkers(startingDefinition, ideaProjectId(startingIdea), this.host.agentTasks) : [];
    let councilBindings: WorkflowCouncilBinding[] = [];
    // Legacy starts enqueue their transaction immediately, preserving existing serialized ordering.
    if (startingDefinition?.steps.some(step => step.kind === 'council') && startingIdea) councilBindings = await this.council.prepare(startingDefinition, ideaProjectId(startingIdea));
    await this.store.transaction(async state => {
      if (operatorRestart) releaseWorkflowStop(state, ideaId, startingIdea?.workflowRun); else assertWorkflowNotStopped(state, ideaId);
      const idea = configuredIdea(state, ideaId);
      assertDurableWorkflowMetadata(state, ideaId);
      assertDurableWorkflowMetadata(state, ideaId);
      const projectId = ideaProjectId(idea);
      const settings = projectSettings(state, projectId);
      const sourceDefinition = workflowDefinition(settings);
      if (coworkerBindings.length && (!startingIdea || JSON.stringify(sourceDefinition) !== JSON.stringify(startingDefinition) || workflowProposalRevision(idea) !== workflowProposalRevision(startingIdea))) throw new Error('The request or workflow changed while capturing CoWorkers. Review before starting.');
      if (coworkerBindings.length && (!startingProject || JSON.stringify(workflowCouncilProjectContext(startingProject)) !== JSON.stringify(workflowCouncilProjectContext(findProject(state, projectId))))) throw new Error('The project context changed while capturing CoWorkers. Review before starting.');
      if (sourceDefinition.steps.some(step => step.kind === 'ai' && step.coworkerId !== undefined && !coworkerBindings.some(binding => binding.stepId === step.id && binding.profile.id === step.coworkerId))) throw new Error('The CoWorker workflow changed while starting. Review its saved setup and start again.');
      const definition = bindWorkflowCoworkers(sourceDefinition, coworkerBindings);
      const outputTemplates = await captureWorkflowOutputTemplates(projectId, definition.steps.filter(step => step.kind === 'ai'), this.host.outputTemplates);
      if (councilBindings.length && (!startingIdea || JSON.stringify(workflowDefinition(settings)) !== JSON.stringify(startingDefinition) || workflowProposalRevision(idea) !== workflowProposalRevision(startingIdea))) throw new Error('The request or workflow changed while capturing Council setup. Review it before starting.');
      if (councilBindings.length && (!startingProject || JSON.stringify(workflowCouncilProjectContext(startingProject)) !== JSON.stringify(workflowCouncilProjectContext(findProject(state, projectId))))) throw new Error('The project context changed while capturing Council setup. Review it before starting.');
      if (!councilBindings.length && workflowDefinition(settings).steps.some(step => step.kind === 'council')) throw new Error('The Council workflow changed while starting. Review its saved setup and start again.');
      if (idea.workflowRun?.attempts.some(attempt => attempt.id === idea.workflowRun?.activeAttemptId && attempt.kind === 'council' && attempt.nudgeState === 'submitted')) throw new Error('Inspect or stop the active Council task before starting another workflow.');
      if (expectedDefinitionJson !== undefined && JSON.stringify(workflowDefinition(settings)) !== expectedDefinitionJson) throw new Error('The workflow changed before trigger admission. Review the binding again.');
      if (this.council.busy(ideaId) || this.nudges.busy(ideaId) || idea.workflowRun?.attempts.some(uncertainTaskAttempt)) throw new Error('Inspect and acknowledge the uncertain task outcome before starting another workflow.');
      if (idea.workflowRun?.attempts.some(attempt => attempt.councilCancellation === 'requested')) throw new Error('Wait for the original Council cancellation to finish.');
      if (state.jobs.some(job => job.ideaId === ideaId && isActiveJob(job)) || idea.workflowRun?.state === 'running' || idea.workflowRun?.state === 'waiting-human' || idea.workflowRun?.state === 'awaiting-review')
        throw new Error('Finish, stop or review the existing workflow first.');
      if (idea.increment?.files.length && idea.status === 'review') throw new Error('Review the existing code changes before starting a fresh run.');
      if (idea.workflowRun) {
        if ((idea.workflowHistory?.length ?? 0) >= 25) throw new Error('This request’s preserved run history is full.');
        if (workflowSerializedSize([...(idea.workflowHistory ?? []), idea.workflowRun]) > WORKFLOW_HISTORY_LIMIT_BYTES) throw new Error('This request’s workflow history exceeds 8 MiB. Preserve/export its evidence before starting another run.');
        idea.workflowHistory = [...(idea.workflowHistory ?? []), structuredClone(idea.workflowRun)];
      }
      const project = findProject(state, projectId);
      const at = time();
      idea.workflowRun = { id: crypto.randomUUID(), ideaId, projectId, definition,
        ...(coworkerBindings.length ? { coworkerBindings } : {}),
        ...(councilBindings.length ? { councilBindings } : {}),
        ...(outputTemplates.length ? { outputTemplates } : {}),
        ...(automationEvent ? { automationEvent: automationContextCheck(automationEvent) } : {}),
        ...(external ? { external: true } : {}),
        proposalRevision: workflowProposalRevision(idea), revision: 0, cursor: 0, state: 'ready', attempts: [], artifacts: [], createdAt: at, updatedAt: at,
        projectContext: { name: settings.projectName, brief: settings.projectBrief, agentPrompt: settings.agentPrompt, projectPath: project.projectPath, worktreeFolder: project.worktreeFolder } };
      if (handoff) attachWorkflowPlan(idea.workflowRun, handoff, () => crypto.randomUUID());
      delete idea.lastError;
      recordOperation(state, 'workflow-run-started', 'committed', undefined, 1, idea.workflowRun.id);
      this.queue(state, ideaId, explicit);
    });
    await this.flushDelegated(ideaId);
    return structuredClone(this.store.snapshot().ideas.find(idea => idea.id === ideaId)!.workflowRun!);
  }
  async next(ideaId: string): Promise<WorkflowRun> {
    assertWorkflowNotStopped(this.store.snapshot(), ideaId);
    const current = this.store.snapshot().ideas.find(idea => idea.id === ideaId)?.workflowRun;
    const councilAttempt = current?.attempts.find(item => item.id === current.activeAttemptId);
    if (councilAttempt?.kind === 'council' && councilAttempt.nudgeState === 'submitted') {
      await this.council.reconcile(ideaId);
      await this.flushDelegated(ideaId);
      return structuredClone(this.store.snapshot().ideas.find(idea => idea.id === ideaId)!.workflowRun!);
    }
    if (!this.store.snapshot().ideas.find(idea => idea.id === ideaId)?.workflowRun) return this.start(ideaId);
    await this.store.transaction(state => {
      const idea = configuredIdea(state, ideaId);
      const run = idea.workflowRun!;
      if (run.state === 'stopped' || ['finished', 'awaiting-review', 'waiting-human', 'running'].includes(run.state)) throw new Error('This workflow cannot run another step in its current state.');
      if (run.state === 'attention') {
        if (run.attempts.some(uncertainTaskAttempt)) throw new Error('Inspect and acknowledge the uncertain task outcome before a fresh attempt.');
        const stale = run.artifacts.filter(artifact => run.definition.steps.findIndex(step => step.id === artifact.stepId) >= run.cursor).map(artifact => artifact.id);
        run.invalidatedArtifactIds = [...new Set([...(run.invalidatedArtifactIds ?? []), ...stale])];
        run.state = 'ready'; delete run.error;
      }
      this.queue(state, ideaId, true);
    });
    await this.flushDelegated(ideaId);
    return structuredClone(this.store.snapshot().ideas.find(idea => idea.id === ideaId)!.workflowRun!);
  }
  async manual(ideaId: string, expectedRevision: number, checkedIds: string[], note = ''): Promise<WorkflowRun> {
    await this.store.transaction(state => {
      assertWorkflowNotStopped(state, ideaId);
      const idea = configuredIdea(state, ideaId);
      const run = idea.workflowRun;
      const step = run?.definition.steps[run.cursor];
      const attempt = run?.attempts.find(item => item.id === run.activeAttemptId);
      if (!run || !step || (step.kind !== 'approval' && step.kind !== 'checklist') || run.state !== 'waiting-human' || run.revision !== expectedRevision || !attempt || workflowProposalRevision(idea) !== run.proposalRevision)
        throw new Error('The manual step changed. Refresh before continuing.');
      if (step.kind === 'checklist' && (new Set(checkedIds).size !== checkedIds.length || checkedIds.some(id => !step.items.some(item => item.id === id)) || step.items.some(item => item.required && !checkedIds.includes(item.id))))
        throw new Error('Complete every required checklist item before continuing.');
      if (step.kind === 'approval' && checkedIds.length) throw new Error('Approval steps do not contain checklist items.');
      attempt.status = 'succeeded'; attempt.checkedIds = [...checkedIds]; attempt.note = note.slice(0, 3000); attempt.finishedAt = time();
      run.cursor++; run.state = 'ready'; delete run.activeAttemptId; touch(run);
      recordOperation(state, 'workflow-manual-completed', 'committed', undefined, 1, attempt.id);
      if (run.cursor === run.definition.steps.length) finish(state, ideaId); else this.automatic(state, ideaId);
    });
    await this.flushDelegated(ideaId);
    return structuredClone(this.store.snapshot().ideas.find(idea => idea.id === ideaId)!.workflowRun!);
  }
  async stop(ideaId: string): Promise<WorkflowRun> {
    const councilStop = await this.store.transaction(state => {
      const { idea, run, attempt } = holdWorkflow(state, ideaId);
      const councilStop = this.council.stopping(run, attempt);
      projectWorkflowChanges(idea, run);
      if (!run.activeAttemptId && idea.increment?.files.length) run.state = 'awaiting-review';
      recordOperation(state, 'workflow-run-stopped', 'committed', undefined, 1, run.id);
      if (run.state === 'awaiting-review') recordOperation(state, 'workflow-run-awaiting-review', 'committed', undefined, 1, run.id);
      return councilStop;
    });
    this.nudges.abort(ideaId);
    this.council.abort(ideaId);
    if (councilStop) await this.council.cancel(councilStop);
    return structuredClone(this.store.snapshot().ideas.find(idea => idea.id === ideaId)!.workflowRun!);
  }
  async tick(projectId: string, manual: boolean, allowNew = true): Promise<AgentJob | null> {
    let state = this.store.internalSnapshot();
    const waiting = state.ideas.filter(idea => ideaProjectId(idea) === projectId && !state.jobs.some(job => job.ideaId === idea.id && job.durable && !job.durable.acknowledged) && idea.workflowRun?.attempts.some(attempt => attempt.id === idea.workflowRun?.activeAttemptId && ['council', 'nudge'].includes(attempt.kind)));
    for (const idea of waiting) {
      await this.council.reconcile(idea.id);
      await this.flushDelegated(idea.id);
    }
    if (waiting.length) state = this.store.internalSnapshot();
    const settings = projectSettings(state, projectId);
    if (!manual && settings.paused) return null;
    const ideas = state.ideas.filter(idea => ideaProjectId(idea) === projectId && ((settings.workflow && allowNew) || idea.workflowRun) && !['shipped', 'rejected', 'flagged'].includes(idea.status) && !idea.lastError && !state.manualHolds.includes(idea.id) && !state.workflowStopHolds?.includes(idea.id));
    const candidate = [...ideas.filter(idea => idea.workflowRun), ...ideas.filter(idea => !idea.workflowRun)].find(idea => {
      const run = idea.workflowRun;
      if (run?.external && !manual) return false;
      if (run && run.state !== 'ready') return false;
      if (!run && idea.increment?.files.length && idea.status === 'review') return false;
      if (run && workflowSerializedSize(run) > WORKFLOW_RUN_LIMIT_BYTES - WORKFLOW_ATTEMPT_RESERVE_BYTES) return false;
      const step = (run?.definition ?? settings.workflow)?.steps[run?.cursor ?? 0];
      if (!step || ((step.kind === 'ai' || step.kind === 'nudge' || step.kind === 'council') && !manual && !step.automatic)) return false;
      if (step.kind === 'ai') {
        try {
          if (!run && step.coworkerId) { if (idea.voters.length < (step.minVotes ?? 0)) return false; }
          else configuredRuntime(state, idea, step, run?.external);
          if (run) configuredInputs(run, step);
        }
        catch { return false; }
      }
      return true;
    });
    if (!candidate) return null;
    try {
      if (!candidate.workflowRun && settings.workflow && !await coworkerAdmissionReady(settings.workflow, projectId, candidate, state, this.host.agentTasks)) return null;
      if (candidate.workflowRun) { await this.store.transaction(next => { this.queue(next, candidate.id, manual); }); await this.flushDelegated(candidate.id); }
      else await this.start(candidate.id, manual);
    } catch (cause) {
      if ((cause instanceof WorkflowOutputTemplateUnavailableError || cause instanceof WorkflowCoworkerUnavailableError) && !candidate.workflowRun) await this.store.transaction(next => {
        const idea = next.ideas.find(item => item.id === candidate.id);
        if (!idea || idea.workflowRun || idea.lastError || next.jobs.some(job => job.ideaId === idea.id && isActiveJob(job))) return;
        idea.lastError = cause.message;
        idea.updatedAt = time();
        recordOperation(next, 'workflow-admission-blocked', 'committed', undefined, 1, idea.id);
      });
      return null;
    }
    return this.store.snapshot().jobs.find(job => job.ideaId === candidate.id && job.status === 'queued') ?? null;
  }
  async run(job: AgentJob, signal: AbortSignal): Promise<void> {
    if (job.workflow?.step.execution) throw new Error('Background Builds require durable worker admission.');
    if (job.workflow?.coworker) await assertWorkflowCoworkerAvailable(job.workflow.coworker, job.projectId ?? '', this.host.agentTasks);
    const input = await this.store.transaction(state => configuredJobInput(state, job, signal));
    if (!input) return;
    const execution = input.workflow;
    if (!execution) throw new Error('The configured execution snapshot is missing.');
    signal.throwIfAborted();
    const runner = this.host.runners[job.provider];
    if (!runner) throw new Error('The configured workflow runner is unavailable.');
    const payload: StageInput = { ...input, onUsage: cost => this.host.cost(job.id, cost), onTokenUsage: usage => this.host.usage(job.id, usage),
      onConversation: event => recordAgentConversation(this.store, job.id, event),
      onWorkspace: async workspaceId => { await this.store.transaction(state => {
        const { run } = configuredAttempt(state, job, true);
        if (run.workspaceId && run.workspaceId !== workspaceId) throw new Error('This run already owns a different workspace.');
        run.workspaceId = workspaceId;
        const current = state.jobs.find(item => item.id === job.id);
        if (current?.workflow) current.workflow.workspaceId = workspaceId;
        touch(run);
      }); execution.workspaceId = workspaceId; },
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
    await this.store.transaction(state => this.complete(state, job, result));
    await this.flushDelegated(job.ideaId);
  }
  async fail(job: AgentJob, cancelled: boolean, error: unknown): Promise<void> {
    await this.store.transaction(state => failConfiguredJob(state, job, cancelled, error));
  }
  complete(state: InternalState, job: AgentJob, result: StageResult): void {
    const { idea, run } = completeConfiguredJob(state, job, result);
    if (run.cursor === run.definition.steps.length && run.state === 'ready') finish(state, idea.id);
    else if (run.state === 'ready') this.automatic(state, idea.id);
  }
  async verifyCoworker(job: AgentJob): Promise<void> {
    if (job.workflow?.coworker) await assertWorkflowCoworkerAvailable(job.workflow.coworker, job.projectId ?? '', this.host.agentTasks);
  }
  async flushDelegated(ideaId: string): Promise<void> { if (this.host.dispatchAllowed?.() === false) return; await this.nudges.run(ideaId); await this.council.run(ideaId); }
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
      if (state.workflowStopHolds?.includes(ideaId)) {
        if (idea?.increment && !run.artifacts.some(artifact => artifact.hostSnapshot && JSON.stringify(artifact.increment) === JSON.stringify(idea.increment))) throw new Error('Restore the preserved diff evidence before requesting changes.');
        delete idea?.increment; run.state = 'stopped'; touch(run); return;
      }
      const index = run.definition.steps.findLastIndex(step => step.kind === 'ai' && step.access === 'editworktree');
      if (index >= 0) { run.cursor = index; run.state = 'attention'; run.error = 'Changes requested. Explicitly rerun the editing step.'; touch(run); }
    }
  }
}
