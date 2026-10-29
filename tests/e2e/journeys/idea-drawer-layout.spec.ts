import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

for (const theme of ['light', 'dark']) test(`request drawer section tabs resist native navigation styling and stay compact in ${theme}`, async ({ page }) => {
  await page.goto('/#surface=node-1');
  await expect(page.locator('html')).toHaveAttribute('data-prototype-ready', 'true');
  await page.evaluate(value => { document.body.classList.toggle('theme-light', value === 'light'); document.body.classList.toggle('theme-dark', value === 'dark'); }, theme);
  // Match the native wrapper's generic nav specificity and layout, independent of harness ancestors.
  await page.addStyleTag({ content: '.ps--coforge .cf-studio nav { flex-direction: column; flex: 0 0 12rem; } .ps--coforge .cf-studio nav button { width: 100%; }' });
  await page.locator('.cf-sidebar').getByRole('button', { name: /^Idea board/ }).click();
  await page.locator('.cf-idea-card .cf-idea-open').first().click();
  const drawer = page.locator('.cf-idea-drawer'); const tabs = drawer.getByRole('navigation', { name: 'Idea sections', exact: true });
  await expect(drawer).toHaveCSS('opacity', '1');
  await expect(tabs).toHaveCSS('flex-direction', 'row'); await expect(tabs).toHaveCSS('flex-wrap', 'wrap');
  await mkdir('reports/idea-drawer-layout', { recursive: true });
  for (const width of [1280, 480, 360]) {
    await page.setViewportSize({ width, height: 1000 });
    const layout = await tabs.evaluate(element => {
      const bounds = element.getBoundingClientRect();
      const buttons = [...element.querySelectorAll('button')].map(button => { const box = button.getBoundingClientRect(); return { top: box.top, left: box.left, right: box.right, width: box.width }; });
      return { width: bounds.width, height: bounds.height, left: bounds.left, right: bounds.right, basis: getComputedStyle(element).flexBasis, buttons, fits: element.scrollWidth <= element.clientWidth + 1 };
    });
    expect(layout.buttons).toHaveLength(4); expect(layout.basis).toBe('auto'); expect(layout.fits).toBe(true);
    expect(layout.height).toBeLessThan(110);
    expect(Math.abs(layout.buttons[0]!.top - layout.buttons[1]!.top)).toBeLessThan(1);
    expect(layout.buttons[1]!.left - layout.buttons[0]!.right).toBeGreaterThanOrEqual(8);
    if (width >= 480) expect(Math.max(...layout.buttons.map(button => button.top)) - Math.min(...layout.buttons.map(button => button.top))).toBeLessThan(1);
    for (const button of layout.buttons) { expect(button.width).toBeLessThan(layout.width / 2); expect(button.left).toBeGreaterThanOrEqual(layout.left); expect(button.right).toBeLessThanOrEqual(layout.right + 1); }
    expect(await drawer.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await drawer.screenshot({ path: `reports/idea-drawer-layout/tabs-${theme}-${width}.png` });
  }
});
