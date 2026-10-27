import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';

test('shows honest offline channel controls and explicitly tests project-addressed bug reports', async ({ page }) => {
  await page.goto('/#surface=node-1');
  await expect(page.locator('html')).toHaveAttribute('data-prototype-ready', 'true');
  await mkdir('reports/twitch-review/after', { recursive: true });
  await page.locator('.cf-project-switcher').click();
  await expect(page.locator('.cf-readable-project-id')).toHaveText('CFP-001');
  await test.info().attach('Project IDs', { body: await page.screenshot({ path: 'reports/twitch-review/after/03-projects.png' }), contentType: 'image/png' });
  await page.getByRole('button', { name: 'Stream chat', exact: true }).click();
  await expect(page.getByText('No Twitch channel connected', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Connect streamer', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Save channel details', exact: true })).toBeDisabled();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
  await test.info().attach('Channel desktop', { body: await page.screenshot({ path: 'reports/twitch-review/after/04-channel-desktop.png', fullPage: true }), contentType: 'image/png' });
  await page.setViewportSize({ width: 360, height: 800 });
  const size = await page.evaluate(() => ({ width: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
  expect(size.content).toBeLessThanOrEqual(size.width);
  await test.info().attach('Channel narrow', { body: await page.screenshot({ path: 'reports/twitch-review/after/05-channel-narrow.png', fullPage: true }), contentType: 'image/png' });
  await page.getByRole('button', { name: 'Test commands locally', exact: true }).click();
  await page.getByLabel('Simulated viewer name').fill('Bug reporter');
  await page.getByLabel('Chat message', { exact: true }).fill('!bug CFP-001 The moon gate crashes the game');
  await page.getByRole('button', { name: 'Send chat message', exact: true }).click();
  await expect(page.getByLabel('Chat message', { exact: true })).toHaveValue('');
  await page.getByRole('button', { name: 'Idea board', exact: true }).click();
  await expect(page.locator('.cf-idea-card').filter({ hasText: 'The moon gate crashes the game' })).toContainText('Bug');
});
