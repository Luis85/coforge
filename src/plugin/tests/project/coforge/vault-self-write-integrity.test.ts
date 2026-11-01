import { afterEach, expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import { App, Plugin } from 'obsidian';
import { createTestApp, flushObsidian } from '@test/obsidian';
import { StudioService } from '../../../features/coforge/application/studio';
import { StudioStore } from '../../../features/coforge/application/studio-store';
import { createDemoRunner } from '../../../features/coforge/application/demo-agent';
import { nodeTimers, registerTestViewers } from './memory-storage';
import { VaultStudioStorage, splitNote } from '../../../infrastructure/coforge/vault-storage';
import type { ExternalNoteChange } from '../../../features/coforge/application/ports';
import { definition } from './configured-workflow-fixture';
import { workflowProposalRevision } from '../../../features/coforge/domain/configured-workflow-run';

const services: StudioService[] = [];
afterEach(async () => { vi.restoreAllMocks(); await Promise.all(services.splice(0).map(service => service.stop())); });
async function fixture() {
  const app = new App(); const kit = createTestApp({ app, layoutReady: true });
  class TestPlugin extends Plugin {}
  const plugin = new TestPlugin(app, { id: 'coforge', name: 'CoForge', version: '0.1.0', minAppVersion: '1.13.7', description: '', author: '' });
  const storage = new VaultStudioStorage(plugin); const timers = nodeTimers(); const runner = createDemoRunner(timers, [1, 1]);
  const studio = new StudioService(storage, { runners: { demo: runner, claude: runner }, timers, probeRuntime: async () => ({ cliAvailable: false, projectPath: null, allowImplementation: false }) });
  services.push(studio); await studio.start();
  await studio.createProject({ projectName: 'Integrity fixture', projectBrief: 'Synthetic self-write qualification.', projectPath: '/synthetic/project' });
  await studio.createIdea({ title: 'Synthetic request', description: 'Keep the canonical request.', category: 'Gameplay', username: 'Owner' });
  return { app, kit, plugin, storage, studio, id: studio.state().ideas[0]!.id };
}
const screened = (idea: ReturnType<StudioService['state']>['ideas'][number]) => {
  idea.status = 'screened'; idea.screening = { verdict: 'clear', reason: 'Synthetic review', signals: [], checkedAt: new Date().toISOString(), provider: 'demo' };
};
async function observe(f: Awaited<ReturnType<typeof fixture>>) {
  await flushObsidian(); const changes: ExternalNoteChange[] = [];
  f.storage.watch(change => { changes.push(change); }, () => { throw new Error('Invalid synthetic note'); });
  return changes;
}

it('retains a successfully written native-shaped plan across reload without classifying its own note as external', async () => {
  const f = await fixture(); const file = f.storage.file(f.id)!;
  await f.app.vault.process(file, current => current.replace('---\n', '---\nowner: "Keep quoted" # human\n') + 'Human notes stay.\r\n');
  const body = splitNote(f.kit.read(file.path)).body;
  await f.studio.store.transaction(state => {
    const idea = state.ideas[0]!; idea.status = 'planned';
    idea.plan = { summary: 'Plan  with spacing', steps: ['Implement\r\n  the change'], acceptanceCriteria: ['Works'], risks: [], markdown: '# Native plan', createdAt: new Date().toISOString() };
  });
  await flushObsidian();
  const reloaded = new StudioStore(new VaultStudioStorage(f.plugin)); await reloaded.init();
  expect(reloaded.snapshot().ideas[0]?.status).toBe('planned');
  expect(reloaded.snapshot().ideas[0]?.lastError).toBeUndefined();
  expect(splitNote(f.kit.read(file.path)).body).toBe(body); expect(f.kit.read(file.path)).toContain('owner: "Keep quoted" # human');
});

it('ignores duplicate and delayed self notifications only while the current note still equals the latest committed bytes', async () => {
  const f = await fixture(); const changes = await observe(f); const file = f.storage.file(f.id)!;
  const earlier = f.kit.read(file.path);
  await f.studio.store.transaction(state => { screened(state.ideas[0]!); }); await flushObsidian();
  const latest = f.kit.read(file.path);
  f.kit.metadataCache.trigger('changed', file, latest); f.kit.metadataCache.trigger('changed', file, latest); f.kit.metadataCache.trigger('changed', file, earlier);
  await flushObsidian(); expect(changes).toEqual([]);
  await f.app.vault.modify(file, earlier); await flushObsidian();
  expect(changes).toHaveLength(1); expect(changes[0]).toMatchObject({ kind: 'upsert', idea: { status: 'inbox' } });
});

it('does not grant echo trust to a note candidate whose process write failed', async () => {
  const f = await fixture(); const changes = await observe(f); const file = f.storage.file(f.id)!; let attempted = '';
  const failure = vi.spyOn(f.app.vault, 'process').mockImplementationOnce(async (target, update) => { attempted = update(await f.app.vault.read(target)); throw new Error('Synthetic note failure'); });
  await expect(f.studio.store.transaction(state => { screened(state.ideas[0]!); })).rejects.toThrow('Synthetic note failure'); failure.mockRestore();
  await f.app.vault.modify(file, attempted); await flushObsidian();
  expect(changes).toHaveLength(1); expect(changes[0]).toMatchObject({ kind: 'upsert', idea: { status: 'screened' } });
});

it('does not grant trust when the note succeeded but the authoritative data write failed', async () => {
  const f = await fixture(); const changes = await observe(f); const file = f.storage.file(f.id)!;
  const write = f.app.vault.adapter.write.bind(f.app.vault.adapter);
  const failure = vi.spyOn(f.app.vault.adapter, 'write').mockImplementation(async (path, bytes) => { if (path === f.storage.dataPath) throw new Error('Synthetic data failure'); await write(path, bytes); });
  await expect(f.studio.store.transaction(state => { screened(state.ideas[0]!); })).rejects.toThrow('Synthetic data failure'); failure.mockRestore();
  await flushObsidian();
  expect(f.studio.state().ideas[0]?.status).toBe('inbox');
  expect(changes).toHaveLength(1); expect(changes[0]).toMatchObject({ kind: 'upsert', idea: { status: 'screened' } });
  expect(f.kit.read(file.path)).toContain('status: screened');
});

it('defers write notifications until the commit settles and then reconciles a real concurrent external edit', async () => {
  const f = await fixture(); const changes = await observe(f); const file = f.storage.file(f.id)!; let resume: (() => void) | undefined; let waiting = false;
  const write = f.app.vault.adapter.write.bind(f.app.vault.adapter);
  const gate = vi.spyOn(f.app.vault.adapter, 'write').mockImplementation(async (path, bytes) => {
    if (path === f.storage.dataPath && !waiting) { waiting = true; await new Promise<void>(resolve => { resume = resolve; }); }
    await write(path, bytes);
  });
  const saving = f.studio.store.transaction(state => { screened(state.ideas[0]!); });
  await vi.waitFor(() => expect(waiting).toBe(true));
  await f.app.vault.modify(file, f.kit.read(file.path).replace('title: Synthetic request', 'title: External request')); await flushObsidian();
  try { expect(changes).toEqual([]); } finally { resume!(); await saving; gate.mockRestore(); } await flushObsidian();
  expect(changes).toHaveLength(1); expect(changes[0]).toMatchObject({ kind: 'upsert', idea: { title: 'External request' } });
  await f.studio.applyNoteChange(changes[0]!); expect(f.studio.state().ideas[0]?.status).toBe('inbox');
});

it('rejects an undelivered external input edit inside the actual note process rather than overwriting it', async () => {
  const f = await fixture(); const file = f.storage.file(f.id)!;
  await f.studio.store.transaction(state => { screened(state.ideas[0]!); }); await flushObsidian();
  const external = f.kit.read(file.path).replace('title: Synthetic request', 'title: External request'); await f.app.vault.modify(file, external);
  await expect(f.studio.store.transaction(state => { state.ideas[0]!.status = 'planned'; })).rejects.toThrow(/changed|outside|conflict/iu);
  expect(f.kit.read(file.path)).toBe(external); expect(f.studio.state().ideas[0]?.status).toBe('screened');
});

it('applies the same current-commit proof to atomic command writes instead of retaining old echo history', async () => {
  const f = await fixture(); await registerTestViewers(f.studio.store, [{ username: 'Alice' }]); const changes = await observe(f); const file = f.storage.file(f.id)!;
  const earlier = f.kit.read(file.path); await f.studio.sendChat('Alice', `!context ${f.id} Add a visible context`); await flushObsidian();
  const latest = f.kit.read(file.path); expect(latest).not.toBe(earlier);
  f.kit.metadataCache.trigger('changed', file, latest); f.kit.metadataCache.trigger('changed', file, latest); await flushObsidian(); expect(changes).toEqual([]);
  await f.app.vault.modify(file, earlier); await flushObsidian(); expect(changes).toHaveLength(1);
});

it('keeps current workflow progress when older self-write metadata arrives late, but stops a real external revert to that old progress', async () => {
  const f = await fixture(); const file = f.storage.file(f.id)!;
  await f.studio.store.transaction(state => {
    const idea = state.ideas[0]!; const at = new Date().toISOString();
    idea.workflowRun = { id: 'synthetic-run', ideaId: idea.id, projectId: idea.projectId!, proposalRevision: workflowProposalRevision(idea),
      definition: definition([{ id: 'review', name: 'Review', kind: 'approval', instructions: 'Review the result.' }]),
      revision: 1, cursor: 0, state: 'waiting-human', attempts: [{ id: 'manual', stepId: 'review', stepName: 'Review', kind: 'approval', status: 'waiting-human', inputs: [], startedAt: at }],
      activeAttemptId: 'manual', artifacts: [], createdAt: at, updatedAt: at };
  }); await flushObsidian();
  const earlier = f.kit.read(file.path);
  await f.studio.store.transaction(state => { state.ideas[0]!.workflowRun!.revision++; }); await flushObsidian();
  const pending: Promise<void>[] = []; f.storage.watch(change => { pending.push(f.studio.applyNoteChange(change)); }, () => { throw new Error('Invalid synthetic workflow'); });
  f.kit.metadataCache.trigger('changed', file, earlier); await flushObsidian(); await Promise.all(pending.splice(0));
  expect(f.studio.state().ideas[0]?.workflowRun).toMatchObject({ state: 'waiting-human', revision: 2 });
  expect(f.studio.state().ideas[0]?.lastError).toBeUndefined();
  await f.app.vault.modify(file, earlier); await flushObsidian(); await Promise.all(pending.splice(0)); await flushObsidian();
  expect(f.studio.state().ideas[0]?.workflowRun?.state).toBe('stopped');
  expect(f.studio.state().ideas[0]?.lastError).toContain('changed outside CoForge');
});

it('preserves a second outside edit when a stale first observation is being quarantined', async () => {
  const f = await fixture(); const changes = await observe(f); const file = f.storage.file(f.id)!;
  await f.studio.store.transaction(state => { screened(state.ideas[0]!); }); await flushObsidian();
  await f.app.vault.modify(file, f.kit.read(file.path).replace('title: Synthetic request', 'title: First external request')); await flushObsidian();
  const first = changes[0]!; const second = f.kit.read(file.path).replace('title: First external request', 'title: Second external request');
  await f.app.vault.modify(file, second);
  await expect(f.studio.applyNoteChange(first)).rejects.toThrow('changed outside this save');
  expect(f.kit.read(file.path)).toBe(second); expect(f.studio.state().ideas[0]?.title).toBe('Synthetic request');
});

it('does not carry obsolete self-write receipts into a reloaded canonical storage session', async () => {
  const f = await fixture(); const file = f.storage.file(f.id)!; const earlier = f.kit.read(file.path);
  await f.app.vault.modify(file, earlier.replace('title: Synthetic request', 'title: Reloaded request')); await flushObsidian();
  const reloaded = new StudioStore(f.storage); await reloaded.init();
  expect(reloaded.snapshot().ideas[0]?.title).toBe('Reloaded request');
  const changes: ExternalNoteChange[] = []; f.storage.watch(change => { changes.push(change); }, () => { throw new Error('Invalid synthetic note'); });
  await f.app.vault.modify(file, earlier); await flushObsidian();
  expect(changes).toHaveLength(1); expect(changes[0]).toMatchObject({ kind: 'upsert', idea: { title: 'Synthetic request' } });
});
