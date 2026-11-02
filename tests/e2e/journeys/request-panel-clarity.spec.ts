import { expect, test } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';

const sections = ['Overview', 'Workflow runs', 'Plan & Design', 'Increment', 'Sessions', 'AI costs', 'Activity'];
const sizes = [{ width: 1280, height: 900 }, { width: 480, height: 600 }, { width: 360, height: 600 }];

for (const theme of ['light', 'dark']) for (const size of sizes) {
  test(`request detail tasks stay readable and keyboard reachable in ${theme} at ${size.width}px`, async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('/#surface=node-1');
    await expect(page.locator('html')).toHaveAttribute('data-prototype-ready', 'true');
    await page.evaluate(value => { document.body.classList.toggle('theme-light', value === 'light'); document.body.classList.toggle('theme-dark', value === 'dark'); }, theme);
    await page.locator('.cf-sidebar').getByRole('button', { name: /^Idea board/ }).click();
    await page.locator('.cf-idea-card').filter({ has: page.locator('.cf-idea-id', { hasText: /^CF-105$/ }) }).locator('.cf-idea-open').click();
    await page.setViewportSize(size);
    await page.locator('.cf-studio').evaluate((element, height) => { element.style.height = `${height}px`; }, size.height);
    const drawer = page.locator('.cf-idea-drawer'); const nav = drawer.getByRole('navigation', { name: 'Idea sections', exact: true });
    const scroll = drawer.locator('.cf-idea-scroll');
    await mkdir('reports/request-panel/after', { recursive: true });
    for (const [index, section] of sections.entries()) {
      const control = nav.getByRole('button', { name: section, exact: true });
      await control.focus(); await control.press('Enter');
      await expect(control).toHaveAttribute('aria-pressed', 'true');
      await expect(drawer.locator('.cf-idea-pane-intro h3')).toHaveText(section);
      await expect(drawer.locator('.cf-idea-pane-intro p')).not.toBeEmpty();
      await expect.poll(() => scroll.evaluate(element => element.scrollTop)).toBe(0);
      const layout = await drawer.evaluate(element => {
        const box = element.getBoundingClientRect(); const content = element.querySelector('.cf-idea-scroll')!.getBoundingClientRect();
        const close = element.querySelector('.cf-idea-close')!.getBoundingClientRect();
        return { fits: element.scrollWidth <= element.clientWidth + 1, contentHeight: content.height,
          closeInside: close.left >= box.left && close.right <= box.right + 1 && close.top >= box.top && close.bottom <= box.bottom + 1 };
      });
      expect(layout.fits).toBe(true); expect(layout.contentHeight).toBeGreaterThanOrEqual(100); expect(layout.closeInside).toBe(true);
      if (['Workflow runs', 'Sessions', 'AI costs'].includes(section)) await expect(drawer.locator('.cf-idea-footer')).toHaveCount(0);
      if (section !== 'Increment') {
        await expect(drawer.getByRole('button', { name: 'Accept increment', exact: true })).toHaveCount(0);
        await expect(drawer.getByRole('button', { name: 'Request changes', exact: true })).toHaveCount(0);
      }
      if (size.width === 1280) {
        const analysis = await new AxeBuilder({ page }).include('.cf-idea-drawer').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        if (analysis.violations.length) await testInfo.attach(`axe-${section}.json`, { body: JSON.stringify(analysis.violations, null, 2), contentType: 'application/json' });
        expect(analysis.violations.map(issue => ({ id: issue.id, targets: issue.nodes.map(node => node.target) }))).toEqual([]);
      }
      await drawer.screenshot({ path: `reports/request-panel/after/${index + 1}-${section.toLowerCase().replace(/[^a-z]+/g, '-')}-${theme}-${size.width}.png` });
      const footer = drawer.locator('.cf-idea-footer');
      if (await footer.count()) {
        await footer.scrollIntoViewIfNeeded();
        expect(await footer.evaluate(element => {
          const drawerBounds = element.closest('.cf-idea-drawer')!.getBoundingClientRect();
          return [...element.querySelectorAll('button, textarea')].every(control => {
            const box = control.getBoundingClientRect();
            return box.left >= drawerBounds.left && box.right <= drawerBounds.right + 1 && box.top >= drawerBounds.top && box.bottom <= drawerBounds.bottom + 1;
          });
        })).toBe(true);
        if (section === 'Increment') await drawer.screenshot({ path: `reports/request-panel/after/4-increment-decision-${theme}-${size.width}.png` });
      }
      await scroll.evaluate(element => { element.scrollTop = element.scrollHeight; });
    }
    await expect(nav.getByRole('button')).toHaveCount(7); expect(errors).toEqual([]);
    const close = drawer.getByRole('button', { name: 'Close idea details', exact: true });
    await close.focus(); await close.press('Enter'); await expect(drawer).toHaveCount(0);
  });
}

test('an invalid review note explains the correction beside the decision in a short pane', async ({ page }) => {
  await page.goto('/#surface=node-1');
  await expect(page.locator('html')).toHaveAttribute('data-prototype-ready', 'true');
  await page.locator('.cf-sidebar').getByRole('button', { name: /^Idea board/ }).click();
  await page.locator('.cf-idea-card').filter({ has: page.locator('.cf-idea-id', { hasText: /^CF-105$/ }) }).locator('.cf-idea-open').click();
  await page.setViewportSize({ width: 360, height: 600 });
  await page.locator('.cf-studio').evaluate(element => { element.style.height = '600px'; });
  const drawer = page.locator('.cf-idea-drawer');
  await drawer.getByRole('navigation', { name: 'Idea sections', exact: true }).getByRole('button', { name: 'Increment', exact: true }).click();
  await drawer.getByRole('button', { name: 'Request changes', exact: true }).click();
  const error = drawer.locator('.cf-idea-footer [role="alert"]');
  await expect(error).toContainText('at least 3 characters');
  await expect(drawer.locator('.cf-idea-footer textarea')).toHaveAttribute('aria-invalid', 'true');
  await expect(drawer.locator('.cf-idea-footer textarea')).toHaveAttribute('aria-describedby', 'cf-idea-review-note-error');
  await expect(drawer.getByRole('alert')).toHaveCount(1);
  const visible = await error.evaluate(element => {
    const box = element.getBoundingClientRect(); const pane = element.closest('.cf-idea-drawer')!.getBoundingClientRect();
    return box.top >= pane.top && box.bottom <= pane.bottom;
  });
  expect(visible).toBe(true);
  await drawer.screenshot({ path: 'reports/request-panel/after/4-increment-validation-360.png' });
});
