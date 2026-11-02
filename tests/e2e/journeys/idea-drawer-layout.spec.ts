import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const sections = ['Overview', 'Workflow runs', 'Plan & Design', 'Increment', 'Sessions', 'AI costs', 'Activity'];
for (const theme of ['light', 'dark']) test(`request drawer navigation resists native styling with a wide sidebar and narrow rows in ${theme}`, async ({ page }) => {
  await page.goto('/#surface=node-1');
  await expect(page.locator('html')).toHaveAttribute('data-prototype-ready', 'true');
  await page.evaluate(value => { document.body.classList.toggle('theme-light', value === 'light'); document.body.classList.toggle('theme-dark', value === 'dark'); }, theme);
  // Match native wrapper rules; the request's own navigation must retain its intended layout.
  await page.addStyleTag({ content: '.ps--coforge .cf-studio nav { flex-direction: column; flex: 0 0 12rem; } .ps--coforge .cf-studio nav button { width: 100%; }' });
  await page.locator('.cf-sidebar').getByRole('button', { name: /^Idea board/ }).click();
  await page.locator('.cf-idea-card .cf-idea-open').first().click();
  const drawer = page.locator('.cf-idea-drawer'); const tabs = drawer.getByRole('navigation', { name: 'Idea sections', exact: true });
  await expect(drawer).toHaveCSS('opacity', '1');
  await mkdir('reports/idea-drawer-layout', { recursive: true });
  for (const width of [1280, 480, 360]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.locator('.cf-studio').evaluate(element => { element.style.height = '1000px'; });
    expect(await tabs.getByRole('button').evaluateAll(buttons => buttons.map(button => button.getAttribute('aria-label')))).toEqual(sections);
    const layout = await tabs.evaluate(element => {
      const bounds = element.getBoundingClientRect(); const style = getComputedStyle(element);
      const content = element.parentElement!.querySelector('.cf-idea-main')!.getBoundingClientRect();
      const buttons = [...element.querySelectorAll('button')].map(button => { const box = button.getBoundingClientRect(); return { top: box.top, bottom: box.bottom, left: box.left, right: box.right, width: box.width }; });
      return { height: bounds.height, top: bounds.top, bottom: bounds.bottom, left: bounds.left, right: bounds.right, direction: style.flexDirection, wrap: style.flexWrap, buttons, content: { top: content.top, left: content.left }, fits: element.scrollWidth <= element.clientWidth + 1 };
    });
    expect(layout.buttons).toHaveLength(7); expect(layout.fits).toBe(true);
    if (width > 700) {
      expect(layout.direction).toBe('column'); expect(layout.content.left).toBeGreaterThanOrEqual(layout.right - 1);
      for (let index = 1; index < layout.buttons.length; index++) expect(layout.buttons[index]!.top).toBeGreaterThanOrEqual(layout.buttons[index - 1]!.bottom);
    } else {
      expect(layout.direction).toBe('row'); expect(layout.wrap).toBe('wrap'); expect(layout.height).toBeLessThanOrEqual(110);
      expect(layout.content.top).toBeGreaterThanOrEqual(layout.bottom - 1);
      expect(Math.abs(layout.buttons[0]!.top - layout.buttons[1]!.top)).toBeLessThan(1);
      expect(layout.buttons[1]!.left - layout.buttons[0]!.right).toBeGreaterThanOrEqual(8);
    }
    for (const button of layout.buttons) {
      expect(button.width).toBeGreaterThan(0); expect(button.left).toBeGreaterThanOrEqual(layout.left - 1); expect(button.right).toBeLessThanOrEqual(layout.right + 1);
      expect(button.top).toBeGreaterThanOrEqual(layout.top - 1); expect(button.bottom).toBeLessThanOrEqual(layout.bottom + 1);
    }
    expect(await drawer.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await drawer.screenshot({ path: `reports/idea-drawer-layout/tabs-${theme}-${width}.png` });
  }
});
