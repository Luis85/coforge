import { expect as browserExpect } from '@playwright/test';
import { describe, expect } from 'vitest';
import { test } from './support/obsidian-fixture';

describe('Example cleanup in the contained vault', () => {
  test('removes reviewed sample notes, preserves manual bytes and stays removed after reload', async ({ obsidian }) => {
    const view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await view.getByRole('button', { name: 'Project settings', exact: true }).click();
    await view.getByRole('button', { name: 'Load sample workspace', exact: true }).click();
    await view.locator('.cf-settings-reset-confirm').getByRole('button', { name: 'Load sample workspace', exact: true }).click();
    await expect.poll(() => obsidian.eval(({ app }) => app.vault.getMarkdownFiles().filter(file => file.path.startsWith('CoForge/Ideas/')).length)).toBe(15);
    await view.getByRole('button', { name: /^Idea board/ }).click();
    await view.getByRole('button', { name: 'New request', exact: true }).click();
    const dialog = view.getByRole('dialog', { name: 'New request', exact: true });
    await dialog.getByLabel('The idea', { exact: true }).fill('Keep this manually authored feature');
    await dialog.getByLabel('A little more context', { exact: true }).fill('My real idea must survive example cleanup.');
    await dialog.getByRole('button', { name: 'Add to the board', exact: true }).click();
    await browserExpect(dialog).toHaveCount(0);
    const retained = await obsidian.eval(async ({ app }) => {
      const file = app.vault.getMarkdownFiles().find(note => note.path.includes('Keep this manually authored feature'));
      if (!file) throw new Error('The manual note is missing.');
      await app.fileManager.processFrontMatter(file, properties => { properties.custom = 'human annotation'; });
      await app.vault.process(file, content => content + '\r\nMy unrelated body bytes.\r\n');
      return { path: file.path, content: await app.vault.read(file) };
    });
    await view.getByRole('button', { name: 'Project settings', exact: true }).click();
    const cleanup = view.getByRole('region', { name: 'Remove example and local-test content', exact: true });
    await cleanup.getByRole('button', { name: 'Preview example cleanup', exact: true }).click();
    await browserExpect(cleanup).toContainText('15 requests selected');
    await cleanup.getByRole('button', { name: 'Keep content', exact: true }).click();
    await expect.poll(() => obsidian.eval(({ app }) => app.vault.getMarkdownFiles().filter(file => file.path.startsWith('CoForge/Ideas/')).length)).toBe(16);
    await cleanup.getByRole('button', { name: 'Preview example cleanup', exact: true }).click();
    await cleanup.getByRole('checkbox', { name: 'I reviewed the selected requests and local content above and want to remove them.', exact: true }).check();
    await cleanup.getByRole('button', { name: 'Remove selected examples and local content', exact: true }).click();
    await browserExpect(cleanup.getByRole('status')).toContainText('Removed 15');
    await expect.poll(() => obsidian.eval(({ app }) => app.vault.getMarkdownFiles().filter(file => file.path.startsWith('CoForge/Ideas/')).length)).toBe(1);
    expect(await obsidian.eval(({ app }, path) => app.vault.adapter.read(path), retained.path)).toBe(retained.content);
    await obsidian.reloadPlugin();
    await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    expect(await obsidian.eval(({ app }, path) => app.vault.adapter.read(path), retained.path)).toBe(retained.content);
    expect(await obsidian.eval(({ app }) => app.vault.getMarkdownFiles().filter(file => file.path.startsWith('CoForge/Ideas/')).length)).toBe(1);
    expect(obsidian.errors()).toEqual([]);
    await obsidian.screenshot('samples-removed-manual-note-preserved');
  });
});
