// @vitest-environment happy-dom
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import { App, Plugin } from 'obsidian';
import { createTestApp } from '@test/obsidian';
import { McpModule } from '../../../infrastructure/coforge/mcp-module';
import { CouncilModule } from '../../../infrastructure/coforge/council-module';
import { InvocationGate } from '../../../features/coforge/application/invocation-gate';
import { McpStepRunner } from '../../../features/coforge/application/mcp-step-runner';
import { StudioService } from '../../../features/coforge/application/studio';
import { record } from '../../../features/coforge/domain/check';
import { createSeed } from '../../../features/coforge/domain/seed';
import { MemoryStorage, nodeTimers } from './memory-storage';

const stops: Array<() => Promise<void>> = [];
afterEach(async () => { for (const stop of stops.splice(0)) await stop(); });
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'coforge-mcp-module-'));
  const directory = join(root, 'plugin'); const project = join(root, 'game'); const userSettings = join(root, '.claude.json');
  await mkdir(project);
  const app = new App(); createTestApp({ app });
  class TestPlugin extends Plugin {}
  const plugin = new TestPlugin(app, { id: 'coforge', name: 'CoForge', version: '0.1.0', minAppVersion: '1.13.7', author: '', description: '' });
  const timers = nodeTimers();
  const studio = new StudioService(new MemoryStorage(createSeed()), { timers, runners: { demo: async () => ({}), claude: async () => ({}) },
    probeRuntime: async () => ({ cliAvailable: false, projectPath: null, allowImplementation: false }) });
  await studio.start(); await studio.updateProject({ projectPath: project });
  const council = new CouncilModule(plugin, studio, timers, new InvocationGate());
  await council.start();
  const make = () => {
    const runner = new McpStepRunner({ start: async () => {}, acknowledge: async (workspaceId, attemptId) => { acknowledged.push(`${workspaceId}:${attemptId}`); }, assertReviewable: async () => {}, acquire: async () => { throw new Error('Not used'); } }, timers);
    return new McpModule(plugin, studio, runner, { directory, vaultPath: root, userSettings, checkNode: async () => {} }, council.actions);
  };
  const acknowledged: string[] = [];
  const module = make(); await module.start();
  stops.push(async () => { await module.dispose(); await council.dispose(); await studio.stop(); await rm(root, { recursive: true, force: true }); });
  return { root, directory, project, userSettings, studio, module, make, acknowledged, projectId: studio.state().activeProjectId! };
}
it('activates both config scopes, serves the shipped stdio bridge, reloads safely and removes owned registrations', async () => {
  const f = await fixture();
  await writeFile(f.userSettings, JSON.stringify({ keep: true }));
  await f.module.activate();
  expect(f.module.status().active).toBe(true);
  const project = record(JSON.parse(await readFile(join(f.root, '.mcp.json'), 'utf8')));
  const servers = record(project.mcpServers);
  const name = Object.keys(servers)[0]!;
  const entry = record(servers[name]);
  expect(name).not.toContain(f.projectId.toLowerCase());
  await expect(readFile(join(f.project, '.mcp.json'), 'utf8')).rejects.toThrow();
  const before = await readFile(join(f.root, '.mcp.json'), 'utf8');
  await f.studio.createProject({ projectName: 'New game', projectBrief: 'A newly added project uses the existing MCP.', projectPath: join(f.root, 'new-game') });
  expect(await readFile(join(f.root, '.mcp.json'), 'utf8')).toBe(before);
  expect(JSON.stringify(entry)).not.toContain('token');
  expect(record(JSON.parse(await readFile(f.userSettings, 'utf8')))).toMatchObject({ keep: true, mcpServers: servers });
  const output = await new Promise<string>((resolve, reject) => {
    const child = execFile(process.execPath, [join(f.directory, 'coforge-mcp-bridge.cjs'), join(f.directory, 'coforge-mcp-connection.json')], { windowsHide: true, timeout: 10000 }, (error, stdout) => { if (error) reject(error); else resolve(stdout); });
    child.stdin?.end([
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'test', version: '1' } } },
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
      { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'coforge_roster', arguments: { projectId: f.projectId } } },
      { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'coforge_obsidian_status', arguments: {} } },
    ].map(value => JSON.stringify(value)).join('\n') + '\n');
  });
  const responses = output.trim().split('\n').map(line => record(JSON.parse(line)));
  expect(responses[0]).toMatchObject({ id: 1, result: { serverInfo: { name: 'coforge' } } });
  expect(responses[1]).toMatchObject({ id: 2, result: { tools: expect.arrayContaining([
    expect.objectContaining({ name: 'coforge_submit_result' }), expect.objectContaining({ name: 'coforge_roster' }), expect.objectContaining({ name: 'coforge_dispatch_task' }),
    expect.objectContaining({ name: 'coforge_obsidian_cli' }), expect.objectContaining({ name: 'coforge_obsidian_note' }),
  ]) } });
  expect(responses.find(response => response.id === 3)).toMatchObject({ result: { structuredContent: { projectId: f.projectId, coworkers: [], teams: [] } } });
  expect(responses.find(response => response.id === 4)).toMatchObject({ result: { structuredContent: { available: false } } });
  const closing = f.module.dispose();
  expect(f.module.status().active).toBe(false);
  await closing;
  const stopped = record(JSON.parse(await readFile(join(f.directory, 'coforge-mcp-connection.json'), 'utf8')));
  expect(stopped.token).toBe('');
  const reloaded = f.make();
  try {
    await reloaded.start(); expect(reloaded.status().active).toBe(true);
    await reloaded.deactivate(); expect(reloaded.status().active).toBe(false);
    expect(record(JSON.parse(await readFile(f.userSettings, 'utf8')))).toEqual({ keep: true, mcpServers: {} });
  } finally { await reloaded.dispose(); }
});
it('keeps pending activation inactive after interruption and needs no configuration rewrite for project directory changes', async () => {
  const f = await fixture(); await f.module.activate(); await f.module.dispose();
  const path = join(f.directory, 'coforge-mcp-settings.json');
  const saved: unknown = JSON.parse(await readFile(path, 'utf8'));
  record(record(saved).registration).phase = 'pending'; await writeFile(path, JSON.stringify(saved));
  const next = f.make();
  try {
    await next.start(); expect(next.status().active).toBe(false);
    await f.studio.updateProject({ projectPath: join(f.root, 'other') });
    await next.activate(); expect(next.status().active).toBe(true);
    expect(record(JSON.parse(await readFile(join(f.root, '.mcp.json'), 'utf8'))).mcpServers).toBeDefined();
  } finally { await next.dispose(); }
});
it('requires a failed external attempt and persists explicit human workspace recovery without replay', async () => {
  const f = await fixture(); await f.module.activate();
  const { workflowDefinition } = await import('../../../features/coforge/domain/configured-workflow');
  const definition = workflowDefinition(f.studio.state().settings);
  const step = definition.steps.find(step => step.kind === 'ai')!;
  if (step.kind !== 'ai') throw new Error('Expected AI step');
  await f.studio.store.transaction(state => { state.jobs.push({ id: 'interrupted', ideaId: state.ideas[0]!.id, projectId: f.projectId, stage: 'implement', status: 'failed', provider: 'mcp', startedAt: new Date().toISOString(), logs: [],
    workflow: { runId: 'run', definitionRevision: definition.revision, proposalRevision: 'proposal', attemptId: 'attempt', workspaceId: 'workspace', step, inputArtifacts: [] } }); });
  expect(f.module.status().recovery).toHaveLength(1);
  const before = f.studio.state().jobs.length;
  await f.module.recover('interrupted');
  expect(f.acknowledged).toEqual(['workspace:attempt']);
  expect(f.module.status().recovery).toEqual([]);
  expect(f.studio.state().jobs).toHaveLength(before);
});

it('blocks selected MCP cleanup beyond the bounded status list until explicit recovery is acknowledged', async () => {
  const f = await fixture();
  const { workflowDefinition } = await import('../../../features/coforge/domain/configured-workflow');
  const definition = workflowDefinition(f.studio.state().settings);
  const step = definition.steps.find(step => step.kind === 'ai')!;
  if (step.kind !== 'ai') throw new Error('Expected AI step');
  const [selected, other, untouched] = f.studio.state().ideas;
  if (!selected || !other || !untouched) throw new Error('Expected contained request fixtures');
  await f.studio.store.transaction(state => {
    for (let index = 0; index < 31; index++) state.jobs.push({
      id: `mcp-recovery-${index}`, ideaId: index === 0 ? selected.id : other.id, projectId: f.projectId,
      stage: 'screen', status: index === 0 ? 'cancelled' : 'failed', provider: 'mcp', startedAt: new Date().toISOString(), logs: [],
      workflow: { runId: `run-${index}`, definitionRevision: definition.revision, proposalRevision: 'proposal', attemptId: `attempt-${index}`, workspaceId: `workspace-${index}`, step, inputArtifacts: [] },
    });
  });
  expect(f.module.status().recovery).toHaveLength(25);
  expect(f.module.status().recovery?.some(item => item.taskId === 'mcp-recovery-0')).toBe(false);
  expect(() => f.module.assertExampleCleanup([selected.id])).toThrow(/MCP.*recover|acknowledge/i);
  expect(() => f.module.assertExampleCleanup([untouched.id])).not.toThrow();
  expect(() => f.module.assertExampleCleanup([])).not.toThrow();
  await f.module.recover('mcp-recovery-0');
  expect(f.acknowledged).toEqual(['workspace-0:attempt-0']);
  expect(() => f.module.assertExampleCleanup([selected.id])).not.toThrow();
  expect(() => f.module.assertExampleCleanup([other.id])).toThrow(/MCP.*recover|acknowledge/i);
  expect(f.studio.state().jobs).toHaveLength(31);
});

it.each(['queued', 'running'] as const)('blocks a selected %s MCP reservation before it has a workspace', async status => {
  const f = await fixture(); const selected = f.studio.state().ideas[0]!;
  await f.studio.store.transaction(state => state.jobs.push({ id: 'active-mcp', ideaId: selected.id, projectId: f.projectId, stage: 'screen', status, provider: 'mcp', startedAt: new Date().toISOString(), logs: [] }));
  expect(() => f.module.assertExampleCleanup([selected.id])).toThrow(/MCP|active|queued/i);
});

it('retains the cleanup recovery gate when workspace acknowledgement cannot be durably recorded', async () => {
  const f = await fixture();
  const { workflowDefinition } = await import('../../../features/coforge/domain/configured-workflow');
  const definition = workflowDefinition(f.studio.state().settings);
  const step = definition.steps.find(step => step.kind === 'ai')!;
  if (step.kind !== 'ai') throw new Error('Expected AI step');
  const selected = f.studio.state().ideas[0]!;
  await f.studio.store.transaction(state => state.jobs.push({ id: 'unrecorded-recovery', ideaId: selected.id, projectId: f.projectId, stage: 'screen', status: 'failed', provider: 'mcp', startedAt: new Date().toISOString(), logs: [],
    workflow: { runId: 'run', definitionRevision: definition.revision, proposalRevision: 'proposal', attemptId: 'attempt', workspaceId: 'workspace', step, inputArtifacts: [] } }));
  await mkdir(join(f.directory, 'coforge-mcp-settings.json.tmp'));
  await expect(f.module.recover('unrecorded-recovery')).rejects.toThrow();
  expect(f.acknowledged).toEqual(['workspace:attempt']);
  expect(f.module.status().recovery).toHaveLength(1);
  expect(() => f.module.assertExampleCleanup([selected.id])).toThrow(/MCP.*recover|acknowledge/i);
});
