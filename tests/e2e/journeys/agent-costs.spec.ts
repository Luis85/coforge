import { expect, test } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';

for (const theme of ['light', 'dark']) test(`agent, team and Council cost dimensions retain unknown and manual coverage in ${theme}`, async ({ page }) => {
  await page.goto('/#surface=node-1');
  await expect(page.locator('html')).toHaveAttribute('data-prototype-ready', 'true');
  await page.evaluate(value => { document.body.classList.remove('theme-light', 'theme-dark'); document.body.classList.add(`theme-${value}`); }, theme);
  await page.locator('.cf-sidebar').getByRole('button', { name: 'AI costs', exact: true }).click();
  await page.getByRole('button', { name: 'Explore example costs', exact: true }).click();
  const view = page.locator('.cf-ai-costs');
  await expect(view.locator('.cf-ai-attribution-filters select').first()).toHaveCSS('border-top-width', '1px');
  await expect(view.locator('tbody tr')).toHaveCount(3);
  await expect(view.getByLabel('Attribution coverage', { exact: true })).toContainText('agent 2/3');
  await view.getByRole('combobox', { name: 'Agent', exact: true }).selectOption('reusable:example-designer');
  await expect(view.locator('tbody tr')).toHaveCount(1);
  await expect(view.locator('.cf-ai-summary')).toContainText('0.0125');
  await view.getByRole('navigation', { name: 'Cost attribution groups', exact: true }).getByRole('button', { name: 'By Council', exact: true }).click();
  await view.locator('.cf-ai-attribution-groups button').click();
  await expect(view.getByRole('combobox', { name: 'Council', exact: true })).toHaveValue('CFP-001/example-design');
  await expect(view.locator('tbody tr')).toHaveCount(1);
  await view.getByRole('button', { name: 'Clear attribution filters', exact: true }).click();
  await view.getByRole('combobox', { name: 'Team', exact: true }).selectOption('CFP-001/example-studio');
  await expect(view.locator('tbody tr')).toHaveCount(2);
  await expect(view.locator('.cf-ai-summary')).toContainText('0.4625');
  await view.getByRole('button', { name: 'Clear attribution filters', exact: true }).click();
  await view.getByRole('combobox', { name: 'Agent', exact: true }).selectOption('__unattributed__');
  await expect(view.locator('tbody tr')).toHaveCount(1);
  await expect(view.locator('tbody')).toContainText('example-herdr-1');
  await expect(view.getByRole('button', { name: 'Add cost for CF-002 dispatch example-herdr-1', exact: true })).toBeVisible();
  await view.getByRole('button', { name: 'Clear attribution filters', exact: true }).click();
  await mkdir('reports/agent-costs', { recursive: true });
  for (const width of [1280, 480]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await view.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await page.locator('.cf-studio').screenshot({ path: `reports/agent-costs/attribution-${theme}-${width}.png` });
  }
  expect((await new AxeBuilder({ page }).include('.cf-ai-costs').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
  await view.getByRole('button', { name: 'Exit example', exact: true }).click();
  await expect(view.getByRole('button', { name: 'Explore example costs', exact: true })).toBeVisible();
});
