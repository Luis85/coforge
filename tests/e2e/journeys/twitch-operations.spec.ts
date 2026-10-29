import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';

for (const theme of ['light', 'dark']) {
  for (const width of [1440, 420]) {
  test(`Twitch operations keeps offline tasks usable and honest in ${theme} ${width}px leaves`, async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('/#surface=node-1');
    await expect(page.locator('html')).toHaveAttribute('data-prototype-ready', 'true');
    await page.evaluate(value => { document.body.classList.toggle('theme-dark', value === 'dark'); document.body.classList.toggle('theme-light', value === 'light'); }, theme);
    await page.getByRole('button', { name: 'Twitch operations', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Twitch operations', exact: true })).toBeVisible();
    await expect(page.getByText('Live Twitch operations are available in Obsidian.', { exact: false })).toBeVisible();
    await mkdir('reports/twitch-operations', { recursive: true });
      await page.setViewportSize({ width, height: 1000 });
      const root = page.locator('.cf-twitch-operations-page');
      for (const tab of ['activity', 'moderation', 'engagement', 'broadcast', 'channel', 'content', 'schedule', 'data']) {
        await page.locator(`[data-twitch-page="${tab}"]`).click();
        await expect(root).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
        expect((await new AxeBuilder({ page }).include('.cf-twitch-operations-page').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
      }
      await page.locator('[data-twitch-page="engagement"]').click();
      await page.getByLabel('Reward title', { exact: false }).fill('Community spotlight');
      await page.getByLabel('Channel Points cost', { exact: false }).fill('500');
      await expect(page.getByRole('button', { name: 'Review action', exact: true })).toBeDisabled();
      await page.locator('[data-twitch-page="activity"]').click();
      await page.locator('[data-twitch-page="engagement"]').click();
      await expect(page.getByLabel('Reward title', { exact: false })).toHaveValue('Community spotlight');
      await test.info().attach(`${theme}-${width}`, { body: await page.screenshot({ path: `reports/twitch-operations/${theme}-${width}.png`, fullPage: true }), contentType: 'image/png' });
    expect(errors).toEqual([]);
  });
  }
}
