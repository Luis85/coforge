import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';

for (const theme of ['light', 'dark']) test(`manages CoWorkers and restores collapsible navigation in ${theme}`, async ({ page }) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#surface=node-1');
  await expect(page.locator('html')).toHaveAttribute('data-prototype-ready', 'true');
  await page.evaluate(theme => { document.body.classList.remove('theme-light', 'theme-dark'); document.body.classList.add(`theme-${theme}`); }, theme);
  const sidebar = page.locator('.cf-sidebar');
  await expect(sidebar.locator('.cf-nav-group').first()).toHaveAttribute('aria-label', 'Build & Improve navigation');
  const collapse = sidebar.getByRole('button', { name: 'Collapse Stream', exact: true });
  await collapse.focus(); await collapse.press('Enter');
  await expect(sidebar.getByRole('button', { name: 'Stream studio', exact: true })).toBeHidden();
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-prototype-ready', 'true');
  await page.evaluate(theme => { document.body.classList.remove('theme-light', 'theme-dark'); document.body.classList.add(`theme-${theme}`); }, theme);
  await expect(sidebar.getByRole('button', { name: 'Expand Stream', exact: true })).toHaveAttribute('aria-expanded', 'false');
  await sidebar.getByRole('button', { name: 'Expand Stream', exact: true }).click();
  await sidebar.getByRole('button', { name: 'CoWorkers', exact: true }).click();
  await page.getByRole('button', { name: 'Explore CoWorkers example', exact: true }).click();
  await page.getByRole('button', { name: 'Create CoWorker', exact: true }).click();
  await page.getByLabel('Definition name', { exact: true }).fill('Fixture reviewer');
  await page.getByLabel('Role', { exact: true }).fill('Boundary review');
  await page.getByLabel('CoWorker instructions', { exact: true }).fill('Review assumptions and missing interfaces.');
  await page.getByLabel('Available for new runs', { exact: true }).check();
  await page.getByRole('button', { name: 'Save CoWorker', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Saved CoWorkers', exact: true })).toContainText('Fixture reviewer');
  await page.getByRole('searchbox', { name: 'Search CoWorkers', exact: true }).fill('Boundary review');
  await expect(page.locator('.cf-coworker-card')).toHaveCount(1);
  await expect(page.locator('.cf-coworker-editor')).toContainText('CoForge MCP only');
  await mkdir('reports/workspace-management', { recursive: true });
  for (const width of [1440, 480]) {
    await page.setViewportSize({ width: 1800, height: 1000 });
    await page.locator('[data-plugin-ui="coforge"]').first().evaluate((element, width) => { element.style.width = `${width}px`; element.style.maxWidth = `${width}px`; }, width);
    const surface = page.locator('.cf-coworkers-page');
    expect(await surface.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    expect((await new AxeBuilder({ page }).include('.cf-coworkers-page').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
    await surface.screenshot({ path: `reports/workspace-management/coworkers-${theme}-${width}.png` });
  }
  await page.getByRole('button', { name: 'Archive CoWorker', exact: true }).click();
  await page.getByRole('combobox', { name: 'CoWorker status', exact: true }).selectOption('available');
  await expect(page.locator('.cf-coworker-card')).toHaveCount(0);
  await expect(page.getByText('No matching CoWorkers', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
