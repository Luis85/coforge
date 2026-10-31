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
    await expect(tabs.getByRole('button')).toHaveText(['Overview', 'Plan & Design', 'Increment', 'Workflow runs', 'Activity']);
    const layout = await tabs.evaluate(element => {
      const bounds = element.getBoundingClientRect(); const style = getComputedStyle(element);
      const buttons = [...element.querySelectorAll('button')].map(button => { const box = button.getBoundingClientRect(); return { top: box.top, bottom: box.bottom, left: box.left, right: box.right, width: box.width }; });
      const padding = Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight);
      return { width: bounds.width, contentWidth: bounds.width - padding, height: bounds.height, top: bounds.top, bottom: bounds.bottom, left: bounds.left, right: bounds.right, gap: Number.parseFloat(style.columnGap) || 0, basis: style.flexBasis, buttons, fits: element.scrollWidth <= element.clientWidth + 1 };
    });
    expect(layout.buttons).toHaveLength(5); expect(layout.basis).toBe('auto'); expect(layout.fits).toBe(true);
    expect(layout.height).toBeLessThan(110);
    expect(Math.abs(layout.buttons[0]!.top - layout.buttons[1]!.top)).toBeLessThan(1);
    expect(layout.buttons[1]!.left - layout.buttons[0]!.right).toBeGreaterThanOrEqual(8);
    const neededWidth = layout.buttons.reduce((sum, button) => sum + button.width, 0) + layout.gap * (layout.buttons.length - 1);
    if (neededWidth <= layout.contentWidth + 1) expect(Math.max(...layout.buttons.map(button => button.top)) - Math.min(...layout.buttons.map(button => button.top))).toBeLessThan(1);
    const rows = layout.buttons.reduce<Array<typeof layout.buttons>>((groups, button) => {
      const row = groups.find(group => Math.abs(group[0]!.top - button.top) < 1);
      if (row) row.push(button); else groups.push([button]);
      return groups;
    }, []);
    for (const [index, row] of rows.entries()) {
      for (let button = 1; button < row.length; button++) expect(row[button]!.left - row[button - 1]!.right).toBeGreaterThanOrEqual(8);
      if (index) expect(row[0]!.top).toBeGreaterThanOrEqual(Math.max(...rows[index - 1]!.map(button => button.bottom)));
    }
    for (const button of layout.buttons) { expect(button.width).toBeLessThan(layout.width / 2); expect(button.left).toBeGreaterThanOrEqual(layout.left); expect(button.right).toBeLessThanOrEqual(layout.right + 1); expect(button.top).toBeGreaterThanOrEqual(layout.top); expect(button.bottom).toBeLessThanOrEqual(layout.bottom + 1); }
    expect(await drawer.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await drawer.screenshot({ path: `reports/idea-drawer-layout/tabs-${theme}-${width}.png` });
  }
});
