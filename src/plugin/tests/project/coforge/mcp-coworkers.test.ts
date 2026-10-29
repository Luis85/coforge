// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import { McpCoworkerTools } from '../../../infrastructure/coforge/mcp-coworker-tools';
import { record } from '../../../features/coforge/domain/check';
import { councilControlsFixture } from './council-controls-fixture';

const stops: Array<() => Promise<void>> = [];
afterEach(async () => { for (const stop of stops.splice(0)) await stop(); });
async function fixture() {
  const f = await councilControlsFixture();
  stops.push(() => f.dispose());
  const tools = new McpCoworkerTools(f.studio, f.module.actions);
  const call = (name: string, args: object = {}) => tools.call(name, { projectId: f.projectId, ...args });
  const input = { target: f.target, title: 'Review the approach', question: 'Compare the tradeoffs.', idempotencyKey: 'mcp-task' };
  return { ...f, tools, call, input };
}
it('discovers project memberships and canonical coworker definitions without dispatching', async () => {
  const f = await fixture();
  expect(await f.call('coforge_roster')).toMatchObject({ coworkers: [{ id: 'agent', role: 'Reviewer', teamIds: ['team'] }], teams: [{ id: 'team' }] });
  expect(await f.call('coforge_coworker', { coworkerId: 'agent' })).toMatchObject({ definition: { instructions: 'Inspect the captured proposal.', provider: 'demo' }, revision: expect.any(String) });
  expect(f.module.actions.snapshot().runs).toEqual([]);
  await expect(f.call('coforge_coworker', { coworkerId: 'missing' })).rejects.toThrow();
});
it('creates retryable direct-coworker tasks, preserves changed notes and never starts work on authoring', async () => {
  const f = await fixture();
  const task = record(await f.call('coforge_create_task', f.input));
  expect(await f.call('coforge_create_task', f.input)).toEqual(task);
  expect(await f.call('coforge_tasks')).toMatchObject({ tasks: [task] });
  expect(f.kit.read(String(task.path))).toContain('Compare the tradeoffs.');
  await expect(f.call('coforge_create_task', { ...f.input, question: 'Changed' })).rejects.toThrow();
  expect(f.module.actions.snapshot().runs).toHaveLength(0);
});
it('pins reviewed definitions on dispatch, deduplicates retries, reports pause and supports scoped cancellation', async () => {
  const f = await fixture();
  const agent = (await f.module.actions.catalogue.list()).valid.find(entry => entry.definition.id === 'agent')!;
  if (agent.definition.schema !== 'agent/v1') throw new Error('Missing agent');
  await f.module.actions.catalogue.save({ ...agent.definition, provider: 'claude' }, agent.revision);
  await f.studio.store.transaction(state => { state.runtime.cliAvailable = true; });
  const task = record(await f.call('coforge_create_task', f.input));
  const args = { sourceId: task.sourceId };
  const preview = record(await f.call('coforge_preflight_task', args));
  const dispatch = { ...args, expectedIdentity: preview.expectedIdentity };
  const first = record(await f.call('coforge_dispatch_task', dispatch));
  expect(first).toMatchObject({ state: 'queued', paused: true, runId: expect.any(String) });
  expect(await f.call('coforge_dispatch_task', dispatch)).toEqual(first);
  expect(f.module.actions.snapshot().runs).toHaveLength(1);
  expect(f.module.actions.snapshot().runs[0]!.invocations[0]).toMatchObject({ agentId: 'agent', instructions: expect.stringContaining('Inspect the captured proposal.') });
  const currentAgent = (await f.module.actions.catalogue.list()).valid.find(entry => entry.definition.id === 'agent')!;
  await f.module.actions.catalogue.save({ ...currentAgent.definition, name: 'Renamed after preview' }, currentAgent.revision);
  await expect(f.call('coforge_dispatch_task', dispatch)).rejects.toThrow(/changed/);
  expect(f.module.actions.snapshot().runs).toHaveLength(1);
  expect(await f.call('coforge_runs')).toMatchObject({ runs: [{ runId: first.runId }] });
  expect(await f.call('coforge_run', { runId: first.runId })).toMatchObject({ runId: first.runId, artifacts: [] });
  await expect(f.tools.call('coforge_cancel_run', { projectId: 'CFP-999', runId: first.runId })).rejects.toThrow();
  await f.call('coforge_cancel_run', { runId: first.runId });
  expect(f.module.actions.snapshot().runs[0]!.state).toBe('cancelled');
});
it('rejects stale preflight and simulation dispatch without creating a run', async () => {
  const f = await fixture();
  const task = record(await f.call('coforge_create_task', f.input));
  await expect(f.call('coforge_dispatch_task', { sourceId: task.sourceId, expectedIdentity: 'stale' })).rejects.toThrow();
  const preview = record(await f.call('coforge_preflight_task', { sourceId: task.sourceId }));
  await expect(f.call('coforge_dispatch_task', { sourceId: task.sourceId, expectedIdentity: preview.expectedIdentity })).rejects.toThrow();
  expect(f.module.actions.snapshot().runs).toEqual([]);
});
it('requires exact schemas, active authorization and known projects before accessing the catalogue', async () => {
  const f = await fixture();
  const scan = vi.spyOn(f.module.actions.catalogue, 'list');
  await expect(f.call('coforge_roster', { unexpected: true })).rejects.toThrow();
  await expect(f.tools.call('coforge_roster', { projectId: 'CFP-999' })).rejects.toThrow();
  const inactive = new McpCoworkerTools(f.studio, f.module.actions, () => { throw new Error('Inactive'); });
  await expect(inactive.call('coforge_roster', { projectId: f.projectId })).rejects.toThrow('Inactive');
  expect(scan).not.toHaveBeenCalled();
});
it('returns only published artifacts with truthful simulation evidence and rejects foreign project runs', async () => {
  vi.useFakeTimers();
  const f = await fixture();
  try {
    const run = await f.module.actions.simulate(f.target, 'Private/Proposal.md', 'CoForge/Tests/Mcp.md');
    await expect(f.call('coforge_artifact', { runId: run.id, artifactId: 'missing' })).rejects.toThrow(/published/);
    await f.module.actions.resume();
    await vi.advanceTimersByTimeAsync(1600);
    const current = f.module.actions.snapshot().runs.find(item => item.id === run.id)!;
    expect(current.state).toBe('completed');
    const artifact = current.artifacts[0]!;
    expect(await f.call('coforge_artifact', { runId: run.id, artifactId: artifact.id })).toMatchObject({ artifact: { id: artifact.id, markdown: expect.any(String), simulated: true } });
    const snapshot = f.module.actions.snapshot();
    const unpublished = vi.spyOn(f.module.actions, 'snapshot').mockReturnValue({ ...snapshot, runs: snapshot.runs.map(item => ({ ...item, attempts: item.attempts.map(attempt => ({ ...attempt, status: 'responded' })) })) });
    await expect(f.call('coforge_artifact', { runId: run.id, artifactId: artifact.id })).rejects.toThrow(/published/);
    expect(await f.call('coforge_run', { runId: run.id })).toMatchObject({ artifacts: [] });
    unpublished.mockRestore();
    const foreign = await f.studio.createProject({ projectName: 'Other project', projectBrief: 'A separate project.', projectPath: '/synthetic/other-project' });
    await expect(f.tools.call('coforge_run', { projectId: foreign.id, runId: run.id })).rejects.toThrow(/not found/);
    await expect(f.tools.call('coforge_cancel_run', { projectId: foreign.id, runId: run.id })).rejects.toThrow(/not found/);
  } finally { await f.dispose(); vi.useRealTimers(); }
});
it('paginates saved tasks and rejects cross-project destinations and malformed pagination without writes', async () => {
  const f = await fixture();
  await f.call('coforge_create_task', f.input);
  await f.call('coforge_create_task', { ...f.input, idempotencyKey: 'second' });
  expect(await f.call('coforge_tasks', { limit: 1 })).toMatchObject({ tasks: expect.any(Array), total: 2, nextOffset: 1 });
  expect(record(await f.call('coforge_tasks', { offset: 1, limit: 1 })).tasks).toHaveLength(1);
  await expect(f.call('coforge_tasks', { limit: 101 })).rejects.toThrow();
  const foreign = await f.studio.createProject({ projectName: 'Other project', projectBrief: 'A separate project.', projectPath: '/synthetic/other-project' });
  await expect(f.tools.call('coforge_create_task', { ...f.input, projectId: foreign.id, idempotencyKey: 'foreign' })).rejects.toThrow();
  const task = record(await f.call('coforge_create_task', f.input));
  await expect(f.tools.call('coforge_preflight_task', { projectId: foreign.id, sourceId: task.sourceId })).rejects.toThrow();
  expect(await f.call('coforge_tasks')).toMatchObject({ total: 2 });
});
