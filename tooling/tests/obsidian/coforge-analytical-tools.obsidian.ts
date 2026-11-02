import { expect as browserExpect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { describe, expect } from 'vitest';
import { test } from './support/obsidian-fixture';
import { analyticalToolsFixture } from './support/analytical-tools-fixture';

describe('Admitted analytical tools in the contained host', () => {
  test('distinguishes new permissions, explicit opt-outs and earlier restricted attempts without changing captured text or dispatching', async ({ obsidian }) => {
    const title = 'SYNTHETIC analytical permissions';
    let view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await view.locator('.cf-project-switcher').click(); await view.getByRole('button', { name: 'Add project', exact: true }).click();
    await view.getByLabel('Project name', { exact: true }).fill('SYNTHETIC analytical evidence');
    await view.getByLabel(/^Project path/).fill('/synthetic/analytical-evidence');
    await view.getByLabel('Description', { exact: true }).fill('UI permissions fixture only. No model or research executed.');
    await view.getByRole('button', { name: 'Create project', exact: true }).click();
    await view.getByRole('button', { name: /^Idea board/ }).first().click();
    await view.getByRole('button', { name: 'New request', exact: true }).first().click();
    await view.getByLabel('The idea', { exact: true }).fill(title);
    await view.getByLabel('A little more context', { exact: true }).fill('Synthetic captured analytical tools, not an actual agent result.');
    await view.getByRole('button', { name: 'Add to the board', exact: true }).click();
    await browserExpect(view.locator('.cf-idea-card').filter({ hasText: title })).toBeVisible();
    const note = await obsidian.eval(async ({ app, pluginId }) => {
      const file = app.vault.getMarkdownFiles().find(file => file.path.startsWith('CoForge/Ideas/'));
      if (!file) throw new Error('Missing contained request.');
      return { path: file.path, noteText: await app.vault.read(file), stateText: await app.vault.adapter.read(`.coforge-data/studio/coforge-state.json`) };
    });
    await obsidian.disablePlugin(); const prepared = analyticalToolsFixture(note.noteText, note.stateText);
    await obsidian.eval(async ({ app, pluginId }, input) => {
      await app.vault.adapter.write(input.path, input.noteText);
      await app.vault.adapter.write(`.coforge-data/studio/coforge-state.json`, input.stateText);
    }, { path: note.path, ...prepared });
    await obsidian.enablePlugin(); view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await view.getByRole('button', { name: /^Idea board/ }).first().click();
    await view.locator('.cf-idea-card').filter({ hasText: title }).locator('.cf-idea-open').click();
    const drawer = view.getByRole('dialog', { name: title, exact: true });
    await drawer.getByRole('navigation', { name: 'Idea sections', exact: true }).getByRole('button', { name: 'Workflow runs', exact: true }).click();
    const captured = drawer.locator('details[aria-label="Captured workflow configuration"]'); await captured.locator('summary').first().click();
    const tools = captured.getByRole('region', { name: 'Captured analytical tools', exact: true });
    for (const row of ['earlier', 'current', 'disabled']) await tools.locator(`[data-analytical-attempt="analysis-${row}"] summary`).click();
    await browserExpect(tools.locator('[data-analytical-attempt="analysis-earlier"]')).toContainText('No native research grant recorded');
    await browserExpect(tools.locator('[data-analytical-attempt="analysis-current"]')).toContainText('2 concurrent');
    await browserExpect(tools.locator('[data-analytical-attempt="analysis-current"]')).toContainText('Native web research allowed');
    await browserExpect(tools.locator('[data-analytical-attempt="analysis-disabled"]')).toContainText('Native assistants disabled');
    await browserExpect(captured.getByRole('region', { name: 'Captured Build instructions need review', exact: true })).toContainText('do not rewrite');
    for (const [theme, width] of [['light', 1360], ['dark', 760]] as const) {
      await obsidian.page.setViewportSize({ width, height: 960 });
      await obsidian.eval((_context, selected) => { document.body.classList.toggle('theme-light', selected === 'light'); document.body.classList.toggle('theme-dark', selected === 'dark'); }, theme);
      expect(await tools.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await tools.scrollIntoViewIfNeeded(); await obsidian.screenshot(`analytical-captures-${theme}-${width}`);
      expect((await new AxeBuilder({ page: obsidian.page }).setLegacyMode(true).include('[aria-label="Captured analytical tools"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
    }
    expect(await obsidian.eval(({ app }, path) => app.vault.adapter.read(path), note.path)).toBe(prepared.noteText);
    expect(obsidian.errors()).toEqual([]);
  });
});
