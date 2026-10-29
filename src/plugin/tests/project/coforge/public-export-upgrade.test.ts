import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import { App, Plugin } from 'obsidian';
import { createTestApp } from '@test/obsidian';
import { PublicSitePublisher } from '../../../infrastructure/coforge/public-site-publisher';
import { renderPreProjectPublicSite } from '../../../infrastructure/coforge/public-site-pre-projects';
import { publicExportBoardCheck } from '../../../infrastructure/coforge/public-export-board-check';
import { StudioService } from '../../../features/coforge/application/studio';
import { createSeed, defaultIntegration } from '../../../features/coforge/domain/seed';
import { initialProject } from '../../../features/coforge/domain/projects';
import { MemoryStorage, nodeTimers } from './memory-storage';
const stops: Array<() => Promise<void>> = [];
afterEach(async () => { for (const stop of stops.splice(0)) await stop(); });
const json = readFileSync(new URL('./fixtures/public-export-pre-projects.json', import.meta.url), 'utf8');
const html = readFileSync(new URL('./fixtures/public-export-pre-projects.html', import.meta.url), 'utf8');
function fixture(privateProject = false, boardJson = json, page = html) {
  const app = new App();
  const kit = createTestApp({ app, layoutReady: true, files: { 'CoForge/Public/board.json': boardJson, 'CoForge/Public/index.html': page, 'CoForge/Public/README.md': 'Human publication notes.\r\n', 'Private/Keep.md': '# My note\r\nKeep exactly.\r\n' } });
  const plugin = new (class extends Plugin {})(app, { id: 'coforge', name: 'CoForge', version: '0.1.0', minAppVersion: '1.13.7', author: '', description: '' });
  const seed = createSeed(); seed.settings.paused = true;
  seed.projects = [{ ...initialProject(seed.settings, defaultIntegration(), new Date().toISOString()), visibility: privateProject ? 'private' : 'public' }]; seed.activeProjectId = seed.projects[0]!.id;
  const studio: StudioService = new StudioService(new MemoryStorage(seed), { timers: nodeTimers(), runners: { demo: async () => ({}), claude: async () => ({}) }, probeRuntime: async () => ({ cliAvailable: false, projectPath: null, allowImplementation: false }), beforeCommit: (next, previous) => publisher.beforeCommit(next, previous) });
  const publisher: PublicSitePublisher = new PublicSitePublisher(plugin, () => studio.integration(), () => [], () => studio.state());
  stops.push(() => studio.stop());
  return { app, kit, studio, seed };
}
it('opens an existing public studio with exact pre-project exports and preserves all original bytes', async () => {
  const f = fixture();
  await f.studio.start();
  expect(f.studio.ready).toBe(true); expect(f.studio.state().ideas.map(idea => idea.id)).toEqual(f.seed.ideas.map(idea => idea.id));
  expect(f.kit.read('CoForge/Public/board.json')).toBe(json); expect(f.kit.read('CoForge/Public/index.html')).toBe(html);
  expect(f.kit.read('CoForge/Public/README.md')).toBe('Human publication notes.\r\n'); expect(f.kit.read('Private/Keep.md')).toBe('# My note\r\nKeep exactly.\r\n');
  expect(f.kit.errors).toEqual([]);
});
it('retires verified pre-project exports on private startup while preserving human files and canonical requests', async () => {
  const f = fixture(true); await f.studio.start();
  expect(await f.app.vault.adapter.exists('CoForge/Public/board.json')).toBe(false); expect(await f.app.vault.adapter.exists('CoForge/Public/index.html')).toBe(false);
  expect(f.studio.state().ideas.map(idea => idea.id)).toEqual(f.seed.ideas.map(idea => idea.id));
  expect(f.kit.read('CoForge/Public/README.md')).toBe('Human publication notes.\r\n'); expect(f.kit.read('Private/Keep.md')).toBe('# My note\r\nKeep exactly.\r\n');
});
it.each([
  ['edited HTML', json, html + '\nHuman addition.'],
  ['extra JSON fields', JSON.stringify({ ...JSON.parse(json), privateNotes: 'Human content' }), html],
  ['invalid project identity', JSON.stringify({ ...JSON.parse(json), projectId: null }), html],
  ['malformed JSON', '{broken', html],
] as const)('preserves every file and refuses uncertain ownership for %s', async (_label, boardJson, page) => {
  const f = fixture(true, boardJson, page);
  await expect(f.studio.start()).rejects.toThrow(/edited|verified/);
  expect(f.kit.read('CoForge/Public/board.json')).toBe(boardJson); expect(f.kit.read('CoForge/Public/index.html')).toBe(page);
  expect(f.kit.read('Private/Keep.md')).toBe('# My note\r\nKeep exactly.\r\n');
});
it('does not adopt community context that the old renderer would hide', async () => {
  const board = publicExportBoardCheck({ ...JSON.parse(json), projectId: '' });
  board.columns[0]!.ideas.push({ id: 'CF-101', title: 'Historical idea', description: 'Old public text.', category: 'Feature', status: 'Screened', column: 'inbox', votes: 1, rice: null, author: 'Viewer', plan: null, contexts: [{ author: 'Human', text: 'Preserve this unsupported field.' }] });
  const boardJson = JSON.stringify({ ...board, projectId: undefined });
  const page = renderPreProjectPublicSite(board);
  const f = fixture(true, boardJson, page);
  await expect(f.studio.start()).rejects.toThrow(/edited|verified/);
  expect(f.kit.read('CoForge/Public/board.json')).toBe(boardJson); expect(f.kit.read('CoForge/Public/index.html')).toBe(page);
});
