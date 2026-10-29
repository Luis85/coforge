import { afterEach, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
vi.mock('obsidian', () => import('@test/obsidian'));
import { App, Plugin } from 'obsidian';
import { createTestApp, flushObsidian } from '@test/obsidian';
import { StudioService } from '../../../features/coforge/application/studio';
import { VaultStudioStorage } from '../../../infrastructure/coforge/vault-storage';
import { nodeTimers } from './memory-storage';

const services: StudioService[] = [];
afterEach(async () => { await Promise.all(services.splice(0).map(service => service.stop())); });
async function fixture() {
  const app = new App();
  const kit = createTestApp({ app, layoutReady: true, files: { 'Welcome.md': '# Personal note\r\nKeep exact bytes.\r\n' } });
  class TestPlugin extends Plugin {}
  const plugin = new TestPlugin(app, { id: 'coforge', name: 'CoForge', version: '0.1.0', minAppVersion: '1.13.7', description: '', author: '' });
  const storage = new VaultStudioStorage(plugin);
  const studio = new StudioService(storage, { runners: { demo: async () => ({}), claude: async () => ({}) }, timers: nodeTimers(), probeRuntime: async () => ({ cliAvailable: false, projectPath: null, allowImplementation: false }) });
  services.push(studio);
  await studio.start();
  await studio.loadSample();
  const first = studio.state().ideas[0]!;
  const second = studio.state().ideas[1]!;
  const target = storage.file(first.id)!;
  await app.vault.process(target, text => text + '\r\nUnrelated annotations stay recoverable.\r\n');
  await app.fileManager.processFrontMatter(target, properties => { properties.custom = 'keep me'; });
  await flushObsidian();
  return { studio, storage, kit, app, plugin, first, second, target };
}

it('removes only reviewed exact IDs, preserves unrelated notes and suppresses its own watcher removals', async () => {
  const env = await fixture();
  const before = env.kit.read(env.target.path);
  const retainedPath = env.storage.file(env.second.id)!.path;
  const retained = env.kit.read(retainedPath);
  const watch = vi.fn();
  env.storage.watch(watch, () => undefined);
  const notes = await env.studio.store.previewExampleNotes([env.first.id]);
  await env.studio.store.transaction(state => { state.ideas = state.ideas.filter(idea => idea.id !== env.first.id); }, { exampleCleanup: { notes } });
  await flushObsidian();
  expect(env.storage.file(env.first.id)).toBeNull();
  expect(env.kit.read(retainedPath)).toBe(retained);
  expect(env.kit.read('Welcome.md')).toBe('# Personal note\r\nKeep exact bytes.\r\n');
  expect(env.kit.app.vault.trashed.some(entry => entry.data === before)).toBe(true);
  expect(watch).not.toHaveBeenCalled();
  expect(env.studio.state().ideas.some(idea => idea.id === env.first.id)).toBe(false);
});

it('rejects a human body edit after preview without removing either note or committing data', async () => {
  const env = await fixture();
  const notes = await env.studio.store.previewExampleNotes([env.first.id]);
  const data = env.kit.read(env.storage.dataPath);
  await env.app.vault.process(env.target, text => text + 'A newer human edit.\r\n');
  const latest = env.kit.read(env.target.path);
  await expect(env.studio.store.transaction(state => { state.ideas = state.ideas.filter(idea => idea.id !== env.first.id); }, { exampleCleanup: { notes } })).rejects.toThrow('stale');
  expect(env.kit.read(env.target.path)).toBe(latest);
  expect(env.kit.read(env.storage.dataPath)).toBe(data);
  expect(env.studio.state().ideas.some(idea => idea.id === env.first.id)).toBe(true);
});

it('rolls back staged files and exact plugin data when the final write fails', async () => {
  const env = await fixture();
  const path = env.target.path;
  const before = env.kit.read(path);
  const data = env.kit.read(env.storage.dataPath);
  const notes = await env.studio.store.previewExampleNotes([env.first.id, env.second.id]);
  const original = env.app.vault.adapter.write.bind(env.app.vault.adapter);
  let failed = false;
  vi.spyOn(env.app.vault.adapter, 'write').mockImplementation(async (target, content, options) => {
    if (target === env.storage.dataPath && !failed) { failed = true; throw new Error('Disk full'); }
    return original(target, content, options);
  });
  await expect(env.studio.store.transaction(state => { state.ideas = state.ideas.filter(idea => ![env.first.id, env.second.id].includes(idea.id)); }, { exampleCleanup: { notes } })).rejects.toThrow('Disk full');
  await flushObsidian();
  expect(env.kit.read(path)).toBe(before);
  expect(env.kit.read(env.storage.dataPath)).toBe(data);
  expect(env.storage.file(env.first.id)?.path).toBe(path);
  expect(env.storage.file(env.second.id)).not.toBeNull();
  expect(env.kit.app.vault.trashed).toHaveLength(0);
});

it('commits removal and reports retained private recovery bytes when trash fails', async () => {
  const env = await fixture();
  const before = env.kit.read(env.target.path);
  const notes = await env.studio.store.previewExampleNotes([env.first.id]);
  vi.spyOn(env.app.fileManager, 'trashFile').mockRejectedValue(new Error('Trash unavailable'));
  await env.studio.store.transaction(state => { state.ideas = state.ideas.filter(idea => idea.id !== env.first.id); }, { exampleCleanup: { notes } });
  expect(env.studio.state().ideas.some(idea => idea.id === env.first.id)).toBe(false);
  expect(env.storage.file(env.first.id)).toBeNull();
  expect(env.studio.store.exampleCleanupWarning()).toContain('Cleanup committed');
  const retained = env.app.vault.getFiles().find(file => file.path.endsWith('.coforge-archive'));
  expect(retained).toBeDefined();
  expect(env.kit.read(retained!.path)).toBe(before);
  expect(env.app.vault.getMarkdownFiles().some(file => file.path.includes('ExampleCleanup'))).toBe(false);
});

async function interrupted(env: Awaited<ReturnType<typeof fixture>>, committed: boolean) {
  const directory = 'CoForge/Recovery/ExampleCleanup/00000000-0000-4000-8000-000000000001';
  await env.app.vault.createFolder(directory);
  const original = env.target.path;
  const content = env.kit.read(original);
  const beforeData = env.kit.read(env.storage.dataPath);
  const afterData = JSON.stringify({ ...JSON.parse(beforeData), nextIdeaNumber: 999 });
  const hash = (text: string) => createHash('sha256').update(text).digest('hex');
  const staged = `${directory}/0.coforge-archive`;
  await env.app.vault.adapter.write(env.storage.dataPath.replace('coforge-state.json', 'coforge-example-cleanup.json'), JSON.stringify({
    schema: 1, directory, beforeData, afterHash: hash(afterData), notes: [{ id: env.first.id, original, staged, fingerprint: hash(content) }],
  }));
  await env.app.vault.rename(env.target, staged);
  if (committed) await env.app.vault.adapter.write(env.storage.dataPath, afterData);
  return { original, content };
}

it('recovers interrupted preparation before loading canonical notes, preserving exact body bytes', async () => {
  const env = await fixture();
  const { original, content } = await interrupted(env, false);
  const loaded = await new VaultStudioStorage(env.plugin).load();
  expect(loaded.notes.some(note => note.id === env.first.id)).toBe(true);
  expect(env.kit.read(original)).toBe(content);
  expect(env.kit.app.vault.trashed).toHaveLength(0);
});

it('finishes an interrupted committed cleanup without resurrecting removed requests', async () => {
  const env = await fixture();
  const { original, content } = await interrupted(env, true);
  const loaded = await new VaultStudioStorage(env.plugin).load();
  expect(loaded.notes.some(note => note.id === env.first.id)).toBe(false);
  expect(env.app.vault.getFileByPath(original)).toBeNull();
  expect(env.kit.app.vault.trashed.some(entry => entry.data === content)).toBe(true);
});

it('keeps a committed recovery marker valid after later ordinary saves when receipts cannot be finalized', async () => {
  const env = await fixture();
  const notes = await env.studio.store.previewExampleNotes([env.first.id]);
  vi.spyOn(env.app.fileManager, 'trashFile').mockRejectedValue(new Error('Trash unavailable'));
  const originalWrite = env.app.vault.adapter.write.bind(env.app.vault.adapter);
  vi.spyOn(env.app.vault.adapter, 'write').mockImplementation(async (path, content, options) => {
    if (path.endsWith('/receipt.json')) throw new Error('Receipt unavailable');
    return originalWrite(path, content, options);
  });
  await env.studio.store.transaction(state => { state.ideas = state.ideas.filter(idea => idea.id !== env.first.id); }, { exampleCleanup: { notes } });
  await env.studio.store.transaction(state => { state.nextIdeaNumber += 1; });
  const loaded = await new VaultStudioStorage(env.plugin).load();
  expect(loaded.notes.some(note => note.id === env.first.id)).toBe(false);
  expect(env.studio.store.exampleCleanupWarning()).toContain('Cleanup committed');
});

it('rejects a duplicate request identity created after the preview', async () => {
  const env = await fixture();
  const notes = await env.studio.store.previewExampleNotes([env.first.id]);
  await env.app.vault.create('CoForge/Ideas/Duplicate.md', env.kit.read(env.target.path));
  await expect(env.studio.store.transaction(state => { state.ideas = state.ideas.filter(idea => idea.id !== env.first.id); }, { exampleCleanup: { notes } })).rejects.toThrow('Two notes');
  expect(env.storage.file(env.first.id)).not.toBeNull();
  expect(env.kit.app.vault.trashed).toHaveLength(0);
});

it('holds later writes when both the data result and its rollback are unconfirmed', async () => {
  const env = await fixture();
  const notes = await env.studio.store.previewExampleNotes([env.first.id]);
  const write = env.app.vault.adapter.write.bind(env.app.vault.adapter);
  const broken = vi.spyOn(env.app.vault.adapter, 'write').mockImplementation(async (path, content, options) => {
    if (path === env.storage.dataPath) { await write(path, content, options); throw new Error('Write outcome unknown'); }
    return write(path, content, options);
  });
  await expect(env.studio.store.transaction(state => { state.ideas = state.ideas.filter(idea => idea.id !== env.first.id); }, { exampleCleanup: { notes } })).rejects.toThrow('Reload');
  await expect(env.studio.store.transaction(state => { state.nextIdeaNumber += 1; })).rejects.toThrow('Reload');
  expect(env.studio.state().ideas.some(idea => idea.id === env.first.id)).toBe(true);
  broken.mockRestore();
  const recovered = await new VaultStudioStorage(env.plugin).load();
  expect(recovered.notes.some(idea => idea.id === env.first.id)).toBe(true);
});
