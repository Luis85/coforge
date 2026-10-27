import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
for (const theme of ['dark', 'light']) test(`streamer preparation and channel editor in ${theme}`, async ({ page }) => {
  await page.goto('/#surface=node-1'); await expect(page.locator('html')).toHaveAttribute('data-prototype-ready', 'true');
  await page.evaluate(theme => { document.body.classList.toggle('theme-dark', theme === 'dark'); document.body.classList.toggle('theme-light', theme === 'light'); }, theme);
  await expect(page.getByRole('heading', { name: 'Stream studio', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Go live', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Connect OBS', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Open OBS Studio', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Export stream JSON', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Recorded stream', { exact: true })).toBeDisabled();
  await expect(page.getByLabel('OBS executable (optional)', { exact: true })).toBeVisible();
  await expect(page.getByText('This preview does not connect to OBS. Use these controls inside Obsidian.', { exact: true })).toBeVisible();
  await mkdir('reports/streamer-workflow', { recursive: true });
  for (const width of [1280, 360]) {
    await page.setViewportSize({ width, height: 900 });
    const size = await page.evaluate(() => ({ width: document.documentElement.clientWidth, content: document.documentElement.scrollWidth })); expect(size.content).toBeLessThanOrEqual(size.width);
    await test.info().attach(`studio-${theme}-${width}`, { body: await page.screenshot({ path: `reports/streamer-workflow/studio-${theme}-${width}.png`, fullPage: true }), contentType: 'image/png' });
  }
  await page.getByText('Twitch channel and branding', { exact: true }).click();
  await expect(page.getByLabel('Channel tags (comma separated)', { exact: true })).toBeDisabled();
  await expect(page.getByLabel('Broadcast language', { exact: true })).toBeDisabled();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
});
test('project settings keep a separate general agent prompt', async ({ page }) => {
  await page.goto('/#surface=node-1'); await expect(page.locator('html')).toHaveAttribute('data-prototype-ready', 'true');
  await page.getByRole('button', { name: 'Studio settings', exact: true }).click();
  await page.getByLabel('General agent prompt', { exact: true }).fill('Use Rust and Bevy. Keep increments small.');
  await page.getByRole('button', { name: 'Save settings', exact: true }).click();
  await expect(page.getByLabel('General agent prompt', { exact: true })).toHaveValue('Use Rust and Bevy. Keep increments small.');
  await page.getByRole('button', { name: 'Stream studio', exact: true }).click();
  await page.getByRole('button', { name: 'Studio settings', exact: true }).click();
  await expect(page.getByLabel('General agent prompt', { exact: true })).toHaveValue('Use Rust and Bevy. Keep increments small.');
});
