import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';

for (const theme of ['light', 'dark']) test(`guided OBS and Twitch setup is honest and accessible in ${theme}`, async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/#surface=node-1');
  await expect(page.locator('html')).toHaveAttribute('data-prototype-ready', 'true');
  await page.evaluate(theme => { document.body.classList.toggle('theme-dark', theme === 'dark'); document.body.classList.toggle('theme-light', theme === 'light'); }, theme);
  await page.getByRole('button', { name: 'Guided setup', exact: true }).click();
  const guide = page.getByRole('region', { name: 'Guided stream setup', exact: true });
  await expect(guide).toBeVisible();
  await expect(guide.getByRole('button', { name: 'Check installed OBS' })).toBeDisabled();
  await mkdir('reports/guided-setup', { recursive: true });
  for (const width of [1280, 360]) {
    await page.setViewportSize({ width, height: 900 });
    const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.width);
    await test.info().attach(`setup-tools-${theme}-${width}`, { body: await guide.screenshot({ path: `reports/guided-setup/tools-${theme}-${width}.png` }), contentType: 'image/png' });
  }
  for (let step = 0; step < 5; step++) {
    await guide.getByRole('list', { name: 'Setup steps' }).getByRole('button').nth(step).click();
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
  }
  await guide.getByLabel('I reviewed the destination, audio and video in OBS', { exact: true }).check();
  await expect(guide.getByRole('button', { name: 'Finish setup', exact: true })).toBeDisabled();
  const navigation = page.getByRole('navigation', { name: 'Stream studio pages' });
  await navigation.getByRole('button', { name: 'Broadcast', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Go live', exact: true })).toBeDisabled();
  await navigation.getByRole('button', { name: 'Setup', exact: true }).click();
  await expect(guide.getByLabel('I reviewed the destination, audio and video in OBS', { exact: true })).toBeChecked();
  await guide.getByRole('list', { name: 'Setup steps' }).getByRole('button').nth(3).click();
  await expect(guide.getByRole('button', { name: 'Connect streamer', exact: true })).toBeDisabled();
  for (const width of [1280, 360]) {
    await page.setViewportSize({ width, height: 900 });
    await test.info().attach(`setup-twitch-${theme}-${width}`, { body: await guide.screenshot({ path: `reports/guided-setup/twitch-${theme}-${width}.png` }), contentType: 'image/png' });
  }
  await guide.getByRole('button', { name: 'Skip setup for now', exact: true }).click();
  await expect(guide).toHaveCount(0);
  await page.getByRole('button', { name: 'Guided setup', exact: true }).click();
  await expect(guide).toBeVisible();
});
