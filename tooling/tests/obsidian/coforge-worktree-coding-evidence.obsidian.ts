import { expect as browserExpect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { describe, expect } from 'vitest';
import { test } from './support/obsidian-fixture';
import { worktreeCodingFixture } from './support/worktree-coding-fixture';

const TITLE = 'SYNTHETIC coding profiles and observations';
describe('Captured coding profiles and distinct evidence in the contained host', () => {
  test('keeps native/MCP observations and legacy Docker evidence distinct without executing fixture work', async ({ obsidian }) => {
    let view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await view.locator('.cf-project-switcher').click(); await view.getByRole('button', { name: 'Add project', exact: true }).click();
    await view.getByLabel('Project name', { exact: true }).fill('SYNTHETIC coding evidence');
    await view.getByLabel(/^Project path/).fill('/synthetic/coding-evidence');
    await view.getByLabel('Description', { exact: true }).fill('Renderer qualification only. No model, shell, Docker or project execution.');
    await view.getByRole('button', { name: 'Create project', exact: true }).click();
    await view.getByRole('button', { name: /^Idea board/ }).first().click();
    await view.getByRole('button', { name: 'New request', exact: true }).first().click();
    await view.getByLabel('The idea', { exact: true }).fill(TITLE);
    await view.getByLabel('A little more context', { exact: true }).fill('Synthetic historical metadata for UI validation.');
    await view.getByRole('button', { name: 'Add to the board', exact: true }).click();
    await browserExpect(view.locator('.cf-idea-card').filter({ hasText: TITLE })).toBeVisible();
    await expect.poll(() => obsidian.eval(({ app }) => app.vault.getMarkdownFiles().some(file => file.path.startsWith('CoForge/Ideas/')))).toBe(true);
    const note = await obsidian.eval(async ({ app, pluginId }) => {
      const file = app.vault.getMarkdownFiles().find(file => file.path.startsWith('CoForge/Ideas/'));
      if (!file) throw new Error('Missing contained request.');
      return { path: file.path, noteText: await app.vault.read(file), stateText: await app.vault.adapter.read(`.obsidian/plugins/${pluginId}/coforge-state.json`) };
    });
    await obsidian.disablePlugin(); const prepared = worktreeCodingFixture(note.noteText, note.stateText);
    await obsidian.eval(async ({ app, pluginId }, input) => {
      await app.vault.adapter.write(input.notePath, input.noteText);
      await app.vault.adapter.write(`.obsidian/plugins/${pluginId}/coforge-state.json`, input.stateText);
    }, { notePath: note.path, ...prepared });
    await obsidian.enablePlugin(); view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await view.getByRole('button', { name: /^Idea board/ }).first().click();
    await view.locator('.cf-idea-card').filter({ hasText: TITLE }).locator('.cf-idea-open').click();
    const drawer = view.getByRole('dialog', { name: TITLE, exact: true }); const tabs = drawer.getByRole('navigation', { name: 'Idea sections', exact: true });
    await tabs.getByRole('button', { name: 'Activity', exact: true }).click();
    const native = drawer.locator('[data-job-id="synthetic-native"]'); await native.locator('summary').first().click();
    await browserExpect(native).toContainText('native-worktree-v1'); await browserExpect(native).toContainText('normal file tools, shell, project tests');
    await browserExpect(native).toContainText('Internet research is allowed');
    const legacy = drawer.locator('[data-job-id="synthetic-legacy"]'); await legacy.locator('summary').first().click();
    await browserExpect(legacy).toContainText('Legacy scoped tools'); await browserExpect(legacy).toContainText('captured Docker verification profile');
    await browserExpect(legacy).not.toContainText('Internet research is allowed');
    await tabs.getByRole('button', { name: 'Workflow runs', exact: true }).click();
    const captured = drawer.locator('details[aria-label="Captured workflow configuration"]');
    await captured.locator('summary').first().click();
    const profiles = captured.getByRole('region', { name: 'Captured attempt coding profiles', exact: true });
    await browserExpect(profiles).toContainText('native-worktree-v1'); await browserExpect(profiles).toContainText('mcp-worktree-v1'); await browserExpect(profiles).toContainText('Legacy scoped tools');
    await tabs.getByRole('button', { name: 'Sessions', exact: true }).click();
    const peek = drawer.getByRole('region', { name: 'Session Peek', exact: true });
    await drawer.locator('[data-parent-session-id="synthetic-mcp"]').click();
    await browserExpect(peek).toContainText('Host-observed MCP command events'); await browserExpect(peek).toContainText('SYNTHETIC host MCP command event');
    await browserExpect(peek).toContainText('Internet research is allowed'); await browserExpect(peek).toContainText('normal desktop connectivity');
    await browserExpect(peek.getByRole('button', { name: 'Follow parent session in read-only terminal', exact: true })).toHaveCount(0);
    await browserExpect(drawer.getByRole('navigation', { name: 'Parent sessions', exact: true })).toContainText('Client model not reported');
    for (const width of [1360, 760]) for (const theme of ['light', 'dark']) {
      await obsidian.page.setViewportSize({ width, height: 960 });
      await obsidian.eval((_context, theme) => { document.body.classList.toggle('theme-light', theme === 'light'); document.body.classList.toggle('theme-dark', theme === 'dark'); }, theme);
      await drawer.locator('[data-parent-session-id="synthetic-mcp"]').click(); await peek.scrollIntoViewIfNeeded();
      expect(await peek.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await obsidian.screenshot(`mcp-observations-${theme}-${width}`);
      await tabs.getByRole('button', { name: 'Increment', exact: true }).click();
      const observations = drawer.getByRole('region', { name: 'Provider tool observations', exact: true });
      await observations.locator('summary').first().click(); await browserExpect(observations).toContainText('not a passing test result');
      await browserExpect(observations.locator('script')).toHaveCount(0); await browserExpect(observations).not.toContainText('Completed · exit 0');
      expect((await new AxeBuilder({ page: obsidian.page }).setLegacyMode(true).include('[aria-label="Provider tool observations"]').withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()).violations).toEqual([]);
      await observations.scrollIntoViewIfNeeded(); await obsidian.screenshot(`provider-observations-${theme}-${width}`);
      await tabs.getByRole('button', { name: 'Sessions', exact: true }).click();
    }
    expect(await obsidian.eval(({ app }, path) => app.vault.adapter.read(path), note.path)).toBe(prepared.noteText);
    expect(obsidian.errors()).toEqual([]);
  });
});
