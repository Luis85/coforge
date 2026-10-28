// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import { App, Plugin } from 'obsidian';
import { createTestApp } from '@test/obsidian';
import { CouncilModule } from '../../../infrastructure/coforge/council-module';
import { InvocationGate } from '../../../features/coforge/application/invocation-gate';
import { StudioService } from '../../../features/coforge/application/studio';
import { taskSchedulerHost } from '../../../infrastructure/coforge/task-scheduler-host';
import { TaskSchedulerStateStorage } from '../../../infrastructure/coforge/task-scheduler-storage';
import { decodeCouncilPlan } from '../../../features/coforge/application/council-execution';
import { defaultCouncilDefinition } from '../../../features/coforge/domain/council-definitions';
import { emptyTaskScheduler, scheduledOccurrencePath, type TaskDraft, type TaskOccurrence } from '../../../features/coforge/domain/scheduled-task';
import { createSeed } from '../../../features/coforge/domain/seed';
import { MemoryStorage, nodeTimers } from './memory-storage';

it('routes agent, assigned-team-member and council tasks through real paused Council admission without changing context notes', async () => {
  const original = '---\ncustom: keep\n---\n# Architecture\nPreserve this exact note.\n';
  const app = new App(); const kit = createTestApp({ app, layoutReady: true, files: { 'Private/Context.md': original } });
  class TestPlugin extends Plugin {}
  const plugin = new TestPlugin(app, { id: 'coforge', name: 'CoForge', version: '0.1.0', minAppVersion: '1.13.7', author: '', description: '' });
  const timers = nodeTimers(); const gate = new InvocationGate();
  const studio = new StudioService(new MemoryStorage(createSeed()), { timers, runners: { demo: async () => ({}), claude: async () => ({}) }, probeRuntime: async () => ({ cliAvailable: true, projectPath: null, allowImplementation: false }) });
  await studio.start(); await studio.store.updateRuntime({ cliAvailable: true });
  const module = new CouncilModule(plugin, studio, timers, gate);
  await module.start(); await module.actions.designateExecutor();
  try {
    const projectId = studio.state().activeProjectId!;
    const setup = await module.actions.catalogue.setup(projectId);
    for (const id of ['architect', 'reviewer']) await module.actions.catalogue.save({ schema: 'agent/v1', id, name: id, enabled: true, role: id, instructions: 'Review the supplied note.', provider: 'claude', model: 'sonnet', contextSources: [], requestedCapabilities: { project: 'none', messaging: false } });
    const teamEntry = setup.valid.find(entry => entry.definition.schema === 'team/v1')!;
    if (teamEntry.definition.schema !== 'team/v1') throw new Error('Expected team');
    const team = { ...teamEntry.definition, members: ['architect', 'reviewer'] };
    await module.actions.catalogue.save(team, teamEntry.revision);
    await module.actions.catalogue.save(defaultCouncilDefinition('scheduled-council', 'Scheduled Council', team, team.members));
    const catalogue = await module.actions.catalogue.list();
    const council = catalogue.valid.find(entry => entry.definition.schema === 'council/v1')!.definition;
    if (team.schema !== 'team/v1' || council.schema !== 'council/v1') throw new Error('Expected team and council');
    const agentId = team.members[0]!;
    const host = taskSchedulerHost(plugin, studio, module.actions);
    const task: TaskDraft = { title: 'Review architecture', projectId, prompt: 'Review the attached architecture.', contextPaths: ['Private/Context.md'], destination: { kind: 'team', id: team.id, teamId: team.id, assigneeId: agentId }, timing: { kind: 'once', at: new Date(Date.now() + 60000).toISOString() }, enabled: true };
    expect(host.readiness(projectId).ready).toBe(false);
    for (const [index, destination] of [task.destination, { kind: 'agent' as const, id: agentId, teamId: team.id }, { kind: 'council' as const, id: council.id, teamId: team.id }].entries()) {
      const occurrence: TaskOccurrence = { id: `occurrence-${index}`, taskId: 'schedule-one', taskRevision: 1, dueAt: Date.now(), createdAt: Date.now(), status: 'reserved', message: 'Reserved', snapshot: { ...task, destination } };
      const receipt = await host.dispatch({ ...task, destination }, occurrence, new AbortController().signal);
      const run = module.actions.snapshot().runs.find(run => run.id === receipt.runId)!;
      const plan = decodeCouncilPlan(run);
      expect(run.projectId).toBe(projectId);
      expect(plan.targetKind).toBe(destination.kind === 'council' ? 'council' : 'agent');
      if (destination.kind !== 'council') expect(plan.invocations.map(item => item.agent.id)).toEqual([agentId]);
      expect(kit.read(receipt.sourcePath)).toContain(original);
      expect(receipt.sourcePath).toBe(scheduledOccurrencePath(occurrence.id));
    }
    expect(kit.read('Private/Context.md')).toBe(original);
    expect(await plugin.app.vault.adapter.read('CoForge/Scheduled Tasks/.gitignore')).toContain('*');
    await expect(host.validate({ ...task, destination: { ...task.destination, assigneeId: 'outsider' } })).rejects.toThrow();
    await expect(host.validate({ ...task, contextPaths: ['CoForge/Public/Context.md'] })).rejects.toThrow();
    expect(kit.errors).toEqual([]);
  } finally { await module.dispose(); gate.dispose(); await studio.stop(); }
});

it('preserves externally edited scheduler state instead of overwriting it', async () => {
  const app = new App(); createTestApp({ app, files: { '.obsidian/plugins/coforge/.gitignore': 'coforge-*.json*\n' } });
  class TestPlugin extends Plugin {}
  const plugin = new TestPlugin(app, { id: 'coforge', name: 'CoForge', version: '0.1.0', minAppVersion: '1.13.7', author: '', description: '' });
  const storage = new TaskSchedulerStateStorage(plugin); const state = await storage.load(); await storage.save(state);
  const path = '.obsidian/plugins/coforge/coforge-task-scheduler.json';
  const changed = JSON.stringify({ ...emptyTaskScheduler(), revision: 42 }); await app.vault.adapter.write(path, changed);
  await expect(storage.save({ ...state, revision: 1 })).rejects.toThrow('changed');
  expect(await app.vault.adapter.read(path)).toBe(changed);
});
