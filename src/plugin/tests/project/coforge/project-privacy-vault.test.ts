import { expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import { App, Plugin } from 'obsidian';
import { createTestApp } from '@test/obsidian';
import { StudioService } from '../../../features/coforge/application/studio';
import { VaultStudioStorage } from '../../../infrastructure/coforge/vault-storage';
import { splitNote } from '../../../infrastructure/coforge/markdown';
import { parseProjectNote, projectProperties } from '../../../features/coforge/domain/project-note';
import { nodeTimers } from './memory-storage';
it('roundtrips explicit visibility and preserves canonical identity, unknown properties and human body bytes', async () => {
  const app = new App(); const kit = createTestApp({ app, layoutReady: true }); class TestPlugin extends Plugin {}
  const plugin = new TestPlugin(app, { id: 'coforge', name: 'CoForge', version: '0.1.0', minAppVersion: '1.13.7', description: '', author: '' });
  const storage = new VaultStudioStorage(plugin);
  const host = { timers: nodeTimers(), runners: { demo: async () => ({}), claude: async () => ({}) }, probeRuntime: async () => ({ cliAvailable: false, projectPath: null, allowImplementation: false }) };
  const studio = new StudioService(storage, host); await studio.start();
  let reopened: StudioService | undefined;
  try {
    const project = await studio.createProject({ projectName: 'Private game', projectBrief: 'An owner project with canonical Markdown metadata.', projectPath: '/synthetic/private', visibility: 'private' });
    const file = storage.projectFile(project.id); if (!file) throw new Error('Missing project note');
    await app.fileManager.processFrontMatter(file, values => { values.custom = 'retain'; });
    await app.vault.process(file, value => value + '\r\n## Human storyboard\r\nPreserve these bytes.\r\n');
    const body = splitNote(kit.read(file.path)).body;
    await studio.updateProject({ projectBrief: 'The private project brief can still be edited.' }, project.id);
    expect(kit.read(file.path)).toContain('coforge-visibility: private'); expect(kit.read(file.path)).toContain('custom: retain');
    expect(splitNote(kit.read(file.path)).body).toBe(body);
    await studio.stop(); reopened = new StudioService(new VaultStudioStorage(plugin), host); await reopened.start();
    expect(reopened.state().projects?.find(item => item.id === project.id)?.visibility).toBe('private');
    const legacy = projectProperties(project); delete legacy['coforge-visibility'];
    expect(parseProjectNote(legacy)?.visibility).toBe('public');
    expect(() => parseProjectNote({ ...legacy, 'coforge-visibility': 'invalid' })).toThrow();
    expect(() => parseProjectNote({ ...legacy, 'coforge-visibility': null })).toThrow();
    expect(splitNote(kit.read(file.path)).body).toBe(body);
  } finally { await reopened?.stop(); await studio.stop(); }
});
