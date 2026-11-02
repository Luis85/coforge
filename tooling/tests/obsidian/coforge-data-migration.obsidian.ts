import { describe, expect } from 'vitest';
import { test } from './support/obsidian-fixture';

describe('CoForge vault data in contained Obsidian', () => {
  test('migrates a legacy studio journal, preserves settings/notes and restores the same data on reload', async ({ obsidian }) => {
    const paths = await obsidian.eval(({ app, pluginId }) => ({
      old: `${app.plugins.manifests[pluginId]?.dir ?? `${app.vault.configDir}/plugins/${pluginId}`}/coforge-state.json`,
      settings: `${app.plugins.manifests[pluginId]?.dir ?? `${app.vault.configDir}/plugins/${pluginId}`}/data.json`,
      ignore: `${app.plugins.manifests[pluginId]?.dir ?? `${app.vault.configDir}/plugins/${pluginId}`}/.gitignore`,
    }));
    await expect.poll(() => obsidian.eval(({ app }) => app.vault.adapter.exists('.coforge-data/studio/coforge-state.json')), { timeout: 15000 }).toBe(true);
    await obsidian.disablePlugin();
    const before = await obsidian.eval(async ({ app }, input) => {
      const current = '.coforge-data/studio/coforge-state.json';
      const bytes = await app.vault.adapter.read(current);
      await app.vault.adapter.rename(current, input.old);
      const ignore = 'data.json\r\n';
      await app.vault.adapter.write(input.ignore, ignore);
      const note = await app.vault.create('Migration annotation.md', '# Human annotation\nKeep these bytes.\n');
      return { note: await app.vault.read(note), settings: await app.vault.adapter.read(input.settings), bytes, ignore };
    }, paths);
    await obsidian.enablePlugin();
    const after = await obsidian.eval(async ({ app }, input) => {
      const file = app.vault.getFileByPath('Migration annotation.md');
      return {
        oldExists: await app.vault.adapter.exists(input.old),
        settings: await app.vault.adapter.read(input.settings),
        data: await app.vault.adapter.read('.coforge-data/studio/coforge-state.json'),
        note: file ? await app.vault.read(file) : null,
        ignored: await app.vault.adapter.read('.gitignore'),
        humanIgnore: await app.vault.adapter.read(input.ignore),
        indexed: app.vault.getFiles().some(file => file.path.startsWith('.coforge-data/')),
      };
    }, paths);
    expect(after.oldExists).toBe(false);
    expect(after.settings).toBe(before.settings);
    expect(after.note).toBe(before.note);
    expect(after.indexed).toBe(false);
    expect(after.ignored).toContain('/.coforge-data/');
    expect(after.humanIgnore).toBe(before.ignore);
    // Startup may append operational observations; canonical retained state survives.
    expect(JSON.parse(after.data).votes).toEqual(JSON.parse(before.bytes).votes);
    await obsidian.reloadPlugin();
    expect(await obsidian.eval(({ app }) => app.vault.adapter.exists('.coforge-data/studio/coforge-state.json'))).toBe(true);
    expect(obsidian.errors()).toEqual([]);
  });
});
