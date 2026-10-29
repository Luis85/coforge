import type { StudioService } from '../../features/coforge/application/studio';
import type { CouncilActions } from '../../features/coforge/application/council-ports';
import type { ExecutionRun } from '../../features/coforge/domain/execution-run';
import { findProject } from '../../features/coforge/domain/projects';
import { record } from '../../features/coforge/domain/check';
import { councilTaskInputCheck } from '../../features/coforge/domain/council-task';
import { resolveCouncilPlan } from '../../features/coforge/application/council-execution';
import { reviewedCouncilIdentity } from '../../features/coforge/application/reviewed-preflight';
import type { McpDispatcher } from './mcp-server';
import { McpToolError } from './mcp-errors';
import { artifactCheck, coworkerCheck, coworkerTools, dispatchCheck, emptyCheck, pageCheck, projectCheck, runCheck, sourceCheck } from './mcp-coworker-schema';

function page<T>(items: T[], input: ReturnType<typeof pageCheck>) {
  const offset = input.offset ?? 0;
  const limit = input.limit ?? 50;
  return { items: items.slice(offset, offset + limit), total: items.length, ...(offset + limit < items.length ? { nextOffset: offset + limit } : {}) };
}
function summary(run: ExecutionRun) {
  return { runId: run.id, projectId: run.projectId, teamId: run.teamId, sourceId: run.subject.sourceId, state: run.state,
    createdAt: run.createdAt, updatedAt: run.updatedAt, reason: run.reason, simulated: run.limits?.simulation ?? false,
    pauseRequested: run.pauseRequested ?? false, hasGaps: run.hasGaps ?? false };
}
/** Operator-vault tools. Isolated provider invocations keep their separate, narrower dispatcher. */
export class McpCoworkerTools implements McpDispatcher {
  private pending: Promise<unknown> = Promise.resolve();
  constructor(private readonly studio: StudioService, private readonly council: CouncilActions, private readonly authorize: () => void = () => {}) {}
  tools() { this.authorize(); return coworkerTools(); }
  call(name: string, raw: unknown): Promise<unknown> {
    const next = this.pending.then(() => this.execute(name, raw));
    this.pending = next.catch(() => undefined);
    return next;
  }
  private assertProject(projectId: string): void {
    this.authorize();
    if (findProject(this.studio.state(), projectId).unavailable)
      throw new McpToolError('HOST_UNAVAILABLE', 'Restore this project note before using CoWorker tools.', 'coforge_projects');
    if (!this.council.snapshot().ready)
      throw new McpToolError('HOST_UNAVAILABLE', 'The Council runtime is unavailable. Repair its private storage in Obsidian.');
  }
  private readiness(projectId: string) {
    const state = this.council.snapshot();
    const projectPaused = state.preferences.pausedProjectIds?.includes(projectId) ?? false;
    return { paused: state.paused, projectPaused, executor: state.executor, retryAfterMs: 1000,
      nextAction: state.paused || projectPaused || !state.executor ? 'Use The Council in Obsidian to designate the execution desktop and resume when ready. Dispatch does not resume other work.' : 'Poll coforge_run. Recovery and human checkpoints require Obsidian.' };
  }
  private run(projectId: string, runId: string) {
    const run = this.council.snapshot().runs.find(item => item.id === runId && item.projectId === projectId);
    if (!run) throw new McpToolError('INVALID_ARGUMENTS', 'Run not found in this project.', 'coforge_runs');
    return run;
  }
  private async task(projectId: string, sourceId: string) {
    const task = (await this.council.listTasks()).find(item => item.sourceId === sourceId && item.projectId === projectId);
    this.assertProject(projectId);
    if (!task) throw new McpToolError('INVALID_ARGUMENTS', 'Saved task not found in this project.', 'coforge_tasks');
    const plan = resolveCouncilPlan(await this.council.catalogue.list(), task.target);
    this.assertProject(projectId);
    if (plan.team.projectId !== projectId || plan.definition.projectId !== projectId)
      throw new McpToolError('PERMISSION_DENIED', 'The saved task destination belongs to another project.', 'coforge_roster');
    return task;
  }
  private async execute(name: string, raw: unknown): Promise<unknown> {
    this.authorize();
    const args = record(raw);
    const projectId = projectCheck(args.projectId);
    const input = Object.fromEntries(Object.entries(args).filter(([key]) => key !== 'projectId'));
    this.assertProject(projectId);
    if (name === 'coforge_roster' || name === 'coforge_coworker') {
      let selected: string | undefined;
      if (name === 'coforge_coworker') selected = coworkerCheck(input).coworkerId;
      else emptyCheck(input);
      const catalogue = await this.council.catalogue.list();
      this.assertProject(projectId);
      const teams = catalogue.valid.filter(entry => entry.definition.schema === 'team/v1' && entry.definition.projectId === projectId);
      const memberships = (id: string) => teams.filter(entry => entry.definition.schema === 'team/v1' && entry.definition.members.includes(id)).map(entry => entry.definition.id);
      const coworkers = catalogue.valid.filter(entry => entry.definition.schema === 'agent/v1');
      if (selected) {
        const entry = coworkers.find(item => item.definition.id === selected);
        if (!entry) throw new McpToolError('INVALID_ARGUMENTS', 'CoWorker not found in the reusable vault roster.', 'coforge_roster');
        return { definition: entry.definition, revision: entry.revision, teamIds: memberships(selected) };
      }
      return { projectId, ...this.readiness(projectId), invalidDefinitionCount: catalogue.invalid.length,
        coworkers: coworkers.map(({ definition, revision }) => ({ id: definition.id, name: definition.name, enabled: definition.enabled,
          ...(definition.schema === 'agent/v1' ? { role: definition.role, provider: definition.provider, model: definition.model, requestedCapabilities: definition.requestedCapabilities } : {}),
          revision, teamIds: memberships(definition.id) })),
        teams: teams.map(({ definition, revision }) => ({ id: definition.id, name: definition.name, enabled: definition.enabled,
          ...(definition.schema === 'team/v1' ? { members: definition.members } : {}), revision })),
        councils: catalogue.valid.filter(entry => entry.definition.schema === 'council/v1' && entry.definition.projectId === projectId).map(({ definition, revision }) => ({ id: definition.id, name: definition.name, enabled: definition.enabled,
          ...(definition.schema === 'council/v1' ? { teamId: definition.teamId, members: definition.members } : {}), revision })) };
    }
    if (name === 'coforge_create_task') {
      const checked = councilTaskInputCheck({ projectId, ...input });
      return this.council.createTask(checked);
    }
    if (name === 'coforge_tasks') {
      const paging = pageCheck(input);
      const tasks = (await this.council.listTasks()).filter(task => task.projectId === projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      this.assertProject(projectId);
      const { items, ...rest } = page(tasks, paging);
      return { tasks: items, ...rest };
    }
    if (name === 'coforge_preflight_task' || name === 'coforge_dispatch_task') {
      const checked = name === 'coforge_dispatch_task' ? dispatchCheck(input) : sourceCheck(input);
      const task = await this.task(projectId, checked.sourceId);
      const preview = await this.council.preflight(task.target, task.path);
      this.assertProject(projectId);
      if (name === 'coforge_preflight_task') return { ...preview, expectedIdentity: reviewedCouncilIdentity(preview), ...this.readiness(projectId) };
      const identity = dispatchCheck(input).expectedIdentity;
      if (reviewedCouncilIdentity(preview) !== identity)
        throw new McpToolError('CONFLICT', 'Source, context or definitions changed. Review a fresh preflight before dispatch.', 'coforge_preflight_task');
      if (preview.plan.invocations.some(item => item.agent.provider === 'demo'))
        throw new McpToolError('PERMISSION_DENIED', 'Simulation CoWorkers need an explicit test destination in Obsidian. Select a live provider before dispatch.', 'coforge_roster');
      const run = await this.council.submit(task.target, task.path, identity);
      return { ...summary(run), ...this.readiness(projectId) };
    }
    if (name === 'coforge_runs') {
      const paging = pageCheck(input);
      const runs = this.council.snapshot().runs.filter(item => item.projectId === projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const { items, ...rest } = page(runs, paging);
      return { runs: items.map(summary), ...rest, ...this.readiness(projectId) };
    }
    if (name === 'coforge_run' || name === 'coforge_cancel_run' || name === 'coforge_artifact') {
      const checked = name === 'coforge_artifact' ? artifactCheck(input) : runCheck(input);
      const run = this.run(projectId, checked.runId);
      const published = run.artifacts.filter(artifact => run.attempts.some(attempt => attempt.artifactId === artifact.id && attempt.status === 'published'));
      if (name === 'coforge_artifact') {
        const { artifactId } = artifactCheck(input);
        const artifact = published.find(item => item.id === artifactId);
        if (!artifact) throw new McpToolError('TASK_NOT_READY', 'Artifact is not durably published in this run. Inspect run state before retrying.', 'coforge_run', 1000);
        return { runId: run.id, projectId, artifact };
      }
      if (name === 'coforge_cancel_run') {
        await this.council.cancel(run.id);
        return { ...summary(this.run(projectId, run.id)), ...this.readiness(projectId) };
      }
      return { ...summary(run), ...this.readiness(projectId), limits: run.limits, allowance: run.allowance,
        invocations: run.invocations.map(({ id, agentId, agentRevision, provider, model }) => ({ id, agentId, agentRevision, provider, model })),
        attempts: run.attempts.map(({ id, invocationId, status, artifactId, costUsd, usage, usageSource }) => ({ id, invocationId, status, artifactId, costUsd, usage, usageSource })),
        artifacts: published.map(({ id, agentId, agentRevision, provider, model, simulated, skipped, createdAt }) => ({ id, agentId, agentRevision, provider, model, simulated, skipped, createdAt })) };
    }
    throw new McpToolError('INVALID_ARGUMENTS', 'Unknown CoWorker tool. Inspect tools/list.');
  }
}
