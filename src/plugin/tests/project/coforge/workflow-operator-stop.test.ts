import { expect, it, vi } from 'vitest';
import { ConfiguredWorkflowEngine } from '../../../features/coforge/application/configured-workflow-engine';
import { WorkflowEngine } from '../../../features/coforge/application/engine';
import { StudioStore } from '../../../features/coforge/application/studio-store';
import { createSeed } from '../../../features/coforge/domain/seed';
import type { StageInput } from '../../../features/coforge/application/ports';
import { ai, definition, increment } from './configured-workflow-fixture';
import { MemoryStorage, nodeTimers } from './memory-storage';

async function setup() {
  const state = createSeed(); state.ideas = state.ideas.filter(idea => idea.status === 'inbox').slice(0, 1); state.jobs = [];
  state.settings.workflow = { ...definition([ai('first'), ai('second')]), startupMode: 'play' };
  const storage = new MemoryStorage(state); const store = new StudioStore(storage); await store.init();
  const runner = vi.fn(async () => ({ markdown: '# Answer' }));
  const host = { runners: { demo: runner, claude: runner }, cost: async () => {}, usage: async () => {} };
  const configured = new ConfiguredWorkflowEngine(store, host);
  return { store, storage, runner, host, configured, id: store.snapshot().ideas[0]!.id };
}

it('durably stops in Inbox and blocks generic/manual/MCP/triggered starts and startup Play', async () => {
  const { store, storage, configured, runner, host, id } = await setup();
  await configured.start(id); await configured.stop(id);
  expect(store.snapshot().ideas[0]?.status).toBe('inbox');
  await expect(configured.start(id)).rejects.toThrow(/Restart workflow/);
  await expect(configured.next(id)).rejects.toThrow(/Restart workflow/);
  const reloaded = new StudioStore(storage); await reloaded.init();
  const engine = new WorkflowEngine(reloaded, { ...host, timers: nodeTimers() });
  try {
    expect(reloaded.snapshot().settings.paused).toBe(false);
    expect(await engine.tick(false)).toBeNull();
    await expect(engine.startWorkflow(id)).rejects.toThrow(/Restart workflow/);
    await expect(engine.startMcpWorkflow(id)).rejects.toThrow(/Restart workflow/);
    await expect(engine.startTriggeredWorkflow(id, { id: 'event', type: 'idea-updated', at: new Date().toISOString() }, JSON.stringify(reloaded.snapshot().settings.workflow))).rejects.toThrow(/Restart workflow/);
    await expect(engine.startWorkflowFromPlan(id, { sourceRunId: 'source', sourceArtifactId: 'artifact', expectedProposalRevision: 'revision', plan: { summary: 'Plan', steps: ['Do'], acceptanceCriteria: ['Done'], risks: [], markdown: '# Plan', createdAt: new Date().toISOString() } })).rejects.toThrow(/Restart workflow/);
    await expect(engine.submit(id, 'screen')).rejects.toThrow(/Restart workflow/);
    await engine.waitUntilIdle(); expect(runner).not.toHaveBeenCalled();
    expect(reloaded.snapshot().ideas[0]?.status).toBe('inbox');
  } finally { await engine.stop(); await configured.dispose(); }
});

it('only explicit operator Restart releases the hold atomically and preserves the previous run', async () => {
  const { store, storage, configured, id } = await setup();
  const original = await configured.start(id); await configured.stop(id);
  const stopped = store.snapshot(); storage.failNextSave = true;
  await expect(configured.restart(id)).rejects.toThrow('Disk full');
  expect(store.snapshot()).toEqual(stopped);
  await expect(configured.start(id)).rejects.toThrow(/Restart workflow/);
  const fresh = await configured.restart(id);
  expect(fresh.id).not.toBe(original.id); expect(fresh.cursor).toBe(0);
  expect(fresh.attempts[0]?.stepId).toBe('first');
  expect(store.snapshot().ideas[0]?.workflowHistory?.[0]).toMatchObject({ id: original.id, state: 'stopped' });
  await configured.dispose();
});

it('failed Stop neither publishes Inbox nor cancels its queued work', async () => {
  const { store, storage, configured, id } = await setup(); await configured.start(id);
  const before = store.snapshot(); storage.failNextSave = true;
  await expect(configured.stop(id)).rejects.toThrow('Disk full');
  expect(store.snapshot()).toEqual(before);
  await configured.dispose();
});

it('keeps late host diff evidence without moving stopped cards out of Inbox or replaying work', async () => {
  const { store, configured, id } = await setup();
  await store.transaction(state => { state.settings.workflow = { ...definition([ai('build', 'codechange', 'editworktree')]), startupMode: 'play' }; });
  let input: StageInput | undefined; let finish: (() => void) | undefined;
  const runner = vi.fn(async (payload: StageInput) => { input = payload; await new Promise<void>(resolve => { finish = resolve; }); return { increment }; });
  const active = new ConfiguredWorkflowEngine(store, { runners: { demo: runner, claude: runner }, cost: async () => {}, usage: async () => {} });
  await active.start(id); const job = store.snapshot().jobs[0]!;
  const signal = new AbortController(); const running = active.run(job, signal.signal);
  await vi.waitFor(() => expect(input).toBeDefined());
  await input!.onConversation?.({ kind: 'request', instructions: 'Captured build instructions.', prompt: 'Private request context.', simulated: true });
  await active.stop(id);
  await input!.onConversation?.({ kind: 'response', text: 'Partial provider answer after Stop.' });
  expect(store.snapshot().jobs[0]?.conversation).toMatchObject({ prompt: { text: 'Private request context.' }, response: { text: 'Partial provider answer after Stop.' } });
  expect(store.snapshot().ideas[0]?.status).toBe('inbox');
  await expect(active.restart(id)).rejects.toThrow(/settle|active|Finish/);
  await input!.onChanges?.(increment);
  expect(store.snapshot().ideas[0]).toMatchObject({ status: 'inbox', increment });
  finish!(); await expect(running).rejects.toThrow(); await active.fail(job, false, new Error('Stopped result cannot advance.'));
  expect(store.snapshot().ideas[0]?.status).toBe('inbox');
  expect(store.snapshot().ideas[0]?.workflowRun?.artifacts.some(item => item.hostSnapshot && item.increment?.diff === increment.diff)).toBe(true);
  expect(store.snapshot().jobs[0]?.status).not.toBe('succeeded');
  await expect(active.restart(id)).rejects.toThrow(/Review|review/);
  const engine = new WorkflowEngine(store, { runners: { demo: runner, claude: runner }, timers: nodeTimers() });
  await engine.action(id, 'changes', 'Revise these preserved changes.');
  expect(store.snapshot().ideas[0]).toMatchObject({ status: 'inbox', workflowRun: { state: 'stopped' } });
  expect(store.snapshot().ideas[0]?.increment).toBeUndefined();
  expect(store.snapshot().workflowStopHolds).toContain(id);
  const fresh = await active.restart(id);
  expect(fresh.cursor).toBe(0);
  expect(store.snapshot().ideas[0]?.workflowHistory?.[0]?.artifacts.some(item => item.increment?.diff === increment.diff)).toBe(true);
  await input!.onChanges?.({ ...increment, diff: '+late historical capture' });
  await input!.onConversation?.({ kind: 'response', text: 'Late original transport fragment.', append: true });
  expect(store.snapshot().ideas[0]?.increment).toBeUndefined();
  expect(store.snapshot().ideas[0]?.workflowRun?.artifacts).toEqual([]);
  expect(store.snapshot().ideas[0]?.workflowHistory?.[0]?.artifacts.some(item => item.increment?.diff === '+late historical capture')).toBe(true);
  expect(store.snapshot().jobs[0]?.conversation?.response?.text).toContain('Late original transport fragment.');
  expect(store.snapshot().jobs.find(item => item.workflow?.runId === fresh.id)?.conversation).toBeUndefined();
  await engine.stop();
  await active.dispose(); await configured.dispose();
});

it('keeps unknown external outcomes gated through Stop, reload, and operator Restart', async () => {
  const { store, storage, host, configured, id } = await setup();
  await store.transaction(state => { state.settings.workflow = { ...definition([{ id: 'nudge', kind: 'nudge', name: 'Ask agent', instructions: 'Advise.', teamId: 'team', agentId: 'agent', automatic: true }]), startupMode: 'play' }; });
  const create = vi.fn(async () => { throw new Error('Unknown delivery'); });
  const active = new ConfiguredWorkflowEngine(store, { ...host, agentTasks: { create } });
  await active.start(id); await active.stop(id);
  const reloaded = new StudioStore(storage); await reloaded.init();
  const restarted = new ConfiguredWorkflowEngine(reloaded, { ...host, agentTasks: { create } });
  await expect(restarted.restart(id)).rejects.toThrow(/acknowledge/);
  expect(reloaded.snapshot().workflowStopHolds).toContain(id);
  expect(reloaded.snapshot().ideas[0]?.status).toBe('inbox');
  expect(await restarted.tick(reloaded.snapshot().activeProjectId!, false)).toBeNull();
  expect(create).toHaveBeenCalledTimes(1);
  await restarted.acknowledgeNudge(id, reloaded.snapshot().ideas[0]!.workflowRun!.revision, true);
  await expect(restarted.start(id)).rejects.toThrow(/Restart workflow/);
  expect(reloaded.snapshot().workflowStopHolds).toContain(id);
  await restarted.dispose(); await active.dispose(); await configured.dispose();
});

it('preserves the host worktree review guard for held Inbox changes', async () => {
  const { store, host, configured, id } = await setup();
  await store.transaction(state => { state.settings.workflow = definition([ai('build', 'codechange', 'editworktree')]); });
  const build = new ConfiguredWorkflowEngine(store, { ...host, runners: { demo: async () => ({ increment }), claude: host.runners.claude } });
  await build.start(id); await build.run(store.snapshot().jobs[0]!, new AbortController().signal); await build.stop(id);
  await store.transaction(state => { state.ideas[0]!.workflowRun!.workspaceId = 'managed-workspace'; state.ideas[0]!.increment!.simulated = false; });
  const guard = vi.fn(async () => { throw new Error('Workspace requires inspection'); });
  const engine = new WorkflowEngine(store, { ...host, timers: nodeTimers(), assertWorkflowReviewable: guard });
  const before = store.snapshot();
  await expect(engine.action(id, 'approve')).rejects.toThrow('Workspace requires inspection');
  expect(guard).toHaveBeenCalledTimes(1); expect(store.snapshot()).toEqual(before);
  expect(store.snapshot().ideas[0]?.status).toBe('inbox');
  await engine.stop(); await build.dispose(); await configured.dispose();
});

it('does not let settings or proposal edits release a hold or stop other cards', async () => {
  const { store, configured, id } = await setup(); await configured.start(id); await configured.stop(id);
  await store.transaction(state => {
    state.ideas[0]!.title = 'Changed request'; state.ideas[0]!.status = 'planned';
    state.settings.workflow = { ...definition([ai('replacement')]), startupMode: 'play' }; state.settings.paused = false;
    const other = createSeed().ideas.find(idea => idea.status === 'inbox' && idea.id !== id)!;
    state.ideas.push({ ...other, projectId: state.activeProjectId });
  });
  expect(store.snapshot().ideas[0]?.status).toBe('inbox');
  await expect(configured.start(id)).rejects.toThrow(/Restart workflow/);
  const job = await configured.tick(store.snapshot().activeProjectId!, false);
  expect(job?.ideaId).not.toBe(id); expect(job).not.toBeNull();
  expect(store.snapshot().workflowStopHolds).toContain(id);
  await configured.dispose();
});
