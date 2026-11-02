import { expect, it, vi } from 'vitest';
import { StudioService } from '../../../features/coforge/application/studio';
import { McpStepRunner } from '../../../features/coforge/application/mcp-step-runner';
import { McpWorkflowTools } from '../../../infrastructure/coforge/mcp-workflow-tools';
import type { McpCodingCommands, McpCommandOutcome } from '../../../features/coforge/application/mcp-coding-ports';
import { createSeed } from '../../../features/coforge/domain/seed';
import { record, text } from '../../../features/coforge/domain/check';
import { MemoryStorage, nodeTimers } from './memory-storage';

async function fixture(completing = false, preparing = false) {
  const state = createSeed(); state.settings = { ...state.settings, provider: 'claude', paused: true, minVotes: 0 };
  let release = () => {}, signal: AbortSignal | undefined;
  const held = new Promise<void>(resolve => { release = resolve; });
  const outcome: McpCommandOutcome = { id: 'command', projectId: 'CFP-001', taskId: 'task', runId: 'run', attemptId: 'attempt',
    label: 'Held admission', status: 'running', output: '', truncated: false, source: 'host-worktree-command', startedAt: new Date().toISOString() };
  const commands: McpCodingCommands = {
    start: vi.fn(async (input, _lease, _request, validate) => { validate(); signal = input.signal; await held; validate(); return outcome; }),
    status: vi.fn(async () => outcome), list: vi.fn(async () => ({ commands: [outcome], total: 1 })), cancel: vi.fn(async () => outcome),
    settle: vi.fn(async () => { await held; return { quiescent: !completing, commands: [] }; }), recover: async () => ({ quiescent: true, commands: [] }),
  };
  const releaseWorkspace = vi.fn(async () => {});
  const runner = new McpStepRunner({ start: async () => {}, acknowledge: async () => {}, assertReviewable: async () => {},
    acquire: async request => { if (preparing && request.access === 'editworktree') await held;
      return { id: 'workspace', cwd: '/bounded', capture: async () => undefined, release: releaseWorkspace }; } }, nodeTimers(), commands);
  const neverRun = async () => { throw new Error('Native providers must not run in a control-dispatch fixture'); };
  const studio = new StudioService(new MemoryStorage(state), { runners: { demo: neverRun, claude: neverRun, mcp: input => { signal = input.signal; return runner.run(input); } },
    timers: nodeTimers(), probeRuntime: async () => ({ cliAvailable: false, projectPath: '/game', allowImplementation: true }) });
  await studio.start(); await studio.updateProject({ projectPath: '/game', allowImplementation: true });
  const idea = studio.state().ideas.find(idea => idea.status === 'inbox')!, projectId = studio.state().activeProjectId!;
  const tools = new McpWorkflowTools(studio, runner);
  const next = async () => {
    const reply = record(await tools.call(projectId, 'coforge_begin_step', { ideaId: idea.id }));
    const taskId = text()(reply.taskId);
    await expect.poll(() => runner.tasks(projectId).some(task => task.taskId === taskId)).toBe(true);
    return taskId;
  };
  for (const output of [{ verdict: 'clear', reason: 'Scoped', signals: [] }, { reach: 10, impact: 1, confidence: 1, effort: 1, rationale: 'Small' },
    { summary: 'Plan', steps: ['Build'], acceptanceCriteria: ['Works'], risks: [] }, { markdown: '# Design' }])
    await tools.call(projectId, 'coforge_submit_result', { taskId: await next(), output });
  const taskId = preparing ? text()(record(await tools.call(projectId, 'coforge_begin_step', { ideaId: idea.id })).taskId) : await next();
  const work = preparing ? Promise.resolve(undefined) : completing ? tools.call(projectId, 'coforge_submit_result', { taskId, output: { summary: 'Review this increment' } })
    : tools.call(projectId, 'coforge_run_command', { taskId, command: 'npm test', idempotencyKey: 'one-command' });
  void work.catch(() => {});
  if (preparing) await expect.poll(() => studio.state().jobs.at(-1)?.status).toBe('running');
  else await expect.poll(() => completing ? commands.settle : commands.start).toHaveBeenCalledOnce();
  return { studio, releaseWorkspace, commands, tools, taskId, projectId, ideaId: idea.id, work, signal: () => signal,
    close: async () => { release(); await work.catch(() => {}); await runner.dispose(); await studio.stop(); } };
}

it('lets compact status, task context and command discovery pass held work while keeping ordinary dispatch serialized', async () => {
  const f = await fixture(); let ordinaryFinished = false;
  const controls: Promise<unknown>[] = [];
  const ordinary = f.tools.call(f.projectId, 'coforge_request', { ideaId: f.ideaId }).then(() => { ordinaryFinished = true; });
  try {
    let status: unknown;
    const control = f.tools.call(f.projectId, 'coforge_request_status', { ideaId: f.ideaId }).then(value => { status = value; });
    controls.push(control);
    await expect.poll(() => status, { timeout: 1000 }).toMatchObject({ attempt: { taskId: f.taskId, status: 'running' } });
    await control;
    expect(await f.tools.call(f.projectId, 'coforge_step_context', { taskId: f.taskId })).toMatchObject({ taskId: f.taskId });
    expect(await f.tools.call(f.projectId, 'coforge_command_status', { taskId: f.taskId, commandId: 'command' })).toMatchObject({ id: 'command', status: 'running' });
    expect(await f.tools.call(f.projectId, 'coforge_commands', { taskId: f.taskId })).toMatchObject({ total: 1 });
    expect(ordinaryFinished).toBe(false); expect(f.commands.start).toHaveBeenCalledOnce();
  } finally { await f.close(); await ordinary; await Promise.allSettled(controls); }
});

it('cancels the original completing task without granting another provider/project access or clearing unknown cleanup', async () => {
  const f = await fixture(true); let stop: Promise<unknown> | undefined;
  try {
    await expect(f.tools.call('CFP-999', 'coforge_cancel_step', { taskId: f.taskId })).rejects.toThrow();
    await f.studio.store.transaction(state => { state.jobs.at(-1)!.provider = 'claude'; });
    await expect(f.tools.call(f.projectId, 'coforge_cancel_step', { taskId: f.taskId })).rejects.toThrow();
    expect(f.signal()?.aborted).toBe(false);
    await f.studio.store.transaction(state => { state.jobs.at(-1)!.provider = 'mcp'; });
    stop = f.tools.call(f.projectId, 'coforge_cancel_step', { taskId: f.taskId }); void stop.catch(() => {});
    await expect.poll(() => f.signal()?.aborted, { timeout: 1000 }).toBe(true);
    expect(await stop).toMatchObject({ status: 'cancellation-requested', taskId: f.taskId });
    expect(f.studio.state().jobs).toHaveLength(5);
  } finally { await f.close(); await stop?.catch(() => {}); }
  expect(f.studio.state().jobs.at(-1)?.failure?.code).toBe('ownership_unknown');
  expect(f.releaseWorkspace).toHaveBeenCalledWith(true);
});

it('cancels an original task that is still preparing its workspace without enabling task access or starting a command', async () => {
  const f = await fixture(false, true);
  try {
    await expect(f.tools.call(f.projectId, 'coforge_step_context', { taskId: f.taskId })).rejects.toMatchObject({ code: 'TASK_NOT_READY' });
    expect(await f.tools.call(f.projectId, 'coforge_cancel_step', { taskId: f.taskId })).toMatchObject({ status: 'cancellation-requested' });
    expect(f.signal()?.aborted).toBe(true); expect(f.commands.start).not.toHaveBeenCalled(); expect(f.studio.state().jobs).toHaveLength(5);
  } finally { await f.close(); }
});

it('reaches the existing command cancellation and task abort signal without waiting for held work to finish', async () => {
  const f = await fixture();
  const controls: Promise<unknown>[] = [];
  try {
    let commandCancelled = false;
    const cancelCommand = f.tools.call(f.projectId, 'coforge_cancel_command', { taskId: f.taskId, commandId: 'command' }).then(() => { commandCancelled = true; });
    controls.push(cancelCommand);
    await expect.poll(() => commandCancelled, { timeout: 1000 }).toBe(true); await cancelCommand;
    expect(f.commands.cancel).toHaveBeenCalledExactlyOnceWith(f.projectId, f.taskId, 'command');
    const stop = f.tools.call(f.projectId, 'coforge_cancel_step', { taskId: f.taskId });
    controls.push(stop);
    await expect.poll(() => f.signal()?.aborted, { timeout: 1000 }).toBe(true);
    expect(await stop).toMatchObject({ status: 'cancellation-requested', taskId: f.taskId });
    expect(f.commands.start).toHaveBeenCalledOnce();
  } finally { await f.close(); await Promise.allSettled(controls); }
});
