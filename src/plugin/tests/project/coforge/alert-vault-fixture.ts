import { App, Plugin } from 'obsidian';
import { createTestApp } from '@test/obsidian';

export function alertVaultFixture() {
  const app = new App();
  const kit = createTestApp({ app, layoutReady: true, files: { '.obsidian/plugins/coforge/.gitignore': '# Human rules\n' } });
  class TestPlugin extends Plugin {}
  const plugin = new TestPlugin(app, { id: 'coforge', name: 'CoForge', version: '0.1.0', minAppVersion: '1.13.7', author: '', description: '' });
  return { app, kit, plugin, definitionsPath: '.obsidian/plugins/coforge/coforge-alerts.json' };
}
