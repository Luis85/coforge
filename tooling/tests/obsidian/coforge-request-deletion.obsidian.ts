import { expect as browserExpect } from '@playwright/test';
import { describe, expect } from 'vitest';
import { test } from './support/obsidian-fixture';

describe('Request deletion in contained Obsidian', () => {
  test('confirms the exact card, keeps cancellation harmless and preserves the deleted note in local trash after reload', async ({ obsidian }) => {
    await obsidian.page.setViewportSize({ width: 1440, height: 1000 });
    await obsidian.eval(({ app }) => {
      const setConfig: unknown = Reflect.get(app.vault, 'setConfig');
      if (typeof setConfig !== 'function') throw new Error('The contained host cannot select local trash for this test.');
      Reflect.apply(setConfig, app.vault, ['trashOption', 'local']);
    });
    let view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await view.locator('.cf-project-switcher').click();
    await view.getByRole('button', { name: 'Add project', exact: true }).click();
    await view.getByLabel('Project name', { exact: true }).fill('Request deletion fixture');
    await view.getByLabel(/^Project path/).fill('/synthetic/request-deletion');
    await view.getByLabel('Description', { exact: true }).fill('Recoverable deletion of one request.');
    await view.getByRole('button', { name: 'Create project', exact: true }).click();
    for (const title of ['Delete only this feature request', 'Keep this other feature request']) {
      await view.getByRole('button', { name: 'New request', exact: true }).first().click();
      await view.getByLabel(/^The idea/).fill(title);
      await view.getByRole('button', { name: 'Add to the board', exact: true }).click();
    }
    const before = await obsidian.eval(async ({ app }) => {
      const file = app.vault.getMarkdownFiles().find(file => file.path.includes('Delete only this feature request'));
      if (!file) throw new Error('Request fixture note missing');
      return { path: file.path, name: file.name, bytes: await app.vault.read(file) };
    });
    const card = () => view.locator('.cf-idea-card').filter({ hasText: 'Delete only this feature request' });
    await card().click({ button: 'right' });
    await view.getByRole('menuitem', { name: /^Delete request/ }).click();
    let dialog = view.getByRole('alertdialog', { name: 'Delete request', exact: true });
    await browserExpect(dialog).toBeVisible();
    await browserExpect(dialog.getByRole('button', { name: 'Keep request', exact: true })).toBeFocused();
    await browserExpect(dialog).toContainText('Delete only this feature request');
    await obsidian.screenshot('request-deletion-confirm-light');
    await dialog.getByRole('button', { name: 'Keep request', exact: true }).click();
    await browserExpect(card()).toHaveCount(1);
    expect(await obsidian.eval(async ({ app }, path) => app.vault.adapter.read(path), before.path)).toBe(before.bytes);
    await card().click({ button: 'right' }); await view.getByRole('menuitem', { name: /^Delete request/ }).click();
    dialog = view.getByRole('alertdialog', { name: 'Delete request', exact: true });
    await obsidian.page.setViewportSize({ width: 760, height: 900 });
    await obsidian.page.evaluate(() => { document.body.classList.remove('theme-light'); document.body.classList.add('theme-dark'); });
    await browserExpect(dialog).toBeVisible();
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await obsidian.screenshot('request-deletion-confirm-narrow-dark');
    await dialog.getByRole('button', { name: 'Delete request', exact: true }).click();
    await browserExpect(dialog).toHaveCount(0); await browserExpect(card()).toHaveCount(0);
    await browserExpect(view.locator('.cf-idea-card').filter({ hasText: 'Keep this other feature request' })).toBeVisible();
    expect(await obsidian.eval(async ({ app }, input) => ({ exists: await app.vault.adapter.exists(input.path), trash: await app.vault.adapter.read(`.trash/${input.name}`) }), before)).toEqual({ exists: false, trash: before.bytes });
    await obsidian.screenshot('request-deletion-complete');
    await obsidian.reloadPlugin(); view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await view.getByRole('button', { name: 'Idea board', exact: true }).click();
    await browserExpect(card()).toHaveCount(0);
    expect(obsidian.errors()).toEqual([]);
  });
});
