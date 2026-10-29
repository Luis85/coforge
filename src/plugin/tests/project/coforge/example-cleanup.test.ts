import { afterEach, expect, it } from 'vitest';
import { StudioService } from '../../../features/coforge/application/studio';
import { createSeed, sampleIncrement } from '../../../features/coforge/domain/seed';
import type { StudioHost } from '../../../features/coforge/application/ports';
import { MemoryStorage, nodeTimers } from './memory-storage';

const services: StudioService[] = [];
afterEach(async () => { await Promise.all(services.splice(0).map(service => service.stop())); });
async function setup(assertExampleCleanup?: StudioHost['assertExampleCleanup']) {
  const storage = new MemoryStorage();
  const studio = new StudioService(storage, {
    timers: nodeTimers(), runners: { demo: async () => ({}), claude: async () => ({}) },
    probeRuntime: async () => ({ cliAvailable: false, projectPath: null, allowImplementation: false }),
    ...(assertExampleCleanup ? { assertExampleCleanup } : {}),
  });
  services.push(studio); await studio.start();
  await studio.createProject({ projectName: 'Real game', projectBrief: 'Real manually authored project description.', projectPath: '/synthetic/game' });
  return { studio, storage };
}

it('removes tracked samples and local-test requests while preserving manual and Twitch requests, votes and other projects', async () => {
  const { studio, storage } = await setup();
  await studio.loadSample();
  const sampleIds = studio.state().ideas.map(idea => idea.id);
  await studio.createIdea({ title: 'Manually authored real request', description: 'Keep my real work.', category: 'Gameplay', username: 'Tester' });
  const manual = studio.state().ideas.at(-1)!;
  await studio.sendChat('Tester', '!register');
  const local = await studio.sendChat('Tester', `!request ${studio.state().activeProjectId} Synthetic local test request`);
  await studio.sendChat('Tester', `!vote ${manual.id}`);
  await studio.ingest({ username: 'LiveViewer', userId: '204', text: '!register', source: 'twitch' });
  const live = await studio.ingest({ username: 'LiveViewer', userId: '204', text: `!request ${studio.state().activeProjectId} Real live feature request`, source: 'twitch' });
  await studio.store.transaction(state => {
    for (const idea of state.ideas.filter(idea => idea.id === manual.id || idea.id === live.ideaId)) {
      idea.screening = { verdict: 'clear', reason: 'Simulated check on a real request.', signals: [], checkedAt: new Date().toISOString(), provider: 'demo' };
      idea.increment = sampleIncrement(idea.title, new Date().toISOString());
    }
  });
  const other = await studio.createProject({ projectName: 'Other game', projectBrief: 'Another manually authored game project.', projectPath: '/synthetic/other' });
  await studio.createIdea({ title: 'Other real project request', description: 'Keep the other backlog.', category: 'Gameplay', username: 'Owner' });
  const before = studio.state();
  const preview = await studio.previewExampleCleanup();
  expect(preview.automatic.map(item => item.id).sort()).toEqual([...sampleIds, local.ideaId!].sort());
  expect(preview.automatic.some(item => item.id === manual.id || item.id === live.ideaId)).toBe(false);
  const writes = storage.saves;
  await expect(studio.removeExampleContent(preview, [manual.id])).rejects.toThrow(/outside.*preview/i);
  expect(storage.saves).toBe(writes);
  expect(studio.state()).toEqual(before);
  await studio.removeExampleContent(preview);
  expect(storage.saves).toBe(writes + 1);
  expect(studio.state().ideas.map(idea => idea.id)).toEqual([manual.id, live.ideaId, before.ideas.at(-1)!.id]);
  expect(studio.state().ideas.find(idea => idea.id === manual.id)?.voters).toEqual(['simulator:tester']);
  expect(studio.state().ideas.find(idea => idea.id === manual.id)?.increment?.simulated).toBe(true);
  expect(studio.state().ideas.find(idea => idea.id === live.ideaId)?.screening?.provider).toBe('demo');
  expect(studio.state().contributors.some(person => person.id === 'simulator:tester')).toBe(true);
  expect(studio.state().chat.every(message => message.source !== 'simulator')).toBe(true);
  expect(studio.state().chat.some(message => message.source === 'twitch')).toBe(true);
  expect(studio.state().projects?.find(project => project.id === other.id)).toEqual(before.projects?.find(project => project.id === other.id));
  expect(studio.state().nextIdeaNumber).toBe(before.nextIdeaNumber);
  await studio.stop();
  const loaded = await storage.load();
  expect(loaded.notes.map(note => note.id)).toEqual(studio.state().ideas.map(idea => idea.id));
});

it('holds the native admission lease through persistence and releases on success and failure', async () => {
  let held = false;
  let releases = 0;
  const { studio, storage } = await setup(() => {
    expect(held).toBe(false); held = true;
    return () => { held = false; releases++; };
  });
  await studio.loadSample();
  let preview = await studio.previewExampleCleanup();
  storage.failNextSave = true;
  await expect(studio.removeExampleContent(preview)).rejects.toThrow('Disk full');
  expect(held).toBe(false); expect(releases).toBe(1);
  preview = await studio.previewExampleCleanup();
  const heldAtCommit: boolean[] = [];
  const stop = studio.onEvent(event => { if (event.type === 'example-content-removed') heldAtCommit.push(held); });
  await studio.removeExampleContent(preview);
  expect(heldAtCommit).toEqual([true]);
  expect(held).toBe(false); expect(releases).toBe(2); stop();
});

it('closes a purely temporary example without persistence or native effect admission', async () => {
  let admissions = 0;
  const { studio, storage } = await setup(() => { admissions++; });
  const preview = await studio.previewExampleCleanup(); const writes = storage.saves;
  expect(preview.hasPersistentChanges).toBe(false);
  await expect(studio.removeExampleContent(preview)).resolves.toMatchObject({ changed: false, requests: 0 });
  expect(storage.saves).toBe(writes); expect(admissions).toBe(0);
});

it('retains deduplication tombstones and monotonic IDs so removed local intake cannot replay', async () => {
  const { studio } = await setup();
  await studio.sendChat('Tester', '!register');
  const input = { username: 'Tester', text: `!request ${studio.state().activeProjectId} A disposable local test request`, source: 'simulator' as const, messageId: 'local-once' };
  await studio.ingest(input);
  const next = studio.state().nextIdeaNumber;
  await studio.removeExampleContent(await studio.previewExampleCleanup());
  expect(studio.state().ideas).toHaveLength(0);
  await expect(studio.ingest(input)).resolves.toMatchObject({ duplicate: true });
  expect(studio.state().ideas).toHaveLength(0);
  expect(studio.state().nextIdeaNumber).toBe(next);
});

it('preserves untracked historical requests by default and requires exact selected legacy IDs', async () => {
  const { studio } = await setup();
  const seed = createSeed();
  await studio.store.transaction(state => {
    state.ideas.push(...seed.ideas.map(idea => ({ ...idea, projectId: state.activeProjectId })));
    state.contributors.push(...seed.contributors);
    state.nextIdeaNumber = 500;
  });
  const preview = await studio.previewExampleCleanup();
  expect(preview.automatic).toHaveLength(0);
  expect(preview.legacy).toHaveLength(15);
  await studio.removeExampleContent(preview, [preview.legacy[0]!.id]);
  expect(studio.state().ideas).toHaveLength(14);
  expect(studio.state().ideas.some(idea => idea.id === preview.legacy[1]!.id)).toBe(true);
});

it('keeps committed state and preview recoverable when storage fails, then allows retry', async () => {
  const { studio, storage } = await setup(); await studio.loadSample();
  const preview = await studio.previewExampleCleanup();
  const events: string[] = [];
  const committedSizes: number[] = [];
  const stop = studio.onEvent(event => { events.push(event.type); if (event.type === 'example-content-removed') committedSizes.push(studio.state().ideas.length); });
  const before = studio.state(); storage.failNextSave = true;
  await expect(studio.removeExampleContent(preview)).rejects.toThrow('Disk full');
  expect(studio.state()).toEqual(before);
  expect(events).toEqual([]);
  await studio.removeExampleContent(preview);
  expect(studio.state().ideas).toHaveLength(0);
  expect(events).toEqual(['example-content-removed']);
  expect(committedSizes).toEqual([0]);
  stop();
});

it('rejects a stale preview without removing any new or edited content', async () => {
  const { studio, storage } = await setup(); await studio.loadSample();
  const preview = await studio.previewExampleCleanup();
  await studio.createIdea({ title: 'New real request since preview', description: 'Keep this new request.', category: 'Gameplay', username: 'Owner' });
  const before = studio.state(); const writes = storage.saves;
  await expect(studio.removeExampleContent(preview)).rejects.toThrow(/preview.*changed|changed.*preview/i);
  expect(studio.state()).toEqual(before); expect(storage.saves).toBe(writes);
});

it('requires paused automation and rejects pending jobs without attempting a write', async () => {
  const { studio, storage } = await setup(); await studio.loadSample();
  await studio.updateSettings({ paused: false });
  let preview = await studio.previewExampleCleanup(); const writes = storage.saves;
  expect(preview.blocked).toMatch(/pause/i);
  await expect(studio.removeExampleContent(preview)).rejects.toThrow(/pause/i);
  expect(storage.saves).toBe(writes);
  await studio.updateSettings({ paused: true });
  await studio.store.transaction(state => { state.jobs.push({ id: 'pending-job', ideaId: state.ideas[0]!.id, projectId: state.activeProjectId, stage: 'screen', provider: 'demo', status: 'queued', startedAt: new Date().toISOString(), logs: [] }); });
  preview = await studio.previewExampleCleanup();
  expect(preview.blocked).toMatch(/queued|pending|active/i);
  await expect(studio.removeExampleContent(preview)).rejects.toThrow(/queued|pending|active/i);
});
