import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';

for (const theme of ['light', 'dark']) {
  test(`example cleanup preserves manual work and requires reviewed confirmation in ${theme}`, async ({ page }) => {
    await page.goto('/#surface=node-1');
    await expect(page.locator('html')).toHaveAttribute('data-prototype-ready', 'true');
    await page.evaluate(theme => {
      document.body.classList.toggle('theme-light', theme === 'light');
      document.body.classList.toggle('theme-dark', theme === 'dark');
    }, theme);
    const nav = page.locator('.cf-sidebar');
    await nav.getByRole('button', { name: /^Idea board/ }).click();
    await page.getByRole('button', { name: 'New request', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'New request', exact: true });
    await dialog.getByLabel('The idea', { exact: true }).fill('Keep my real manually authored idea');
    await dialog.getByLabel('A little more context', { exact: true }).fill('A real description survives the cleanup.');
    await dialog.getByRole('button', { name: 'Add to the board', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    const notification = page.getByRole('button', { name: 'Dismiss notification', exact: true });
    if (await notification.count()) await notification.first().click();
    await nav.getByRole('button', { name: 'Project settings', exact: true }).click();
    const cleanup = page.getByRole('region', { name: 'Remove example and local-test content', exact: true });
    await cleanup.getByRole('button', { name: 'Preview example cleanup', exact: true }).click();
    await expect(cleanup).toContainText('15 requests selected');
    await expect(cleanup.getByRole('button', { name: 'Remove selected examples and local content', exact: true })).toBeDisabled();
    await mkdir('reports/example-cleanup', { recursive: true });
    for (const width of [1280, 360]) {
      await page.setViewportSize({ width, height: 900 });
      await expect.poll(() => page.locator('.cf-content').evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
      expect((await new AxeBuilder({ page }).include('.cf-example-cleanup').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
      await cleanup.screenshot({ path: `reports/example-cleanup/preview-${theme}-${width}.png` });
    }
    await cleanup.getByRole('button', { name: 'Keep content', exact: true }).click();
    await cleanup.getByRole('button', { name: 'Preview example cleanup', exact: true }).click();
    await expect(cleanup).toContainText('15 requests selected');
    await cleanup.getByRole('checkbox', { name: 'I reviewed the selected requests and local content above and want to remove them.', exact: true }).check();
    await cleanup.getByRole('button', { name: 'Remove selected examples and local content', exact: true }).click();
    await expect(cleanup.getByRole('status')).toContainText('Removed 15');
    await nav.getByRole('button', { name: /^Idea board/ }).click();
    await expect(page.locator('.cf-idea-card')).toHaveCount(1);
    await expect(page.locator('.cf-idea-card')).toContainText('Keep my real manually authored idea');
    await expect(page.locator('.cf-idea-card')).not.toContainText('pet the forest foxes');
  });
}
