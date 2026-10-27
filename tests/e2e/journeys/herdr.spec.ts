import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
for (const theme of ['light', 'dark']) test(`Herdr controls and reviewed dispatch in ${theme}`, async ({ page }) => {
  await page.goto('/#surface=node-1'); await expect(page.locator('html')).toHaveAttribute('data-prototype-ready', 'true');
  await page.evaluate(theme => { document.body.classList.toggle('theme-dark', theme === 'dark'); document.body.classList.toggle('theme-light', theme === 'light'); }, theme);
  await page.getByRole('button', { name: 'Studio settings', exact: true }).click();
  await page.getByLabel(/^Project path/).fill('/synthetic/game');
  await page.getByLabel('General agent prompt', { exact: true }).fill('Keep the game accessible.');
  await page.getByRole('button', { name: 'Save settings', exact: true }).click();
  await page.getByRole('button', { name: 'Agent workflow', exact: true }).click();
  const herdr = page.locator('.cf-herdr'); await herdr.locator(':scope > summary').click();
  await herdr.getByRole('button', { name: 'Explore Herdr example', exact: true }).click();
  await expect(herdr).toContainText('Connected');
  await herdr.getByLabel('Herdr agent', { exact: true }).selectOption('w1:p2');
  const requests = herdr.getByLabel('Screened CoForge request', { exact: true });
  await requests.selectOption({ index: 1 });
  await herdr.getByRole('button', { name: 'Review Herdr dispatch', exact: true }).click();
  await expect(herdr.getByRole('region', { name: 'Reviewed Herdr prompt', exact: true })).toContainText('Keep the game accessible.');
  await herdr.getByRole('button', { name: 'Send reviewed request to Herdr', exact: true }).click();
  await expect(herdr).toContainText('Request delivered to Herdr');
  await herdr.getByRole('button', { name: 'Create workspace for project', exact: true }).click();
  await herdr.getByLabel('Empty shell pane', { exact: true }).selectOption('w1:p1');
  await herdr.getByRole('button', { name: 'Start Herdr agent', exact: true }).click();
  await expect(herdr.getByLabel('Herdr agent', { exact: true }).locator('option')).toContainText(['Example claude']);
  await mkdir('reports/herdr', { recursive: true });
  for (const width of [1280, 360]) {
    await page.setViewportSize({ width, height: 900 });
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
    await test.info().attach(`herdr-${theme}-${width}`, { body: await herdr.screenshot({ path: `reports/herdr/${theme}-${width}.png` }), contentType: 'image/png' });
  }
});
