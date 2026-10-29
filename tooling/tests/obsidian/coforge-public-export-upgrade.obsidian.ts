import { readFileSync } from 'node:fs';
import { expect as browserExpect } from '@playwright/test';
import { describe, expect } from 'vitest';
import { test } from './support/obsidian-fixture';

const json = readFileSync('src/plugin/tests/project/coforge/fixtures/public-export-pre-projects.json', 'utf8');
const html = readFileSync('src/plugin/tests/project/coforge/fixtures/public-export-pre-projects.html', 'utf8');

describe('Historical public exports in the contained Obsidian host', () => {
  test('opens and reloads the studio with pre-project exports without changing their bytes or human notes', async ({ obsidian }) => {
    await obsidian.disablePlugin();
    await obsidian.eval(async ({ app }, files) => {
      for (const folder of ['CoForge', 'CoForge/Public']) if (!app.vault.getAbstractFileByPath(folder)) await app.vault.createFolder(folder);
      await app.vault.create('CoForge/Public/board.json', files.json);
      await app.vault.create('CoForge/Public/index.html', files.html);
      await app.vault.create('CoForge/Public/README.md', 'Keep my publication notes.\r\n');
    }, { json, html });
    await obsidian.enablePlugin();
    let view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await browserExpect(view.getByRole('heading', { name: 'Stream studio', exact: true })).toBeVisible();
    await browserExpect(view.locator('.cf-startup-screen')).toHaveCount(0);
    const read = () => obsidian.eval(async ({ app }) => ({ json: await app.vault.adapter.read('CoForge/Public/board.json'), html: await app.vault.adapter.read('CoForge/Public/index.html'), notes: await app.vault.adapter.read('CoForge/Public/README.md') }));
    expect(await read()).toEqual({ json, html, notes: 'Keep my publication notes.\r\n' });
    await obsidian.reloadPlugin();
    view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await browserExpect(view.getByRole('heading', { name: 'Stream studio', exact: true })).toBeVisible();
    expect(await read()).toEqual({ json, html, notes: 'Keep my publication notes.\r\n' });
    expect(obsidian.errors()).toEqual([]);
    await obsidian.screenshot('historical-public-export-startup');
  });
});
