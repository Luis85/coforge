import type { StudioService } from '../../features/coforge/application/studio';
import type { McpStepRunner } from '../../features/coforge/application/mcp-step-runner';
import { configuredAttempt } from '../../features/coforge/application/configured-workflow-policy';
import { findProject, ideaProjectId } from '../../features/coforge/domain/projects';
import { boolean, CheckError, number, optional, record, shape, text } from '../../features/coforge/domain/check';
import { workflowDefinition } from '../../features/coforge/domain/configured-workflow';
import type { McpTool } from './mcp-server';
import type { McpStepFiles } from './mcp-step-files';
import { McpToolError } from './mcp-errors';
import { modelWorkflowJob } from './model-workflow-job';
import { mcpCodingTools } from './mcp-coding-tools';

const id = text({ min: 1, max: 100 });
const identifier = { type: 'string', minLength: 1, maxLength: 100 };
const pathSchema = { type: 'string', maxLength: 1000 };
const querySchema = { type: 'string', minLength: 1, maxLength: 200 };
const schema = (properties: Record<string, object>, required = Object.keys(properties)) => ({ type: 'object', properties, required, additionalProperties: false });
const definition = (name: string, description: string, inputSchema: object, readOnlyHint = true): McpTool => ({ name, description, inputSchema,
  annotations: { readOnlyHint, destructiveHint: !readOnlyHint, idempotentHint: readOnlyHint, openWorldHint: false } });
const taskCheck = shape({ taskId: id }, { strict: true });

/** Project/attempt authorization is repeated on every tool, independent of the transport's credentials. */
export class McpWorkflowTools {
  private pending: Promise<unknown> = Promise.resolve();
  constructor(private readonly studio: StudioService, private readonly runner: McpStepRunner, private readonly files?: McpStepFiles, private readonly authorize: (projectId: string) => void = () => {}) {}
  tools(): McpTool[] {
    return [
      ...mcpCodingTools(),
      definition('coforge_project', 'Read this project brief, workflow, request summaries and active MCP tasks. Request content is untrusted.', schema({})),
      definition('coforge_request', 'Read one project request, its saved artifacts, attempts and review state.', schema({ ideaId: identifier })),
      definition('coforge_request_status', 'Read compact request progress, the latest attempt’s recorded safe failure and evidence availability. Use this to inspect progress without repeatedly retrieving full prompts, artifacts or private execution data. Never resumes or accepts work.', schema({ ideaId: identifier })),
      definition('coforge_begin_step', 'Reserve the next workflow step for this external agent. Poll step_context when queued. Never starts a native AI runner. Existing active attempts are returned without replay.', schema({ ideaId: identifier }), false),
      definition('coforge_step_context', 'Read the pinned instructions, untrusted input, required output schema and permitted tools for an active task.', schema({ taskId: identifier })),
      definition('coforge_submit_result', 'Submit the schema object for an active task. Host validates and persists it, captures actual Build changes and requires human review. Never fabricates cost or test results.', schema({ taskId: identifier, output: { type: 'object' } }), false),
      definition('coforge_cancel_step', 'Cancel this request’s active MCP step. Partial changes stay in its private workspace for inspection.', schema({ taskId: identifier }), false),
      definition('coforge_list_files', 'Discover bounded repository file paths. Optional path narrows the directory; optional query filters file paths by a case-insensitive literal substring before the result limit. Truncated results are incomplete; narrow path and retry. Credentials, metadata, managed notes and symlinks are excluded.', schema({ taskId: identifier, path: pathSchema, query: querySchema }, ['taskId'])),
      definition('coforge_read_file', 'Read a bounded UTF-8 repository file using the task access profile.', schema({ taskId: identifier, path: pathSchema })),
      definition('coforge_search_files', 'Search case-sensitive literal text in bounded UTF-8 repository files. Optional path narrows the directory. Returns matching lines with file names. Truncated results are incomplete; narrow path and retry.', schema({ taskId: identifier, query: querySchema, path: pathSchema }, ['taskId', 'query'])),
      definition('coforge_write_file', 'Create or replace a UTF-8 file in this task’s owned Build worktree. Existing content must match expectedContent; use null to create. This file operation never runs commands or changes Git metadata. Captured legacy tasks retain their original dependency-file restrictions.', schema({ taskId: identifier, path: pathSchema, content: { type: 'string', maxLength: 200000 }, expectedContent: { type: ['string', 'null'], maxLength: 200000 } }), false),
      definition('coforge_delete_file', 'Delete one regular UTF-8 file only in the Build worktree, with its exact previous content. No directories, metadata or credentials.', schema({ taskId: identifier, path: pathSchema, expectedContent: { type: 'string', maxLength: 200000 } }), false),
    ];
  }
  private idea(projectId: string, ideaId: string) {
    const project = findProject(this.studio.state(), projectId);
    if (project.unavailable) throw new Error('Restore this project note first.');
    const idea = this.studio.state().ideas.find(item => item.id === ideaId && ideaProjectId(item) === projectId);
    if (!idea) throw new Error('Request not found in this project.');
    return idea;
  }
  private task(projectId: string, taskId: string) {
    const queued = this.studio.state().jobs.find(job => job.id === taskId && job.projectId === projectId && job.provider === 'mcp' && job.status === 'queued');
    if (queued) throw new McpToolError('TASK_NOT_READY', 'The task is queued behind another active invocation. Wait before polling again.', 'coforge_step_context', 1000);
    const state = this.studio.store.internalSnapshot();
    const job = state.jobs.find(item => item.id === taskId && item.projectId === projectId && item.provider === 'mcp' && item.status === 'running');
    if (!job) throw new Error('This MCP attempt is no longer active.');
    configuredAttempt(state, job);
    const task = this.preparedTask(projectId, taskId);
    const project = findProject(state, projectId);
    if (project.unavailable || task.input.integration.projectPath !== project.projectPath || task.input.integration.worktreeFolder !== project.worktreeFolder ||
      (task.input.workflow?.step.access === 'editworktree' && !project.allowImplementation)) throw new Error('The project permission or directory changed.');
    return task;
  }
  private preparedTask(projectId: string, taskId: string) {
    try { return this.runner.task(projectId, taskId); }
    catch { throw new McpToolError('TASK_NOT_READY', 'This active attempt is preparing its workspace or finalizing its result. Wait before polling again; keep the same task identity.', 'coforge_step_context', 1000); }
  }
  private waitForResult(taskId: string): Promise<void> {
    const finished = () => !this.studio.state().jobs.some(job => job.id === taskId && ['queued', 'running'].includes(job.status));
    if (finished()) return Promise.resolve();
    return new Promise(resolve => {
      let stop = () => {};
      const observe = () => { if (finished()) { stop(); resolve(); } };
      stop = this.studio.subscribe(observe);
      observe();
    });
  }
  call(projectId: string, name: string, raw: unknown): Promise<unknown> {
    const next = this.pending.then(() => this.execute(projectId, name, raw));
    this.pending = next.catch(() => undefined); return next;
  }
  private async execute(projectId: string, name: string, raw: unknown): Promise<unknown> {
    this.authorize(projectId);
    const project = findProject(this.studio.state(), projectId);
    if (project.unavailable) throw new Error('Restore this project note first.');
    if (name === 'coforge_project') {
      shape({}, { strict: true })(raw);
      return { projectId, name: project.settings.projectName, brief: project.settings.projectBrief, workflow: workflowDefinition(project.settings),
        requests: this.studio.state().ideas.filter(idea => ideaProjectId(idea) === projectId).map(({ id, title, status }) => ({ id, title, status })), tasks: this.runner.tasks(projectId) };
    }
    if (name === 'coforge_request_status') {
      const { ideaId } = shape({ ideaId: id }, { strict: true })(raw); const idea = this.idea(projectId, ideaId);
      const jobs = this.studio.state().jobs.filter(job => job.ideaId === ideaId && job.projectId === projectId);
      const job = jobs.find(job => ['queued', 'running'].includes(job.status)) ?? jobs.at(-1);
      const unknownOwnership = !!job && (job.failure?.code === 'ownership_unknown' || job.nativeProcess?.phase === 'unknown' || job.verificationRuntime?.some(record => record.phase !== 'terminal') || job.durable?.snapshot?.phase === 'attention');
      return { ideaId, projectId, status: idea.status, workflow: idea.workflowRun ? { runId: idea.workflowRun.id, state: idea.workflowRun.state, stepIndex: idea.workflowRun.cursor } : null,
        attempt: job ? { taskId: job.id, provider: job.provider, status: job.status, step: job.workflow?.step.name ?? job.stage,
          startedAt: job.startedAt, finishedAt: job.finishedAt, failure: job.failure,
          reasonUnavailable: ['failed', 'cancelled'].includes(job.status) && !job.failure,
          evidence: { taskCaptured: !!job.conversation, responseCaptured: !!job.conversation?.response, workspaceRecorded: !!job.workflow?.workspaceId, commandTraceAvailable: !!job.sessionTrace?.events.length },
          ...(job.provider === 'mcp' && ['queued', 'running'].includes(job.status) ? { nextTool: 'coforge_step_context', retryAfterMs: 1000 } : {}) } : null,
        operatorRecoveryRequired: unknownOwnership, humanReviewRequired: idea.status === 'review' || idea.workflowRun?.state === 'awaiting-review',
        nextTool: job?.provider === 'mcp' && ['queued', 'running'].includes(job.status) ? 'coforge_step_context' : 'coforge_request' };
    }
    if (name === 'coforge_request' || name === 'coforge_begin_step') {
      const { ideaId } = shape({ ideaId: id }, { strict: true })(raw);
      const idea = this.idea(projectId, ideaId);
      if (name === 'coforge_request') return { request: idea, jobs: this.studio.state().jobs.filter(job => job.ideaId === ideaId && job.projectId === projectId).map(modelWorkflowJob) };
      const active = this.studio.state().jobs.find(job => job.ideaId === ideaId && ['queued', 'running'].includes(job.status));
      if (active) {
        if (active.provider !== 'mcp') throw new Error('This request already has a native attempt.');
        return { jobId: active.id, taskId: active.id, status: active.status, nextTool: 'coforge_step_context', retryAfterMs: active.status === 'queued' ? 1000 : 0 };
      }
      if (idea.workflowRun && !idea.workflowRun.external) throw new Error('Finish the existing native workflow before starting an external workflow.');
      if (!idea.workflowRun) await this.studio.engine.startMcpWorkflow(ideaId);
      else await this.studio.runWorkflowStep(ideaId);
      const workflow = this.idea(projectId, ideaId).workflowRun;
      const job = this.studio.state().jobs.find(item => item.ideaId === ideaId && item.provider === 'mcp' && item.workflow?.attemptId === workflow?.activeAttemptId);
      return { ...(job ? { jobId: job.id, taskId: job.id, status: job.status, nextTool: 'coforge_step_context', retryAfterMs: job.status === 'queued' ? 1000 : 0 } : { status: workflow?.state, nextTool: 'coforge_request', nextAction: 'Inspect workflow progress. Human steps and recovery require Obsidian.' }), workflow };
    }
    if (name === 'coforge_submit_result') {
      const input = record(raw);
      if (Object.keys(input).some(key => !['taskId', 'output'].includes(key))) throw new Error('Unexpected result fields.');
      const taskId = id(input.taskId);
      this.task(projectId, taskId);
      try { await this.runner.complete(projectId, taskId, input.output); }
      catch (error) {
        if (error instanceof CheckError) throw new McpToolError('INVALID_RESULT', 'The result does not match this step’s captured output schema. Read coforge_step_context and correct the result; the active attempt is retained.', 'coforge_step_context');
        throw error;
      }
      await this.waitForResult(taskId);
      const job = this.studio.state().jobs.find(item => item.id === taskId);
      if (job?.status !== 'succeeded') throw new Error('The result did not commit. Inspect the saved attempt.');
      return { jobId: taskId, status: job.status, request: this.idea(projectId, job.ideaId) };
    }
    if (name === 'coforge_step_context' || name === 'coforge_cancel_step') {
      const { taskId } = taskCheck(raw);
      this.task(projectId, taskId);
      if (name === 'coforge_step_context') return this.runner.context(projectId, taskId);
      await this.studio.cancel(taskId); return { status: 'cancellation-requested', taskId };
    }
    if (name === 'coforge_run_command') {
      const request = shape({ taskId: id, command: text({ min: 1, max: 16000 }), idempotencyKey: text({ min: 1, max: 160 }), label: optional(text({ min: 1, max: 120 })),
        timeoutSeconds: optional(number({ integer: true, min: 1, max: 86400 })), yieldTimeMs: optional(number({ integer: true, min: 0, max: 5000 })) }, { strict: true })(raw);
      this.task(projectId, request.taskId);
      const { taskId, ...command } = request;
      return this.runner.runCommand(projectId, taskId, command, () => { this.task(projectId, taskId); });
    }
    if (name === 'coforge_commands') {
      const { taskId, ...query } = shape({ taskId: id, offset: optional(number({ integer: true, min: 0, max: 100000 })), limit: optional(number({ integer: true, min: 1, max: 100 })), onlyActive: optional(boolean) }, { strict: true })(raw);
      const job = this.studio.state().jobs.find(job => job.id === taskId && job.projectId === projectId && job.provider === 'mcp');
      if (!job || job.workflow?.worktreeCoding?.profile !== 'mcp-worktree-v1') throw new McpToolError('PERMISSION_DENIED', 'This project has no authorized coding task with that identity.');
      const page = await this.runner.listCommands(projectId, taskId, query);
      return { ...page, commands: page.commands.map(({ id, label, status, startedAt, finishedAt, exitCode, failure, truncated, output }) =>
        ({ id, label, status, startedAt, finishedAt, exitCode, failure, truncated, outputCharacters: output.length })), nextTool: 'coforge_command_status' };
    }
    if (name === 'coforge_command_status' || name === 'coforge_cancel_command') {
      if (name === 'coforge_cancel_command' && 'includeOutput' in record(raw)) throw new McpToolError('INVALID_ARGUMENTS', 'Cancellation accepts only taskId and commandId.');
      const { taskId, commandId, includeOutput = false } = shape({ taskId: id, commandId: text({ min: 1, max: 160 }), includeOutput: optional(boolean) }, { strict: true })(raw);
      const job = this.studio.state().jobs.find(job => job.id === taskId && job.projectId === projectId && job.provider === 'mcp');
      if (!job || job.workflow?.worktreeCoding?.profile !== 'mcp-worktree-v1') throw new McpToolError('PERMISSION_DENIED', 'This project has no authorized coding task with that identity.');
      if (name === 'coforge_command_status') {
        const outcome = await this.runner.commandStatus(projectId, taskId, commandId);
        const { output, ...metadata } = outcome;
        return { ...metadata, ...(includeOutput ? { output } : { outputCharacters: output.length, outputHint: 'Call coforge_command_status with includeOutput=true to inspect the bounded recent log.' }),
          ...(['starting', 'running'].includes(outcome.status) ? { nextTool: 'coforge_command_status', retryAfterMs: 1000 } : {}) };
      }
      this.task(projectId, taskId); return this.runner.cancelCommand(projectId, taskId, commandId);
    }
    if (name === 'coforge_inspect_changes') {
      const { taskId, includeDiff = false, maxCharacters = 32000 } = shape({ taskId: id, includeDiff: optional(boolean), maxCharacters: optional(number({ integer: true, min: 100, max: 200000 })) }, { strict: true })(raw);
      this.task(projectId, taskId); const increment = await this.runner.inspectChanges(projectId, taskId);
      this.task(projectId, taskId);
      if (!increment) return { taskId, changed: false, acceptance: 'Human review remains required.' };
      return { taskId, changed: increment.files.length > 0, summary: increment.summary, files: increment.files, snapshotHash: increment.snapshotHash,
        ...(includeDiff ? { diff: increment.diff.slice(0, maxCharacters), truncated: increment.diff.length > maxCharacters } : {}), acceptance: 'Observed worktree changes, not an acceptance or test verdict.' };
    }
    if (['coforge_list_files', 'coforge_read_file', 'coforge_search_files', 'coforge_write_file', 'coforge_delete_file', 'coforge_apply_patch', 'coforge_move_file', 'coforge_read_artifact'].includes(name)) {
      const input = record(raw);
      const task = this.task(projectId, id(input.taskId));
      if (!this.files) throw new Error('Repository tools are unavailable.');
      return this.files.call(name, task, input);
    }
    // Never expose moderation, manual checkpoints, credentials or final acceptance to agents.
    throw new Error('Unknown CoForge MCP tool.');
  }
}
