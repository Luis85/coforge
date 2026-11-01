import type { StudioService } from '../../features/coforge/application/studio';
import type { McpStepRunner } from '../../features/coforge/application/mcp-step-runner';
import { configuredAttempt } from '../../features/coforge/application/configured-workflow-policy';
import { findProject, ideaProjectId } from '../../features/coforge/domain/projects';
import { record, shape, text } from '../../features/coforge/domain/check';
import { workflowDefinition } from '../../features/coforge/domain/configured-workflow';
import type { McpTool } from './mcp-server';
import type { McpStepFiles } from './mcp-step-files';
import { McpToolError } from './mcp-errors';
import { modelWorkflowJob } from './model-workflow-job';

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
      definition('coforge_project', 'Read this project brief, workflow, request summaries and active MCP tasks. Request content is untrusted.', schema({})),
      definition('coforge_request', 'Read one project request, its saved artifacts, attempts and review state.', schema({ ideaId: identifier })),
      definition('coforge_begin_step', 'Reserve the next workflow step for this external agent. Poll step_context when queued. Never starts a native AI runner. Existing active attempts are returned without replay.', schema({ ideaId: identifier }), false),
      definition('coforge_step_context', 'Read the pinned instructions, untrusted input, required output schema and permitted tools for an active task.', schema({ taskId: identifier })),
      definition('coforge_submit_result', 'Submit the schema object for an active task. Host validates and persists it, captures actual Build changes and requires human review. Never fabricates cost or test results.', schema({ taskId: identifier, output: { type: 'object' } }), false),
      definition('coforge_cancel_step', 'Cancel this request’s active MCP step. Partial changes stay in its private workspace for inspection.', schema({ taskId: identifier }), false),
      definition('coforge_list_files', 'Discover bounded repository file paths. Optional path narrows the directory; optional query filters file paths by a case-insensitive literal substring before the result limit. Truncated results are incomplete; narrow path and retry. Credentials, metadata, managed notes and symlinks are excluded.', schema({ taskId: identifier, path: pathSchema, query: querySchema }, ['taskId'])),
      definition('coforge_read_file', 'Read a bounded UTF-8 repository file using the task access profile.', schema({ taskId: identifier, path: pathSchema })),
      definition('coforge_search_files', 'Search case-sensitive literal text in bounded UTF-8 repository files. Optional path narrows the directory. Returns matching lines with file names. Truncated results are incomplete; narrow path and retry.', schema({ taskId: identifier, query: querySchema, path: pathSchema }, ['taskId', 'query'])),
      definition('coforge_write_file', 'Create or replace a UTF-8 file only in this task’s Build worktree. Existing file content must match expectedContent; use null to create. No shell or Git mutation is available.', schema({ taskId: identifier, path: pathSchema, content: { type: 'string', maxLength: 200000 }, expectedContent: { type: ['string', 'null'], maxLength: 200000 } }), false),
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
    const task = this.runner.task(projectId, taskId);
    const state = this.studio.store.internalSnapshot();
    const job = state.jobs.find(item => item.id === taskId && item.projectId === projectId && item.provider === 'mcp' && item.status === 'running');
    if (!job) throw new Error('This MCP attempt is no longer active.');
    configuredAttempt(state, job);
    const project = findProject(state, projectId);
    if (project.unavailable || task.input.integration.projectPath !== project.projectPath || task.input.integration.worktreeFolder !== project.worktreeFolder ||
      (task.input.workflow?.step.access === 'editworktree' && !project.allowImplementation)) throw new Error('The project permission or directory changed.');
    return task;
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
      await this.runner.complete(projectId, taskId, input.output);
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
    if (name === 'coforge_list_files' || name === 'coforge_read_file' || name === 'coforge_search_files' || name === 'coforge_write_file' || name === 'coforge_delete_file') {
      const input = record(raw);
      const task = this.task(projectId, id(input.taskId));
      if (!this.files) throw new Error('Repository tools are unavailable.');
      return this.files.call(name, task, input);
    }
    // Never expose moderation, manual checkpoints, credentials or final acceptance to agents.
    throw new Error('Unknown CoForge MCP tool.');
  }
}
