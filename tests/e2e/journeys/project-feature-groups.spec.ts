import { expect, test } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
import { openProjectSettings } from '../support/settings-navigation';

for (const theme of ['light', 'dark']) {
  test(`project groups and individual features save explicitly and reflow in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 1800, height: 1000 });
    await page.goto('/#surface=node-1');
    await expect(page.locator('html')).toHaveAttribute('data-prototype-ready', 'true');
    await page.evaluate(value => {
      document.body.classList.toggle('theme-light', value === 'light');
      document.body.classList.toggle('theme-dark', value === 'dark');
    }, theme);
    await openProjectSettings(page, 'General');
    const serviceDesign = page.getByLabel('Show Service Design', { exact: true });
    const costs = page.getByLabel('Show AI costs', { exact: true });
    await serviceDesign.focus(); await serviceDesign.press('Space');
    await expect(serviceDesign).not.toBeChecked(); await costs.uncheck();
    const stream = page.getByLabel('Show Stream features', { exact: true });
    await stream.focus(); await stream.press('Space');
    const navigation = page.getByRole('group', { name: 'Stream navigation', exact: true });
    await expect(navigation).toHaveCount(1);
    await page.getByRole('button', { name: 'Save settings', exact: true }).click();
    await expect(navigation).toHaveCount(0);
    await expect(page.locator('.cf-sidebar').getByRole('button', { name: 'Service Design', exact: true })).toHaveCount(0);
    await expect(page.locator('.cf-sidebar').getByRole('button', { name: 'AI costs', exact: true })).toHaveCount(0);
    await expect(page.locator('.cf-sidebar').getByRole('button', { name: 'The Council', exact: true })).toHaveCount(1);
    const section = page.getByRole('region', { name: 'Project features', exact: true });
    const host = page.locator('[data-plugin-ui="coforge"]').first();
    await mkdir('reports/project-feature-groups', { recursive: true });
    for (const width of [1280, 480]) {
      await host.evaluate((element, size) => { element.style.width = `${size}px`; element.style.maxWidth = 'none'; }, width);
      await section.scrollIntoViewIfNeeded();
      expect(await section.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await section.screenshot({ path: `reports/project-feature-groups/features-${theme}-${width}.png` });
      expect((await new AxeBuilder({ page }).include('.cf-project-feature-fields')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
    }
    await page.getByRole('navigation', { name: 'CoForge navigation' }).getByRole('button', { name: /^Idea board/ }).click();
    await expect(page.getByRole('button', { name: /^(Expand|Collapse) chat panel$/ })).toHaveCount(0);
    await openProjectSettings(page, 'General');
    await expect(stream).not.toBeChecked();
    await expect(serviceDesign).not.toBeChecked();
    await expect(costs).not.toBeChecked();
    await stream.check();
    await serviceDesign.check();
    await page.getByRole('button', { name: 'Save settings', exact: true }).click();
    await expect(navigation).toHaveCount(1);
    await expect(page.locator('.cf-sidebar').getByRole('button', { name: 'Service Design', exact: true })).toHaveCount(1);
    await expect(costs).not.toBeChecked();
  });
}
