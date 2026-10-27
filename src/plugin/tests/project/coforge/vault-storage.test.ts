import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import { App, Plugin } from 'obsidian';
import { createTestApp, flushObsidian, type TestApp } from '@test/obsidian';
import { createDemoRunner } from '../../../features/coforge/application/demo-agent';
import { StudioService } from '../../../features/coforge/application/studio';
import { nodeTimers, registerTestViewers } from './memory-storage';
import { VaultStudioStorage, readIdeaNote, splitNote } from '../../../infrastructure/coforge/vault-storage';

class TestPlugin extends Plugin {}
const manifest = { id: 'coforge', name: 'CoForge', version: '0.1.0', minAppVersion: '1.13.7', description: '', author: '' };
const services: StudioService[] = [];
afterEach(async () => { await Promise.all(services.splice(0).map(service => service.stop())); });

async function open(existing?: { kit: TestApp; app: App }, files: Record<string, string> = {}) {
  const app = existing?.app ?? new App();
  const testKit = existing?.kit ?? createTestApp({ app, files, layoutReady: true });
  const plugin = new TestPlugin(app, manifest);
  const storage = new VaultStudioStorage(plugin);
  const timers = nodeTimers();
  const runner = createDemoRunner(timers, [1, 1]);
  const studio = new StudioService(storage, { runners: { demo: runner, claude: runner }, timers, probeRuntime: () => Promise.resolve({ cliAvailable: false, projectPath: null, allowImplementation: false }) });
  services.push(studio);
  await studio.start();
  await registerTestViewers(studio.store, [{ username: 'River' }, { username: 'Alice' }]);
  if (!studio.state().projects?.length) await studio.createProject({ projectName: 'Community game', projectBrief: 'Fixture community game project.', projectPath: '/synthetic/game' });
  storage.watch(change => { void studio.applyNoteChange(change); }, () => undefined);
  return { kit: testKit, app, plugin, storage, studio };
}
const ideaNotes = (kit: TestApp) => kit.app.vault.getMarkdownFiles().filter(file => file.path.startsWith('CoForge/Ideas/'));

describe('idea notes in the vault', () => {
  it('appends viewer context once while keeping original request/body bytes and unrelated properties', async () => {
    const { kit, app, studio } = await open();
    await studio.sendChat('River', '!request CFP-001 Add a garden behind the camp');
    const file = ideaNotes(kit)[0]!;
    await kit.app.vault.process(file, value => value + 'My storyboard stays here.\r\n');
    await kit.app.fileManager.processFrontMatter(file, properties => { properties.custom = 'keep'; });
    await flushObsidian();
    const before = splitNote(kit.read(file.path)).body;
    await studio.sendChat('Alice', '!context CF-101 Add **controller** support');
    await flushObsidian();
    const after = splitNote(kit.read(file.path)).body;
    expect(after.startsWith(before)).toBe(true); expect(after).toContain('Context from Alice');
    expect(readIdeaNote(kit.read(file.path))?.contexts).toMatchObject([{ authorName: 'Alice', text: 'Add **controller** support' }]);
    await studio.vote('CF-101'); await flushObsidian();
    expect(kit.read(file.path).match(/<!-- coforge-context:/g)).toHaveLength(1);
    expect(kit.read(file.path)).toContain('custom: keep');
    await studio.stop(); const restarted = await open({ app, kit });
    expect(restarted.studio.state().ideas[0]?.contexts).toHaveLength(1);
    expect(splitNote(kit.read(file.path)).body.startsWith(before)).toBe(true);
  });
  it('starts empty and writes nothing to the vault until an idea exists', async () => {
    const { kit, studio } = await open(undefined, { 'Welcome.md': '# Hello\n' });
    expect(studio.state().ideas).toEqual([]);
    expect(ideaNotes(kit)).toHaveLength(0);
    expect(kit.read('Welcome.md')).toBe('# Hello\n');
  });

  it('creates one note per idea and keeps votes and increments in plugin data', async () => {
    const { kit, studio } = await open();
    await studio.sendChat('River', '!request CFP-001 Add a garden behind the camp');
    await studio.sendChat('Alice', '!vote CF-101');
    const [file] = ideaNotes(kit);
    expect(file?.path).toBe('CoForge/Ideas/CF-101 Add a garden behind the camp.md');
    const note = kit.read(file!.path);
    const parsed = readIdeaNote(note);
    expect(parsed).toMatchObject({ id: 'CF-101', title: 'Add a garden behind the camp', status: 'inbox', authorId: 'simulator:river', description: 'Add a garden behind the camp' });
    expect(splitNote(note).yaml).toContain('votes: 1');
    const data = JSON.parse(kit.read('.obsidian/plugins/coforge/coforge-state.json')) as { votes: Record<string, string[]> };
    expect(data.votes['CF-101']).toEqual(['simulator:alice']);
  });

  it('restores ideas with their votes after a restart and keeps the body and unrelated properties', async () => {
    const first = await open();
    await first.studio.sendChat('River', '!request CFP-001 Add a garden behind the camp');
    await first.studio.vote('CF-101');
    const [file] = ideaNotes(first.kit);
    await first.kit.app.vault.process(file!, data => data.replace('## Notes\n\n', '## Notes\n\nPlaytest on Friday.\n'));
    await first.kit.app.fileManager.processFrontMatter(file!, frontmatter => { frontmatter.tags = ['garden']; });
    await first.studio.act('CF-101', 'screen');
    await first.studio.engine.waitUntilIdle();
    await first.studio.stop();
    const second = await open(first);
    const restored = second.studio.state().ideas[0];
    expect(restored).toMatchObject({ id: 'CF-101', status: 'screened', voters: ['simulator:streamer'] });
    const note = second.kit.read(file!.path);
    expect(note).toContain('Playtest on Friday.');
    expect(note).toContain('garden');
    expect(splitNote(note).yaml).toContain('screening: clear');
  });

  it('applies edits and deletions made directly in the vault', async () => {
    const { kit, studio } = await open();
    await studio.sendChat('River', '!request CFP-001 Add a garden behind the camp');
    const [file] = ideaNotes(kit);
    await kit.app.fileManager.processFrontMatter(file!, frontmatter => { frontmatter.category = 'World'; });
    await flushObsidian();
    await vi.waitFor(() => expect(studio.state().ideas[0]?.category).toBe('World'));
    await kit.app.vault.delete(file!);
    await flushObsidian();
    await vi.waitFor(() => expect(studio.state().ideas).toHaveLength(0));
  });

  it('loads the sample workspace as notes and moves replaced notes to the trash', async () => {
    const { kit, studio } = await open();
    await studio.sendChat('River', '!request CFP-001 Add a garden behind the camp');
    await studio.loadSample();
    expect(studio.state().ideas).toHaveLength(15);
    expect(ideaNotes(kit)).toHaveLength(15);
    expect(kit.app.vault.trashed.map(record => record.path)).toEqual(['CoForge/Ideas/CF-101 Add a garden behind the camp.md']);
  });

  it('moves idea notes when the ideas folder changes', async () => {
    const { kit, studio } = await open();
    await studio.sendChat('River', '!request CFP-001 Add a garden behind the camp');
    await studio.updateIntegration({ ideasFolder: 'Games/Mosslight/Ideas' });
    expect(kit.app.vault.getMarkdownFiles().map(file => file.path)).toEqual([
      'CoForge/Projects/CFP-001 Community game.md', 'Games/Mosslight/Ideas/CF-101 Add a garden behind the camp.md',
    ]);
    expect(studio.state().ideas).toHaveLength(1);
  });
});
