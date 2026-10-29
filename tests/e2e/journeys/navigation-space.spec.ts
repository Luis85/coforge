import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

for (const theme of ['light', 'dark']) test(`project navigation stays readable without redundant banners in ${theme}`, async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto('/#surface=node-1'); await expect(page.locator('html')).toHaveAttribute('data-prototype-ready', 'true');
  await page.evaluate(theme => { document.body.classList.remove('theme-light', 'theme-dark'); document.body.classList.add(`theme-${theme}`); }, theme);
  const host = page.locator('[data-plugin-ui="coforge"]').first();
  const studio = page.locator('.cf-studio');
  const sidebar = page.locator('.cf-sidebar'); const nav = sidebar.getByRole('navigation', { name: 'CoForge navigation', exact: true });
  const groups = nav.locator('.cf-navigation-groups');
  await mkdir('reports/navigation-space', { recursive: true });
  // Exercise the disconnected native-host copy without contacting Twitch.
  await sidebar.locator('.cf-streamer-profile small').evaluate(element => { element.textContent = 'Twitch authorization expired or was revoked. Reconnect this account.'; });
  for (const width of [980, 1280]) {
    await host.evaluate((element, width) => { element.style.width = `${width}px`; element.style.maxWidth = 'none'; element.style.height = '740px'; element.style.minHeight = '0'; element.style.maxHeight = 'none'; }, width);
    await studio.evaluate(element => { element.style.height = '740px'; element.style.minHeight = '0'; });
    expect(await sidebar.evaluate(element => element.getBoundingClientRect().height)).toBe(740);
    await expect(sidebar).toHaveCSS('width', '240px');
    expect(await groups.evaluate(element => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
    expect(await sidebar.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    const rows = await nav.locator('.cf-nav-item > span:nth-child(2)').evaluateAll(elements => elements.map(element => ({ height: element.getBoundingClientRect().height, lineHeight: parseFloat(getComputedStyle(element).lineHeight) })));
    expect(rows.every(row => row.height <= row.lineHeight + 1)).toBe(true);
    await sidebar.screenshot({ path: `reports/navigation-space/sidebar-${theme}-${width}.png` });
  }
  for (const label of ['Idea board', 'The Council', 'Service Design', 'Project settings']) {
    await sidebar.getByRole('button', { name: label === 'Idea board' ? /^Idea board/ : label, exact: label !== 'Idea board' }).first().click();
    await expect(page.locator('.cf-project-work-context')).toHaveCount(0);
    await expect(page.locator('.cf-board-decisions')).toHaveCount(0);
    await expect(sidebar.locator('.cf-project-selector-id')).toContainText('CFP-001');
    if (label === 'Service Design') await expect(page.locator('.cf-service-design')).toBeVisible();
    if (label === 'Idea board') {
      await expect(page.getByRole('tab', { name: /^Needs review/ })).toBeVisible();
      await expect(page.getByRole('tab', { name: /^Flagged/ })).toBeVisible();
      await page.locator('.cf-board-page').screenshot({ path: `reports/navigation-space/board-${theme}.png` });
    }
  }
  await host.evaluate(element => { element.style.height = '460px'; });
  await studio.evaluate(element => { element.style.height = '460px'; });
  await nav.getByRole('button', { name: 'Operations', exact: true }).scrollIntoViewIfNeeded();
  const reachable = await nav.getByRole('button', { name: 'Operations', exact: true }).evaluate(button => { const bounds = button.getBoundingClientRect(); const point = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2); return point === button || button.contains(point); });
  expect(reachable).toBe(true);
});
