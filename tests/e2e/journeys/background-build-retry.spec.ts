import { expect, test } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
import { backgroundRetryProofBundle } from '../support/background-retry-proof-bundle';

let script = '';
test.beforeAll(async () => { script = await backgroundRetryProofBundle(); });
for (const [theme, width] of [['light', 360], ['dark', 1280]] as const) {
  test(`reviewed background retry stays scoped, readable and keyboard accessible in ${theme} at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 }); await page.goto('/#surface=node-1');
    await expect(page.locator('html')).toHaveAttribute('data-prototype-ready', 'true');
    await page.evaluate(theme => { document.body.classList.toggle('theme-dark', theme === 'dark'); document.body.classList.toggle('theme-light', theme === 'light'); }, theme);
    // Trusted automation loads this test-only composition without changing the page's CSP.
    await page.evaluate(script);
    const dialog = page.getByRole('dialog', { name: 'Retry presentation proof', exact: true });
    const entry = dialog.getByRole('button', { name: 'Retry Build in background', exact: true });
    await entry.focus(); await entry.press('Enter');
    const panel = dialog.getByRole('region', { name: 'Review background Build retry', exact: true });
    await expect(panel).toBeVisible(); await expect(panel).toBeFocused();
    expect(await page.evaluate(() => window.coforgeRetryProof?.confirmations)).toBe(0);
    const overflow = await dialog.locator('.cf-idea-scroll').evaluate(element => {
      const outer = element.getBoundingClientRect();
      return [{ tag: 'ROOT', class: element.className, width: outer.width, client: element.clientWidth, scroll: element.scrollWidth, right: outer.right, box: getComputedStyle(element).boxSizing, display: getComputedStyle(element).display, padding: getComputedStyle(element).padding }, ...[...element.querySelectorAll('*')].flatMap(child => {
        const box = child.getBoundingClientRect();
        return box.width && (box.right > outer.right + 1 || box.left < outer.left - 1)
          ? [{ tag: child.tagName, class: child.className, width: box.width, right: box.right, rootRight: outer.right, whiteSpace: getComputedStyle(child).whiteSpace }] : [];
      })];
    });
    expect(await dialog.locator('.cf-idea-scroll').evaluate(element => element.scrollWidth <= element.clientWidth + 1), JSON.stringify(overflow)).toBe(true);
    await expect(panel).toContainText('actual reviewed partial code'); await expect(panel).toContainText('sonnet');
    const confirm = panel.getByRole('button', { name: 'Confirm background retry', exact: true }); await expect(confirm).toBeDisabled();
    await panel.getByRole('checkbox', { name: 'I inspected earlier Build executors and confirmed they stopped', exact: true }).check(); await expect(confirm).toBeDisabled();
    await panel.getByRole('checkbox', { name: 'I reviewed this Build snapshot', exact: true }).check(); await expect(confirm).toBeEnabled();
    await panel.getByRole('checkbox', { name: 'I reviewed this Build snapshot', exact: true }).press('Tab'); await expect(confirm).toBeFocused();
    await mkdir('reports/background-build-retry', { recursive: true });
    await dialog.screenshot({ path: `reports/background-build-retry/review-${theme}-${width}.png` });
    expect((await new AxeBuilder({ page }).include('[data-retry-proof]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
    await panel.press('Escape'); await expect(panel).toBeHidden(); await expect(entry).toBeFocused(); await expect(dialog).toBeVisible();
    await entry.press('Enter'); await expect(confirm).toBeDisabled();
    await panel.getByRole('checkbox', { name: 'I inspected earlier Build executors and confirmed they stopped', exact: true }).check();
    await panel.getByRole('checkbox', { name: 'I reviewed this Build snapshot', exact: true }).check();
    await confirm.focus(); await confirm.press('Enter'); await expect(panel).toBeHidden();
    expect(await page.evaluate(() => ({ confirmations: window.coforgeRetryProof?.confirmations, providerCalls: window.coforgeRetryProof?.providerCalls, consent: window.coforgeRetryProof?.consent }))).toEqual({ confirmations: 1, providerCalls: 0, consent: { oldExecutorStopped: true, changesReviewed: true, releaseStopHold: false } });
    await page.evaluate(() => window.coforgeRetryProof?.destroy());
  });
}
