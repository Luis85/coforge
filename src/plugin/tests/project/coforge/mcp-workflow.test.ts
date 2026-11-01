import { afterEach, expect, it, vi } from 'vitest';
import { StudioService } from '../../../features/coforge/application/studio';
import { McpStepRunner } from '../../../features/coforge/application/mcp-step-runner';
import { McpWorkflowTools } from '../../../infrastructure/coforge/mcp-workflow-tools';
import { McpVaultTools } from '../../../infrastructure/coforge/mcp-vault-tools';
import { createSeed } from '../../../features/coforge/domain/seed';
import { record } from '../../../features/coforge/domain/check';
import { MemoryStorage, nodeTimers, toLoaded } from './memory-storage';
import { parsePersistedStudio } from '../../../features/coforge/domain/persisted';
import { workflowRunCheck } from '../../../features/coforge/domain/configured-workflow-run';
import type { WorkflowWorkspaces } from '../../../features/coforge/application/workflow-workspace-ports';
import { appendAgentSessionEvent } from '../../../features/coforge/domain/agent-session';
import type { McpCodingCommands, McpCommandOutcome } from '../../../features/coforge/application/mcp-coding-ports';

const stops: Array<() => Promise<void>> = [];
afterEach(async () => { for (const stop of stops.splice(0)) await stop(); });
async function fixture(commands?: McpCodingCommands) {
  const state = createSeed();
  state.settings = { ...state.settings, provider: 'claude', paused: true, minVotes: 0 };
  const captures: string[] = [];
  const workspaces: WorkflowWorkspaces = {
    start: async () => {}, acknowledge: async () => {}, assertReviewable: async () => {},
    acquire: async () => ({ id: 'workspace-one', cwd: '/bounded', capture: async summary => {
      captures.push(summary);
      return { summary, files: [{ path: 'game.ts', additions: 1, deletions: 0 }], diff: '+lantern', tests: ['Not run'], createdAt: new Date().toISOString(), simulated: false };
    }, release: async () => {} }),
  };
  const runner = new McpStepRunner(workspaces, nodeTimers(), commands);
  const studio = new StudioService(new MemoryStorage(state), { runners: { demo: async () => { throw new Error('Native runner must not run'); }, claude: async () => { throw new Error('Native runner must not run'); }, mcp: input => runner.run(input) }, timers: nodeTimers(),
    probeRuntime: async () => ({ cliAvailable: false, projectPath: '/game', allowImplementation: true }) });
  await studio.start();
  await studio.updateProject({ projectPath: '/game', allowImplementation: true });
  const idea = studio.state().ideas.find(item => item.status === 'inbox')!;
  const tools = new McpWorkflowTools(studio, runner);
  stops.push(async () => { await runner.dispose(); await studio.stop(); });
  const projectId = studio.state().activeProjectId!;
  const next = async () => {
    const reply = record(await tools.call(projectId, 'coforge_begin_step', { ideaId: idea.id }));
    const jobId = String(reply.jobId);
    await expect.poll(() => runner.tasks(projectId).some(task => task.taskId === jobId)).toBe(true);
    return record(await tools.call(projectId, 'coforge_step_context', { taskId: jobId }));
  };
  return { studio, tools, runner, projectId, idea, next, captures };
}
it('does not expose operator Restart or allow an external agent to release a stopped request', async () => {
  const f = await fixture(); await f.next();
  await f.studio.stopWorkflow(f.idea.id); await f.studio.engine.waitUntilIdle();
  const count = f.studio.state().jobs.length;
  expect(f.tools.tools().some(tool => /restart/i.test(tool.name))).toBe(false);
  await expect(f.tools.call(f.projectId, 'coforge_restart_workflow', { ideaId: f.idea.id })).rejects.toThrow();
  await expect(f.tools.call(f.projectId, 'coforge_begin_step', { ideaId: f.idea.id })).rejects.toThrow('Restart workflow');
  expect(f.studio.state().workflowStopHolds).toContain(f.idea.id);
  expect(f.studio.state().ideas.find(idea => idea.id === f.idea.id)?.status).toBe('inbox');
  expect(f.studio.state().jobs).toHaveLength(count);
});
it('routes captured coding commands through the live task, provides compact status and preserves final human review', async () => {
  let outcome: McpCommandOutcome = { id: 'command', projectId: '', taskId: '', runId: '', attemptId: '', label: 'Checks', status: 'completed',
    startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), exitCode: 0, output: 'Actual observed check output', truncated: false, source: 'host-worktree-command' };
  const commands: McpCodingCommands = {
    start: vi.fn(async (input, lease, request, validate) => {
      validate(); expect(lease.id).toBe('workspace-one'); expect(request.idempotencyKey).toBe('check-1');
      outcome = { ...outcome, projectId: input.idea.projectId!, taskId: input.jobId!, runId: input.workflow!.runId, attemptId: input.workflow!.attemptId }; return outcome;
    }), status: vi.fn(async () => outcome), cancel: vi.fn(async () => outcome), list: vi.fn(async () => ({ commands: [outcome], total: 1 })),
    settle: vi.fn(async () => ({ quiescent: true, commands: [outcome] })), recover: vi.fn(async () => ({ quiescent: true, commands: [outcome] })),
  };
  const f = await fixture(commands);
  for (const output of [{ verdict: 'clear', reason: 'Scoped', signals: [] }, { reach: 10, impact: 1, confidence: 1, effort: 1, rationale: 'Small' },
    { summary: 'Plan', steps: ['Build'], acceptanceCriteria: ['Works'], risks: [] }, { markdown: '# Design' }]) {
    const context = await f.next(); await f.tools.call(f.projectId, 'coforge_submit_result', { taskId: context.taskId, output });
  }
  const context = await f.next(); const taskId = String(context.taskId);
  expect(context.tools).toContain('coforge_run_command');
  await expect(f.tools.call(f.projectId, 'coforge_run_command', { taskId, command: 'npm test' })).rejects.toThrow();
  expect(await f.tools.call(f.projectId, 'coforge_run_command', { taskId, command: 'npm test', idempotencyKey: 'check-1' })).toMatchObject({ exitCode: 0 });
  expect(await f.tools.call(f.projectId, 'coforge_command_status', { taskId, commandId: 'command' })).toMatchObject({ outputCharacters: 28 });
  expect(await f.tools.call(f.projectId, 'coforge_command_status', { taskId, commandId: 'command', includeOutput: true })).toMatchObject({ output: outcome.output });
  const discovered = record(await f.tools.call(f.projectId, 'coforge_commands', { taskId }));
  expect(discovered).toMatchObject({ total: 1, commands: [{ id: 'command', status: 'completed', exitCode: 0 }] });
  expect(JSON.stringify(discovered)).not.toContain(outcome.output);
  await expect(f.tools.call(f.projectId, 'coforge_cancel_command', { taskId, commandId: 'command', includeOutput: true })).rejects.toThrow();
  const status = record(await f.tools.call(f.projectId, 'coforge_request_status', { ideaId: f.idea.id }));
  expect(status).toMatchObject({ attempt: { taskId, status: 'running', nextTool: 'coforge_step_context' }, humanReviewRequired: false });
  expect(JSON.stringify(status)).not.toContain('prompt'); expect(JSON.stringify(status)).not.toContain('workspace-one');
  await f.tools.call(f.projectId, 'coforge_submit_result', { taskId, output: { summary: 'Implemented and checked' } });
  expect(commands.start).toHaveBeenCalledOnce(); expect(commands.settle).toHaveBeenCalledOnce();
  expect(await f.tools.call(f.projectId, 'coforge_request_status', { ideaId: f.idea.id })).toMatchObject({ humanReviewRequired: true, attempt: { status: 'succeeded' } });
  await expect(f.tools.call(f.projectId, 'coforge_run_command', { taskId, command: 'npm test', idempotencyKey: 'late' })).rejects.toThrow();
  expect(commands.start).toHaveBeenCalledOnce();
});

it('keeps verification container ownership and private source directories out of model-facing request jobs', async () => {
  const f = await fixture(); await f.next();
  await f.studio.store.transaction(state => {
    state.jobs.at(-1)!.verificationRuntime = [{ verificationId: 'private-check', containerName: 'private-container', ownerToken: 'DO-NOT-DISCLOSE', dockerBin: 'docker', endpoint: 'npipe:////./pipe/private-engine', imageId: `sha256:${'a'.repeat(64)}`, runId: 'run', attemptId: 'attempt', projectId: f.projectId, sourceDirectory: '/private/source-copy', sourceHash: 'b'.repeat(64), commandId: 'test', phase: 'prepared', startedAt: new Date().toISOString() }];
    state.jobs.at(-1)!.nativeProcess = { runId: 'run', attemptId: 'attempt', projectId: f.projectId, identity: { pid: 123, platform: 'win32', birth: 'DO-NOT-DISCLOSE-NATIVE', image: 'd'.repeat(64) }, phase: 'unknown', observedAt: new Date().toISOString() };
    state.jobs.at(-1)!.nativeRuntime = { runId: 'run', attemptId: 'attempt', projectId: f.projectId, directory: '/private/native-home', ownerToken: 'e'.repeat(64) };
    const trace = appendAgentSessionEvent(undefined, { kind: 'message', text: 'PRIVATE_OPERATOR_SESSION_OBSERVATION' }, new Date().toISOString());
    const job = state.jobs.at(-1)!;
    job.sessionTrace = trace;
    const ref = { version: 1 as const, executionId: 'execution', workerId: 'worker', epoch: 1, inputHash: 'a'.repeat(64) };
    job.durable = { intent: 'start', ref, policy: { mode: 'background' }, snapshot: { version: 1, ref, sequence: 1, phase: 'running', createdAt: job.startedAt,
      lastContactAt: job.startedAt, elapsedSeconds: 0, logs: [], sessionTrace: trace } };
  });
  const visible = await f.tools.call(f.projectId, 'coforge_request', { ideaId: f.idea.id });
  expect(JSON.stringify(visible)).not.toContain('verificationRuntime');
  expect(JSON.stringify(visible)).not.toContain('nativeProcess');
  expect(JSON.stringify(visible)).not.toContain('nativeRuntime');
  expect(JSON.stringify(visible)).not.toContain('/private/native-home');
  expect(JSON.stringify(visible)).not.toContain('DO-NOT-DISCLOSE');
  expect(JSON.stringify(visible)).not.toContain('/private/source-copy');
  expect(JSON.stringify(visible)).not.toContain('sessionTrace');
  expect(JSON.stringify(visible)).not.toContain('PRIVATE_OPERATOR_SESSION_OBSERVATION');
  expect(f.studio.state().jobs.at(-1)?.sessionTrace?.events[0]?.text).toBe('PRIVATE_OPERATOR_SESSION_OBSERVATION');
  expect(f.studio.state().jobs.at(-1)?.verificationRuntime?.[0]?.ownerToken).toBe('DO-NOT-DISCLOSE');
});

it('lets an external agent perform all five default steps, preserving the design handoff and human review', async () => {
  const f = await fixture();
  const outputs = [
    { verdict: 'clear', reason: 'A scoped game feature', signals: [] },
    { reach: 100, impact: 1, confidence: 0.8, effort: 1, rationale: 'Small feature' },
    { summary: 'Add a lantern', steps: ['Add light'], acceptanceCriteria: ['Light renders'], risks: [] },
    { markdown: '# Lantern design\n\nUse the existing light component and preserve save compatibility.' },
    { summary: 'Added a lantern' },
  ];
  for (const [index, output] of outputs.entries()) {
    const context = await f.next();
    expect(context.access).toBe(['none', 'none', 'readproject', 'readproject', 'editworktree'][index]);
    expect(context.outputSchema).toBeDefined();
    await f.tools.call(f.projectId, 'coforge_submit_result', { taskId: context.taskId, output });
  }
  const idea = f.studio.state().ideas.find(item => item.id === f.idea.id)!;
  expect(idea.status).toBe('review');
  expect(idea.workflowRun).toMatchObject({ external: true, state: 'awaiting-review', cursor: 5 });
  expect(idea.workflowRun?.artifacts.find(artifact => artifact.stepId === 'design')?.markdown).toContain('preserve save compatibility');
  expect(idea.screening?.provider).toBe('mcp');
  expect(idea.increment?.diff).toBe('+lantern');
  expect(f.captures).toEqual(['Added a lantern']);
  expect(f.studio.state().jobs.filter(job => job.ideaId === idea.id).map(job => job.provider)).toEqual(['mcp', 'mcp', 'mcp', 'mcp', 'mcp']);
  expect(parsePersistedStudio(toLoaded(f.studio.store.internalSnapshot()).data).jobs.at(-1)?.provider).toBe('mcp');
  expect(workflowRunCheck(idea.workflowRun).external).toBe(true);
  expect(f.tools.tools().map(tool => tool.name)).not.toContain('coforge_approve');
});
it('discovers projects through one connection and requires explicit project routing regardless of selected board', async () => {
  const f = await fixture();
  const vault = new McpVaultTools(f.studio, f.tools);
  const other = await f.studio.createProject({ projectName: 'Other game', projectBrief: 'Another project for routing tests.', projectPath: '/other' });
  const discovered = record(await vault.call('coforge_projects', {}));
  expect(discovered.projects).toEqual(expect.arrayContaining([expect.objectContaining({ projectId: f.projectId }), expect.objectContaining({ projectId: other.id })]));
  await f.studio.selectProject(other.id);
  await expect(vault.call('coforge_request', { ideaId: f.idea.id })).rejects.toThrow();
  await expect(vault.call('coforge_request', { projectId: other.id, ideaId: f.idea.id })).rejects.toThrow();
  expect(await vault.call('coforge_request', { projectId: f.projectId, ideaId: f.idea.id })).toMatchObject({ request: { id: f.idea.id, projectId: f.projectId } });
  expect(await vault.call('coforge_help', {})).toMatchObject({ nextTool: 'coforge_projects', steps: expect.any(Array) });
  for (const tool of vault.tools().filter(tool => !['coforge_projects', 'coforge_help'].includes(tool.name))) expect(record(tool.inputSchema).required).toContain('projectId');
  expect(vault.tools()).toEqual(expect.arrayContaining([
    expect.objectContaining({ name: 'coforge_list_files', inputSchema: expect.objectContaining({ required: ['projectId', 'taskId'], properties: expect.objectContaining({ query: expect.any(Object), path: expect.any(Object) }) }) }),
    expect.objectContaining({ name: 'coforge_search_files', inputSchema: expect.objectContaining({ required: ['projectId', 'taskId', 'query'], properties: expect.objectContaining({ path: expect.any(Object) }) }) }),
  ]));
});
it('rejects malformed results, stale requests, wrong projects and unknown tools without advancing', async () => {
  const f = await fixture();
  const context = await f.next();
  await expect(f.tools.call(f.projectId, 'coforge_submit_result', { taskId: context.taskId, output: { verdict: 'clear' } })).rejects.toThrow();
  expect(f.studio.state().ideas.find(item => item.id === f.idea.id)?.workflowRun?.cursor).toBe(0);
  await expect(f.tools.call('CFP-999', 'coforge_step_context', { taskId: context.taskId })).rejects.toThrow();
  await expect(f.tools.call(f.projectId, 'coforge_approve', { ideaId: f.idea.id })).rejects.toThrow();
  await f.studio.store.transaction(state => { state.ideas.find(item => item.id === f.idea.id)!.description += ' changed'; });
  await expect(f.tools.call(f.projectId, 'coforge_submit_result', { taskId: context.taskId, output: { verdict: 'clear', reason: 'okay', signals: [] } })).rejects.toThrow();
});
it('returns the same active attempt without replay and fails an interrupted attempt without advancing', async () => {
  const f = await fixture(); const context = await f.next();
  const duplicate = await f.tools.call(f.projectId, 'coforge_begin_step', { ideaId: f.idea.id });
  expect(duplicate).toMatchObject({ jobId: context.taskId });
  const count = f.studio.state().jobs.length;
  await f.runner.dispose(); await f.studio.engine.waitUntilIdle();
  expect(f.studio.state().jobs).toHaveLength(count);
  expect(f.studio.state().jobs.find(job => job.id === context.taskId)?.status).toBe('failed');
  expect(f.studio.state().ideas.find(idea => idea.id === f.idea.id)?.workflowRun).toMatchObject({ state: 'attention', cursor: 0, external: true });
  expect(f.runner.tasks(f.projectId)).toEqual([]);
});
it('retains rejected and corrected external submissions without blocking the existing correction flow', async () => {
  const f = await fixture(); const context = await f.next();
  await expect(f.tools.call(f.projectId, 'coforge_submit_result', { taskId: context.taskId, output: { verdict: 'invalid' } })).rejects.toMatchObject({ code: 'INVALID_RESULT', nextTool: 'coforge_step_context' });
  await f.tools.call(f.projectId, 'coforge_submit_result', { taskId: context.taskId, output: { verdict: 'clear', reason: 'Corrected response', signals: [] } });
  const job = f.studio.state().jobs.find(job => job.id === context.taskId);
  expect(job?.status).toBe('succeeded');
  expect(job?.conversation?.response?.text).toContain('invalid');
  expect(job?.conversation?.response?.text).toContain('Additional submitted response');
  expect(job?.conversation?.response?.text).toContain('Corrected response');
});
it('acknowledges one completed project step while another project is queued, without blocking its tools', async () => {
  const f = await fixture(); const first = await f.next();
  const other = await f.studio.createProject({ projectName: 'Queued game', projectBrief: 'A second project with queued external work.', projectPath: '/other' });
  await f.studio.store.transaction(state => { state.ideas.push({ ...structuredClone(f.idea), id: 'CF-999', number: 999, projectId: other.id }); });
  const queued = record(await f.tools.call(other.id, 'coforge_begin_step', { ideaId: 'CF-999' }));
  await expect(f.tools.call(other.id, 'coforge_step_context', { taskId: queued.jobId })).rejects.toMatchObject({ code: 'TASK_NOT_READY', nextTool: 'coforge_step_context', retryAfterMs: 1000 });
  let acknowledged = false;
  const completion = f.tools.call(f.projectId, 'coforge_submit_result', { taskId: first.taskId, output: { verdict: 'clear', reason: 'A game feature', signals: [] } }).then(result => { acknowledged = true; return result; });
  try {
    await expect.poll(() => acknowledged, { timeout: 2000 }).toBe(true);
    await completion;
    await expect.poll(() => f.runner.tasks(other.id).some(task => task.taskId === queued.jobId)).toBe(true);
    expect(await f.tools.call(other.id, 'coforge_step_context', { taskId: queued.jobId })).toMatchObject({ ideaId: 'CF-999' });
  } finally { await f.runner.dispose(); await completion; }
});
