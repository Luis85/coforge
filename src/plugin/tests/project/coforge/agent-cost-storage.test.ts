import { expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import { App, Plugin } from 'obsidian';
import { createTestApp } from '@test/obsidian';
import { VaultAICosts } from '../../../infrastructure/coforge/ai-cost-storage';
import { executionCostTasks } from '../../../features/coforge/application/execution-costs';
import { splitNote } from '../../../infrastructure/coforge/markdown';
import { attributedRun } from './cost-attribution-fixture';

it('roundtrips nested captured identities safely and preserves unrelated ledger properties and body bytes', async () => {
  const app = new App(); const kit = createTestApp({ app, layoutReady: true });
  class TestPlugin extends Plugin {}
  const plugin = new TestPlugin(app, { id: 'coforge', name: 'CoForge', version: '0.1.0', minAppVersion: '1.13.7', author: '', description: '' });
  const storage = new VaultAICosts(plugin); await storage.load();
  const task = executionCostTasks([attributedRun('storage')], [])[0]!;
  task.attribution = { ...task.attribution!, agentName: '{{Captured}} [[reviewer]]', teamName: 'Team `= private-query`' };
  await storage.save([task]);
  const path = 'CoForge/AI-Costs/Ledger.md';
  expect(kit.read(path)).not.toContain('{{Captured}}');
  const file = app.vault.getFileByPath(path); if (!file) throw new Error('Missing ledger');
  await app.vault.process(file, value => value + '\r\n## Human accounting notes\r\nKeep these exact bytes.\r\n');
  await app.fileManager.processFrontMatter(file, properties => { properties['human-category'] = 'retain'; });
  const body = splitNote(kit.read(path)).body;
  const reopened = new VaultAICosts(plugin); const loaded = await reopened.load();
  expect(loaded[0]?.attribution?.agentName).toBe('{{Captured}} [[reviewer]]');
  expect(loaded[0]?.attribution?.teamName).toBe('Team `= private-query`');
  await reopened.save(loaded);
  expect(splitNote(kit.read(path)).body).toBe(body);
  expect(kit.read(path)).toContain('human-category: retain');
});
