import { expect, test } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';

for (const theme of ['light', 'dark']) test(`native settings MCP panel describes private access and remains accessible in ${theme}`, async ({ page }) => {
  await page.goto('/#surface=node-2');
  await expect(page.locator('html')).toHaveAttribute('data-prototype-ready', 'true');
  await page.evaluate(value => { document.body.classList.toggle('theme-light', value === 'light'); document.body.classList.toggle('theme-dark', value === 'dark'); }, theme);
  const panel = page.getByRole('region', { name: 'Local MCP server', exact: true });
  await expect(panel.getByRole('heading', { name: 'Local MCP server', exact: true })).toBeVisible();
  await expect(panel).toContainText('including private ones');
  await expect(panel).toContainText('Existing entries are preserved');
  await expect(panel.getByRole('button', { name: 'Activate MCP', exact: true })).toBeDisabled();
  await expect(panel.getByRole('button', { name: 'Deactivate MCP', exact: true })).toBeDisabled();
  await expect(panel).toContainText('MCP activation is available in the desktop plugin');
  await mkdir('reports/merged-native-mcp', { recursive: true });
  for (const width of [1280, 360]) {
    await page.setViewportSize({ width, height: 1000 });
    await panel.evaluate(element => element.scrollIntoView({ block: 'center', inline: 'nearest' }));
    expect(await panel.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    for (const button of await panel.getByRole('button').all())
      expect(await button.evaluate(element => { const bounds = element.getBoundingClientRect(); const target = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2); return target === element || !!target && element.contains(target); })).toBe(true);
    await panel.screenshot({ path: `reports/merged-native-mcp/panel-${theme}-${width}.png` });
    expect((await new AxeBuilder({ page }).include('.cf-mcp-settings').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
  }
});
