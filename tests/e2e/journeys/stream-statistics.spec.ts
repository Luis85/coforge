import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
for (const theme of ['light', 'dark']) test(`stream statistics comparison, inspection and reflow in ${theme}`, async ({ page }) => {
  await page.goto('/#surface=node-1'); await expect(page.locator('html')).toHaveAttribute('data-prototype-ready', 'true');
  await page.evaluate(theme => { document.body.classList.toggle('theme-dark', theme === 'dark'); document.body.classList.toggle('theme-light', theme === 'light'); }, theme);
  await page.getByRole('button', { name: 'Statistics', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No recorded streams yet', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Explore sample statistics', exact: true }).click();
  await expect(page.getByText('Example statistics · synthetic data, not channel observations. Nothing is saved.', { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Concurrent viewers over elapsed stream time', exact: true })).toBeVisible();
  const legend = page.getByRole('list', { name: 'Displayed streams' });
  await expect(legend.getByRole('listitem')).toHaveCount(2);
  await page.getByLabel('Add comparison stream', { exact: true }).selectOption('example-stream-2');
  await expect(legend.getByRole('listitem')).toHaveCount(3);
  await page.getByLabel('Add comparison stream', { exact: true }).selectOption('example-stream-3');
  await expect(legend.getByRole('listitem')).toHaveCount(4);
  for (let index = 0; index < 4; index++) {
    const stroke = await page.locator(`svg g.cf-stat-series-${index} .cf-chart-line`).first().evaluate(path => getComputedStyle(path).stroke);
    expect(stroke).not.toBe('none'); expect(stroke).not.toBe('transparent');
  }
  await expect(page.getByLabel('Add comparison stream', { exact: true })).toBeDisabled();
  const cursor = page.getByRole('slider', { name: 'Inspect elapsed minute', exact: true });
  await cursor.focus(); await cursor.press('Home'); await cursor.press('ArrowRight');
  await expect(cursor).toBeFocused(); await expect(cursor).toHaveAttribute('aria-valuetext', /Elapsed/);
  await mkdir('reports/stream-statistics', { recursive: true });
  for (const width of [1280, 360]) {
    await page.setViewportSize({ width, height: 900 });
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
    const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, content: document.documentElement.scrollWidth })); expect(dimensions.content).toBeLessThanOrEqual(dimensions.width);
    await test.info().attach(`statistics-${theme}-${width}`, { body: await page.locator('.cf-statistics-page').screenshot({ path: `reports/stream-statistics/${theme}-${width}.png` }), contentType: 'image/png' });
  }
  await legend.getByRole('listitem').nth(1).getByRole('button').click(); await expect(legend.getByRole('listitem')).toHaveCount(3);
  await page.getByLabel('Statistics metric', { exact: true }).selectOption('follower-change');
  await expect(page.getByRole('img', { name: 'Observed follower change over elapsed stream time', exact: true })).toBeVisible();
  await page.getByText('Recorded samples for selected stream', { exact: true }).click();
  await expect(page.locator('.cf-statistics-samples tbody tr')).toHaveCount(50);
  await page.getByRole('button', { name: 'Next samples', exact: true }).click(); await expect(page.locator('.cf-statistics-samples tbody tr')).toHaveCount(8);
  await page.getByLabel('Statistics metric', { exact: true }).selectOption('cpu');
  await expect(page.getByRole('img', { name: 'OBS CPU usage over elapsed stream time', exact: true })).toBeVisible();
  await page.getByLabel('Statistics metric', { exact: true }).selectOption('disk');
  await expect(page.getByRole('heading', { name: 'No observations for this metric', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export selected stream JSON', exact: true })).toBeDisabled();
});
