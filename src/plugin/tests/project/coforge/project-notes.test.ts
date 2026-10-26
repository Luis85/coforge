import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import { App, Plugin } from 'obsidian';
import { createTestApp, flushObsidian, type TestApp } from '@test/obsidian';
import { StudioService } from '../../../features/coforge/application/studio';
import { createDemoRunner } from '../../../features/coforge/application/demo-agent';
import { VaultStudioStorage, readIdeaNote, splitNote } from '../../../infrastructure/coforge/vault-storage';
import { nodeTimers } from './memory-storage';
import { ideaFingerprint } from '../../../features/coforge/domain/integrity';
import { parsePersistedStudio } from '../../../features/coforge/domain/persisted';

class TestPlugin extends Plugin {}
const manifest = { id: 'coforge', name: 'CoForge', version: '0.1.0', minAppVersion: '1.13.7', description: '', author: '' };
const services: StudioService[] = [];
afterEach(async () => { await Promise.all(services.splice(0).map(service => service.stop())); });
async function open(existing?: { kit: TestApp; app: App }) {
  const app = existing?.app ?? new App();
  const kit = existing?.kit ?? createTestApp({ app, layoutReady: true });
  const plugin = new TestPlugin(app, manifest);
  const storage = new VaultStudioStorage(plugin);
  const timers = nodeTimers();
  const runner = createDemoRunner(timers, [1, 1]);
  const studio = new StudioService(storage, { runners: { demo: runner, claude: runner }, timers,
    probeRuntime: () => Promise.resolve({ cliAvailable: false, projectPath: null, allowImplementation: false }) });
  services.push(studio);
  await studio.start();
  storage.watchProjects(change => { void studio.applyProjectNoteChange(change); }, () => undefined);
  return { app, kit, studio, storage };
}

describe('canonical project notes', () => {
  it('stores project paths outside the vault in frontmatter and preserves user body bytes and unrelated properties', async () => {
    const { app, kit, studio } = await open();
    const project = await studio.createProject({ projectName: 'Moon orchard', projectBrief: 'An orchard on a distant moon.', projectPath: 'D:/Games/moon',
      repositoryUrl: 'https://github.com/example/moon', websiteUrl: 'https://moon.example' });
    const file = app.vault.getMarkdownFiles().find(note => note.path.startsWith('CoForge/Projects/') && kit.read(note.path).includes(project.id));
    expect(file).toBeDefined();
    expect(kit.read(file!.path)).toContain('D:/Games/moon');
    expect(kit.read(file!.path)).toContain('repository-url: https://github.com/example/moon');
    expect(kit.read(file!.path)).toContain('website-url: https://moon.example');
    expect(kit.read(file!.path)).toContain('description: An orchard on a distant moon.');
    await app.fileManager.processFrontMatter(file!, properties => { properties.tags = ['game']; });
    await app.vault.process(file!, text => text + 'Keep this hand-written paragraph.\r\n[[Design]]\n');
    await flushObsidian();
    const body = splitNote(kit.read(file!.path)).body;
    await studio.updateProject({ projectName: 'Moon orchard II', projectPath: 'E:/Games/moon' });
    expect(splitNote(kit.read(file!.path)).body).toBe(body);
    expect(splitNote(kit.read(file!.path)).yaml).toContain('game');
    expect(splitNote(kit.read(file!.path)).yaml).toContain(project.id);
    expect(splitNote(kit.read(file!.path)).yaml).toContain('E:/Games/moon');
  });

  it('does not leave an orphan project note or change selection if the data-file commit fails', async () => {
    const { app, studio } = await open();
    const before = studio.state();
    const write = vi.spyOn(app.vault.adapter, 'write').mockRejectedValueOnce(new Error('Disk full'));
    try {
      await expect(studio.createProject({ projectName: 'Moon orchard', projectBrief: 'An orchard on a distant moon.', projectPath: '/games/moon' })).rejects.toThrow('Disk full');
      expect(studio.state()).toEqual(before);
      expect(app.vault.getMarkdownFiles().filter(file => file.path.startsWith('CoForge/Projects/'))).toHaveLength(1);
    } finally { write.mockRestore(); }
  });

  it('reads project edits from notes after restart instead of trusting cached plugin settings', async () => {
    const first = await open();
    const project = await first.studio.createProject({ projectName: 'Moon orchard', projectBrief: 'An orchard on a distant moon.', projectPath: '/games/moon' });
    await first.studio.stop();
    const note = first.app.vault.getMarkdownFiles().find(file => first.kit.read(file.path).includes(project.id));
    await first.app.fileManager.processFrontMatter(note!, properties => { properties.name = 'Edited in Obsidian'; properties['project-path'] = '/games/edited'; });
    const second = await open(first);
    expect(second.studio.state().settings.projectName).toBe('Edited in Obsidian');
    expect(second.studio.integration().projectPath).toBe('/games/edited');
    expect(second.studio.state().projects).toHaveLength(2);
  });

  it('keeps other projects and their notes when loading a sample into the selected project', async () => {
    const { app, kit, studio } = await open();
    await studio.sendChat('River', '!request CFP-001 Preserve the original request');
    const initial = studio.state().activeProjectId!;
    const original = app.vault.getMarkdownFiles().find(file => file.path.startsWith('CoForge/Ideas/'))!;
    const body = splitNote(kit.read(original.path)).body;
    await studio.createProject({ projectName: 'Moon orchard', projectBrief: 'An orchard on a distant moon.', projectPath: '/games/moon' });
    await studio.loadSample();
    expect(studio.state().projects).toHaveLength(2);
    expect(splitNote(kit.read(original.path)).body).toBe(body);
    await studio.selectProject(initial);
    expect(studio.state().ideas.filter(idea => idea.projectId === initial).map(idea => idea.title)).toEqual(['Preserve the original request']);
  });

  it('migrates legacy requests without changing their IDs, votes, screened status, custom project property or Markdown body', async () => {
    const first = await open();
    await first.studio.sendChat('River', '!request CFP-001 Preserve the original request');
    await first.studio.vote('CF-101');
    await first.studio.act('CF-101', 'screen');
    await first.studio.engine.waitUntilIdle();
    const ideaFile = first.app.vault.getMarkdownFiles().find(file => file.path.startsWith('CoForge/Ideas/'))!;
    const legacyNote = first.kit.read(ideaFile.path).replace(/^coforge-project:.*\r?\n/m, '').replace('---\n', '---\nproject: "[[My studio note]]"\n');
    const dataPath = '.obsidian/plugins/coforge/coforge-state.json';
    const legacyData = parsePersistedStudio(JSON.parse(first.kit.read(dataPath)));
    delete legacyData.activeProjectId; delete legacyData.nextProjectNumber;
    legacyData.integrity['CF-101'] = ideaFingerprint(readIdeaNote(legacyNote)!);
    const app = new App();
    const kit = createTestApp({ app, layoutReady: true, files: { [ideaFile.path]: legacyNote, [dataPath]: JSON.stringify(legacyData) } });
    const migrated = await open({ app, kit });
    expect(migrated.studio.state().ideas[0]).toMatchObject({ id: 'CF-101', projectId: 'CFP-001', status: 'screened', voters: ['simulator:streamer'] });
    const content = kit.read(ideaFile.path);
    expect(splitNote(content).body).toBe(splitNote(legacyNote).body);
    expect(content).toContain('[[My studio note]]');
    expect(content).toContain('coforge-project: CFP-001');
  });
});
