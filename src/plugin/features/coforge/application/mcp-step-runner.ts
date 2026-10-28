import type { StageInput, StageResult, Timers } from './ports';
import type { WorkflowWorkspaceLease, WorkflowWorkspaces } from './workflow-workspace-ports';
import { executionAccess, executionResult, executionSchema, executionSystemPrompt, executionTaskPrompt, validateExecutionOutput } from './workflow-execution';
import { ideaProjectId } from '../domain/projects';

interface Pending {
  input: StageInput;
  lease: WorkflowWorkspaceLease;
  resolve(value: StageResult): void;
  reject(error: Error): void;
  completing: boolean;
}
/** External clients supply semantic results. Only the host supplies workspaces and captured diffs. */
export class McpStepRunner {
  private readonly pending = new Map<string, Pending>();
  private disposed = false;
  constructor(private readonly workspaces: WorkflowWorkspaces, private readonly timers: Timers) {}
  tasks(projectId: string) {
    return [...this.pending.entries()].filter(([, task]) => ideaProjectId(task.input.idea) === projectId)
      .map(([taskId, task]) => ({ taskId, ideaId: task.input.idea.id, step: task.input.workflow?.step.name, access: executionAccess(task.input) }));
  }
  task(projectId: string, taskId: string): Pending {
    const task = this.pending.get(taskId);
    if (this.disposed || !task || task.completing || task.input.signal?.aborted || ideaProjectId(task.input.idea) !== projectId)
      throw new Error('This MCP task is unavailable. Inspect its saved attempt before explicitly starting another.');
    return task;
  }
  context(projectId: string, taskId: string) {
    const { input } = this.task(projectId, taskId);
    return { taskId, ideaId: input.idea.id, step: input.workflow?.step.name, access: executionAccess(input),
      instructions: executionSystemPrompt(input), context: executionTaskPrompt(input), outputSchema: executionSchema(input),
      tools: executionAccess(input) === 'none' ? [] : executionAccess(input) === 'readproject' ? ['coforge_list_files', 'coforge_read_file', 'coforge_search_files'] : ['coforge_list_files', 'coforge_read_file', 'coforge_search_files', 'coforge_write_file', 'coforge_delete_file'],
      completion: 'Submit the schema object with coforge_submit_result. Code diffs are captured by the host; streamer acceptance remains manual. Costs, shell tests and tool limits of your external client are not enforced or inferred by CoForge.' };
  }
  async complete(projectId: string, taskId: string, raw: unknown): Promise<void> {
    const task = this.task(projectId, taskId);
    const validated = validateExecutionOutput(task.input, raw);
    const result = executionResult(task.input, validated);
    task.completing = true;
    try {
      if (executionAccess(task.input) === 'editworktree') {
        const increment = await task.lease.capture(result.summary ?? result.plan?.summary ?? 'MCP workflow changes');
        await task.input.onChanges?.(increment ?? null);
        if (increment) result.increment = increment;
      }
      await task.lease.release();
      task.resolve(result);
    } catch (error) {
      task.reject(new Error('MCP result capture failed. Inspect the attributed workspace before retrying.'));
      throw error;
    }
  }
  async run(input: StageInput): Promise<StageResult> {
    if (this.disposed || !input.jobId || !input.workflow) throw new Error('MCP workflow runner is unavailable.');
    input.signal?.throwIfAborted();
    const lease = await this.workspaces.acquire({ runId: input.workflow.runId, projectId: ideaProjectId(input.idea), attemptId: input.workflow.attemptId,
      access: executionAccess(input), integration: input.integration, ...(input.workflow.workspaceId ? { workspaceId: input.workflow.workspaceId } : {}), ...(input.signal ? { signal: input.signal } : {}) });
    try {
      if (lease.id) await input.onWorkspace?.(lease.id);
      if (this.disposed) throw new Error('MCP stopped.');
      input.signal?.throwIfAborted();
      return await new Promise<StageResult>((resolve, reject) => {
        const stop = () => { cleanup(); reject(new Error('MCP task interrupted. Inspect its saved attempt and workspace before retrying.')); };
        const timer = this.timers.setTimeout(stop, input.settings.timeoutSeconds * 1000);
        const cleanup = () => { this.timers.clearTimeout(timer); input.signal?.removeEventListener('abort', stop); this.pending.delete(input.jobId!); };
        this.pending.set(input.jobId!, { input, lease, completing: false,
          resolve: value => { cleanup(); resolve(value); }, reject: error => { cleanup(); reject(error); } });
        input.signal?.addEventListener('abort', stop, { once: true });
      });
    } catch {
      if (executionAccess(input) === 'editworktree') {
        try { const changes = await lease.capture('Interrupted MCP step: inspect partial changes'); await input.onChanges?.(changes ?? null); } catch { /* The workspace journal retains independent recovery evidence. */ }
      }
      await lease.release(true);
      throw new Error('MCP task interrupted. Inspect its saved attempt and workspace before retrying.');
    } finally { this.pending.delete(input.jobId); }
  }
  async dispose(): Promise<void> {
    this.disposed = true;
    for (const task of this.pending.values()) task.reject(new Error('MCP server stopped. Inspect the saved attempt before retrying.'));
  }
  acknowledge(workspaceId: string, attemptId: string): Promise<void> { return this.workspaces.acknowledge(workspaceId, attemptId, true); }
}
