import { expect as browserExpect } from '@playwright/test';
import { describe, expect } from 'vitest';
import { test } from './support/obsidian-fixture';

describe('Private project publication in the contained host', () => {
  test('revokes owned exports with automatic publication off, keeps owner notes and withholds all viewer captures after reload', async ({ obsidian }) => {
    let view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await view.getByRole('button', { name: 'Project settings', exact: true }).click();
    await view.getByRole('button', { name: 'Load sample workspace', exact: true }).click();
    await view.locator('.cf-settings-reset-confirm').getByRole('button', { name: 'Load sample workspace', exact: true }).click();
    await browserExpect(view.locator('.cf-project-switcher')).toContainText('Mosslight');
    const original = await obsidian.eval(async ({ app, pluginId }) => {
      const state = JSON.parse(await app.vault.adapter.read(`${app.vault.configDir}/plugins/${pluginId}/coforge-state.json`));
      const file = app.vault.getMarkdownFiles().find(file => file.path.startsWith('CoForge/Ideas/'));
      if (!file) throw new Error('Expected a contained sample request note.');
      await app.vault.adapter.write('CoForge/Personal board.json', '{"human":"preserve exact unrelated bytes"}\n');
      return { path: file.path, text: await app.vault.read(file), automatic: state.integration.publicBoardEnabled };
    });
    expect(original.automatic).toBe(false);
    await obsidian.runCommand('publish-viewer-board');
    await expect.poll(() => obsidian.eval(async ({ app }) => await app.vault.adapter.exists('CoForge/Public/board.json') ? app.vault.adapter.read('CoForge/Public/board.json') : '')).toContain('Mosslight');
    await view.getByRole('combobox', { name: 'Project visibility', exact: true }).selectOption('private');
    await view.getByRole('button', { name: 'Save settings', exact: true }).click();
    await browserExpect(view.getByText('Settings saved', { exact: true })).toBeVisible();
    await expect.poll(() => obsidian.eval(async ({ app }) => ({ board: await app.vault.adapter.exists('CoForge/Public/board.json'), html: await app.vault.adapter.exists('CoForge/Public/index.html') }))).toEqual({ board: false, html: false });
    expect(await obsidian.eval(({ app }, path) => app.vault.adapter.read(path), original.path)).toBe(original.text);
    expect(await obsidian.eval(({ app }) => app.vault.adapter.read('CoForge/Personal board.json'))).toBe('{"human":"preserve exact unrelated bytes"}\n');
    await obsidian.reloadPlugin();
    view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await view.getByRole('button', { name: /^Idea board/ }).first().click();
    await browserExpect(view.locator('.cf-project-work-context')).toContainText('Private project');
    await browserExpect(view.locator('.cf-idea-card')).toHaveCount(15);
    await obsidian.runCommand('publish-viewer-board');
    await expect.poll(() => obsidian.eval(async ({ app }) => {
      if (!await app.vault.adapter.exists('CoForge/Public/board.json') || !await app.vault.adapter.exists('CoForge/Public/index.html')) return false;
      try {
        const board = JSON.parse(await app.vault.adapter.read('CoForge/Public/board.json'));
        const html = await app.vault.adapter.read('CoForge/Public/index.html');
        return board.format === 'coforge-public-board/v1' && html.trimEnd().endsWith('</html>');
      } catch { return false; }
    })).toBe(true);
    const published = await obsidian.eval(async ({ app }) => ({ board: await app.vault.adapter.read('CoForge/Public/board.json'), html: await app.vault.adapter.read('CoForge/Public/index.html') }));
    expect(published.board).not.toContain('Mosslight'); expect(published.board).not.toContain('CF-101');
    expect(published.html).not.toContain('Mosslight'); expect(published.html).not.toContain('CF-101');
    for (const [id, label] of [['kanban', 'Kanban'], ['chat', 'Chat'], ['leaderboards', 'Leaderboards'], ['community', 'Community']]) {
      await obsidian.page.getByLabel(`Open CoForge Stream - ${label}`, { exact: true }).click();
      const surface = obsidian.page.locator(`.cf-stream-surface-${id}`).last();
      await browserExpect(surface).toBeVisible();
      await browserExpect(surface).not.toContainText('Mosslight'); await browserExpect(surface).not.toContainText('CF-101');
      await browserExpect(surface.locator('button,input,textarea,a')).toHaveCount(0);
    }
    expect(obsidian.errors()).toEqual([]);
    await obsidian.screenshot('private-project-revocation-and-viewer-captures');
  });
});
