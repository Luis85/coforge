import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';

for (const theme of ['light', 'dark']) {
  test(`Design column remains readable and reachable in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/#surface=node-1');
    await expect(page.locator('html')).toHaveAttribute('data-prototype-ready', 'true');
    await page.getByRole('navigation', { name: 'CoForge navigation' }).getByRole('button', { name: /^Idea board/ }).click();
    await page.evaluate(theme => {
      document.body.classList.toggle('theme-light', theme === 'light');
      document.body.classList.toggle('theme-dark', theme === 'dark');
    }, theme);
    const board = page.locator('.cf-board-page');
    const design = page.locator('.cf-column-design');
    await expect(page.locator('.cf-column-header h2')).toHaveText(['Inbox', 'Up next', 'Design', 'In progress', 'Accepted']);
    await expect(design).toContainText('A firefly trail after sunset');
    expect((await new AxeBuilder({ page }).include('.cf-board-page').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
    await mkdir('reports/design-step', { recursive: true });
    for (const width of [1920, 720]) {
      await page.setViewportSize({ width, height: 1080 });
      await design.scrollIntoViewIfNeeded();
      await expect(design.getByRole('heading', { name: 'Design', exact: true })).toBeInViewport();
      expect(await board.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await board.screenshot({ path: `reports/design-step/board-${theme}-${width}.png` });
    }
  });
}
