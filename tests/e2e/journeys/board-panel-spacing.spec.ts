import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
test('wide backlog filters use the space up to the chat panel', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/#surface=node-1');
  await expect(page.locator('html')).toHaveAttribute('data-prototype-ready', 'true');
  await mkdir('reports/twitch-review/after', { recursive: true });
  const measurements: Array<{ filter: string; gap: number }> = [];
  for (const name of [/All requests/, /Needs review/]) {
    await page.getByRole('tab', { name }).click();
    const gap = await page.evaluate(() => {
      const columns = [...document.querySelectorAll('.cf-kanban-column')];
      const right = columns.at(-1)?.getBoundingClientRect().right ?? 0;
      return document.querySelector('.cf-workspace-body > .cf-chat-panel')!.getBoundingClientRect().left - right;
    });
    expect(gap).toBeLessThanOrEqual(36);
    expect(gap).toBeGreaterThanOrEqual(16);
    measurements.push({ filter: name.source, gap });
    const shot = await page.screenshot({ path: `reports/twitch-review/after/${name.source === 'All requests' ? '01-wide-board' : '02-filtered-board'}.png` });
    await test.info().attach(name.source, { body: shot, contentType: 'image/png' });
  }
  await writeFile('reports/twitch-review/after/spacing.json', JSON.stringify(measurements, null, 2));
});
