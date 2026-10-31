import { expect, test } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
import { openProjectSettings, settingsPageButton } from '../support/settings-navigation';

const categories = [
  ['General', 'Project details'],
  ['Requests', 'Request Object'],
  ['Repository', 'Repository & build access'],
  ['Agent workflow', 'Agent workflow'],
  ['Runtime', 'Local connections'],
  ['Data & examples', 'Data & examples'],
] as const;

for (const theme of ['light', 'dark']) {
  test(`project settings tasks are keyboard accessible and reflow in ${theme}`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 1800, height: 1000 });
    await page.goto('/#surface=node-1');
    await expect(page.locator('html')).toHaveAttribute('data-prototype-ready', 'true');
    await page.evaluate(value => {
      document.body.classList.remove('theme-light', 'theme-dark');
      document.body.classList.add(`theme-${value}`);
    }, theme);
    await openProjectSettings(page, 'General');
    const settings = page.locator('.cf-settings-page');
    const navigation = settings.getByRole('navigation', { name: 'Project settings pages', exact: true });
    const parent = page.locator('.cf-sidebar').getByRole('button', { name: 'Project settings', exact: true });
    const host = page.locator('[data-plugin-ui="coforge"]').first();
    await mkdir('reports/project-settings', { recursive: true });
    for (const [name, heading] of categories) {
      const button = settingsPageButton(page, name);
      await button.focus(); await button.press('Enter');
      await expect(button).toHaveAttribute('aria-current', 'page');
      await expect(parent).toHaveAttribute('aria-current', 'page');
      await expect(settings.getByRole('heading', { level: 1 })).toHaveText('Project settings');
      await expect(settings.getByRole('heading', { name: heading, exact: true })).toBeVisible();
      await expect(settings.getByRole('button', { name: 'Save settings', exact: true })).toHaveCount(['General', 'Requests', 'Repository'].includes(name) ? 1 : 0);
      if (name === 'Agent workflow') await expect(settings.locator('.cf-workflow-count')).toHaveText('0 attempts');
      for (const width of [1280, 480]) {
        await host.evaluate((element, width) => { element.style.width = `${width}px`; element.style.maxWidth = 'none'; }, width);
        await expect.poll(() => settings.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
        for (const item of await navigation.getByRole('button').all()) await expect(item).toBeVisible();
        const id = name.toLowerCase().replaceAll(' ', '-').replace('&', 'and');
        await settings.screenshot({ path: `reports/project-settings/${id}-${theme}-${width}.png` });
        const violations = (await new AxeBuilder({ page }).include('.cf-settings-page')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations;
        expect(violations.map(item => ({ rule: item.id, targets: item.nodes.map(node => node.target) }))).toEqual([]);
      }
    }
    await openProjectSettings(page, 'Runtime');
    await page.getByRole('button', { name: 'Configure repository', exact: true }).click();
    await expect(settingsPageButton(page, 'Repository')).toHaveAttribute('aria-current', 'page');
    await expect(page.getByLabel('Project path', { exact: true })).toBeVisible();
    await openProjectSettings(page, 'Runtime');
    await page.getByRole('button', { name: 'Manage Herdr workspaces', exact: true }).click();
    await expect(settingsPageButton(page, 'Agent workflow')).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('navigation', { name: 'Agent workflow pages', exact: true }).getByRole('button', { name: 'Herdr', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('.cf-herdr')).toBeVisible();
    await openProjectSettings(page, 'General');
    await expect(page.getByLabel('Project name', { exact: true })).toHaveValue('Mosslight');
    await expect(page.getByRole('button', { name: 'Save settings', exact: true })).toBeDisabled();
  });
}
