import { expect, it, vi } from 'vitest';
import { WorkflowEngine } from '../../../features/coforge/application/engine';
import { workerBackedJob } from '../../../features/coforge/application/workflow-job-lanes';
import { seededStore, nodeTimers } from './memory-storage';
import { ai, definition, increment } from './configured-workflow-fixture';
import type { StageInput } from '../../../features/coforge/application/ports';

it('admits a new external coding task from a saved background Build without launching a native worker', async () => {
  const { store } = await seededStore();
  await store.transaction(state => {
    state.settings.workflow = definition([{ ...ai('build', 'codechange', 'editworktree'), provider: 'claude', execution: { mode: 'background' } }]);
    state.integration.projectPath = '/synthetic/game'; state.integration.allowImplementation = true;
    const project = state.projects.find(project => project.id === state.activeProjectId)!;
    project.allowImplementation = true; project.projectPath = '/synthetic/game';
    state.runtime.durableBuild = { ready: false, message: 'Native worker is unavailable' };
  });
  const native = vi.fn(async () => { throw new Error('Native worker must not execute an external task'); });
  const mcp = vi.fn(async (input: StageInput) => {
    expect(input.workflow?.worktreeCoding).toEqual({ version: 1, profile: 'mcp-worktree-v1' });
    expect(input.workflow?.step.execution).toEqual({ mode: 'background' });
    await input.onWorkspace?.('fixture-workspace');
    const captured = { ...increment, snapshotHash: 'a'.repeat(64), simulated: false };
    await input.onChanges?.(captured);
    return { summary: captured.summary, increment: captured };
  });
  const engine = new WorkflowEngine(store, { runners: { demo: native, claude: native, mcp }, timers: nodeTimers() });
  try {
    const current = store.snapshot(); const idea = current.ideas.find(idea => idea.status === 'inbox' && idea.projectId === current.activeProjectId)!;
    await engine.startMcpWorkflow(idea.id); await engine.waitUntilIdle();
    expect(mcp).toHaveBeenCalledOnce(); expect(native).not.toHaveBeenCalled();
    const job = store.snapshot().jobs.at(-1)!;
    expect(job.error).toBeUndefined();
    expect(job.provider).toBe('mcp'); expect(job.status).toBe('succeeded'); expect(job.durable).toBeUndefined();
    expect(workerBackedJob(job)).toBe(false);
    expect(workerBackedJob({ ...job, workflow: { ...job.workflow!, worktreeCoding: undefined } })).toBe(true);
  } finally { await engine.stop(); }
});
