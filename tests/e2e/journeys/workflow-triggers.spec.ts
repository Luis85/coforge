import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
import { openCouncilPage } from '../support/council-navigation';

for (const theme of ['light', 'dark']) test(`workflow triggers review saved definitions and retain drafts in ${theme}`, async ({ page }) => {
  test.setTimeout(90000);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#surface=node-1'); await expect(page.locator('html')).toHaveAttribute('data-prototype-ready', 'true');
  await page.evaluate(value => { document.body.classList.toggle('theme-light', value === 'light'); document.body.classList.toggle('theme-dark', value === 'dark'); }, theme);
  await page.getByRole('button', { name: 'The Council', exact: true }).first().click();
  await page.getByRole('button', { name: 'Explore Council example', exact: true }).click();
  await openCouncilPage(page, 'Run monitor');
  await page.getByRole('button', { name: 'Use this desktop for execution', exact: true }).click();
  await openCouncilPage(page, 'Event triggers');
  await page.getByRole('button', { name: 'Explore event-trigger example', exact: true }).click();
  const region = page.getByRole('region', { name: 'Workflow event triggers', exact: true });
  await region.getByLabel('Trigger name', { exact: true }).fill('Review new requests');
  await region.getByRole('combobox', { name: 'Listen to', exact: true }).selectOption('application');
  await openCouncilPage(page, 'Definitions');
  await openCouncilPage(page, 'Event triggers');
  await expect(region.getByLabel('Trigger name', { exact: true })).toHaveValue('Review new requests');
  await region.getByRole('button', { name: 'Review saved workflow', exact: true }).click();
  await expect(region.getByRole('button', { name: 'Save trigger', exact: true })).toBeEnabled();
  await mkdir('reports/workflow-triggers', { recursive: true });
  for (const width of [1280, 360]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await region.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    expect((await new AxeBuilder({ page }).include('[aria-label="Workflow event triggers"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
    await region.screenshot({ path: `reports/workflow-triggers/form-${theme}-${width}.png` });
  }
  await region.getByRole('button', { name: 'Save trigger', exact: true }).click();
  await expect(region).toContainText('Review new requests · Disabled');
  await expect(region).toContainText('Only future matching events');
  expect(errors).toEqual([]);
});
