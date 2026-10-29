import { test, expect, type Page } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';

async function capture(page: Page, theme: string, phase: string) {
  const council = page.locator('.cf-council');
  await mkdir('reports/council-ask', { recursive: true });
  for (const width of [1440, 480]) {
    await page.setViewportSize({ width: 1800, height: 1000 });
    await page.locator('[data-plugin-ui="coforge"]').first().evaluate((element, width) => { element.style.width = `${width}px`; element.style.maxWidth = `${width}px`; }, width);
    await expect.poll(() => council.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    expect((await new AxeBuilder({ page }).include('.cf-council').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
    await council.screenshot({ path: `reports/council-ask/${phase}-${theme}-${width}.png` });
  }
}
for (const theme of ['light', 'dark']) {
  test(`Council starts with a usable question intake and ingested task history in ${theme}`, async ({ page }) => {
    test.setTimeout(90000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/#surface=node-1');
    await expect(page.locator('html')).toHaveAttribute('data-prototype-ready', 'true');
    await page.evaluate(theme => { document.body.classList.toggle('theme-light', theme === 'light'); document.body.classList.toggle('theme-dark', theme === 'dark'); }, theme);
    const build = page.getByRole('group', { name: 'Build & Improve navigation', exact: true });
    await expect(build.locator('.cf-nav-item').nth(0)).toHaveText(/^Idea board/);
    await expect(build.locator('.cf-nav-item').nth(1)).toHaveText('The Council');
    await build.getByRole('button', { name: 'The Council', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Ask the Council for advice', exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Council task history', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Explore Council example', exact: true }).click();
    await expect(page.getByRole('navigation', { name: 'Council workspace', exact: true })).toBeVisible();
    await page.getByLabel('Task title', { exact: true }).fill('Advice on the next game milestone');
    await page.getByLabel('Your question or task', { exact: true }).fill('Compare a small playable loop with a larger world update. Explain assumptions and disagreements.');
    await page.getByRole('combobox', { name: 'Council', exact: true }).selectOption('council-example');
    await expect(page.getByRole('region', { name: 'Selected Council recipients', exact: true })).toContainText('Product designer');
    await expect(page.getByRole('combobox', { name: 'Project team', exact: true })).toHaveCount(0);
    await capture(page, theme, 'intake');
    await page.getByRole('button', { name: 'Save task and review', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Invocation preview', exact: true })).toContainText('6 invocations');
    const history = page.getByRole('region', { name: 'Council task history', exact: true });
    await expect(history).toContainText('Advice on the next game milestone');
    await expect(history).toContainText('Saved note · no retained run');
    await expect(page.getByRole('button', { name: 'Submit reviewed task', exact: true })).toBeDisabled();
    await expect(page.getByLabel('Task title', { exact: true })).toHaveValue('Advice on the next game milestone');
    await capture(page, theme, 'review');
    await page.getByRole('button', { name: 'Use this desktop for execution', exact: true }).click();
    await expect(page.getByLabel('Simulation destination', { exact: true })).toHaveValue(/^CoForge\/Tests\/task-.+-simulation\.md$/);
    await page.getByRole('button', { name: 'Queue simulation', exact: true }).click();
    await expect(page.getByRole('navigation', { name: 'Council workspace', exact: true }).getByRole('button', { name: 'Ask the Council', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByLabel('Task title', { exact: true })).toHaveValue('');
    await expect(history).toContainText('Simulation · queued · execution paused');
    await page.getByRole('button', { name: 'Resume Council execution', exact: true }).click();
    await expect(history).toContainText('6/6 steps completed or skipped');
    await capture(page, theme, 'history');
    const inspect = history.getByRole('button', { name: 'Inspect task Advice on the next game milestone', exact: true });
    await inspect.click();
    await expect(page.getByRole('region', { name: 'Captured run evidence', exact: true })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Council workspace', exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
}
