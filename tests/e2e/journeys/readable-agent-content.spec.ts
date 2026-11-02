import { expect, test } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { build } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { READING_TASK, READING_ANSWER } from '../support/readable-content-fixture';

let script = '';
test.beforeAll(async () => {
  const result = await build({ configFile: false, logLevel: 'silent', plugins: [vue()], define: { 'process.env.NODE_ENV': '"production"' },
    build: { write: false, minify: false, target: 'es2022', lib: { entry: resolve('tests/e2e/support/readable-content-entry.ts'), name: 'ReadingProof', formats: ['iife'] }, rolldownOptions: { output: { codeSplitting: false } } },
  });
  const chunks = (Array.isArray(result) ? result : [result]).flatMap(value => value.output).filter(value => value.type === 'chunk');
  if (chunks.length !== 1) throw new Error('Expected one contained reading fixture');
  script = chunks[0]!.code;
});

for (const theme of ['light', 'dark']) for (const width of [1280, 360]) {
  test(`captured tasks and answers read clearly in ${theme} at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 }); await page.goto('/#surface=node-1');
    await expect(page.locator('html')).toHaveAttribute('data-prototype-ready', 'true');
    await page.evaluate(theme => { document.body.classList.toggle('theme-dark', theme === 'dark'); document.body.classList.toggle('theme-light', theme === 'light'); }, theme);
    await page.evaluate(script);
    const reading = page.getByRole('region', { name: 'Captured content reading fixture', exact: true });
    const task = reading.getByRole('region', { name: 'Captured task', exact: true });
    const answer = reading.getByRole('region', { name: 'Captured answer', exact: true });
    await expect(task.locator('.cf-readable-body')).toContainText('Community proposal (untrusted)');
    await expect(task.locator('.cf-readable-body strong')).toHaveText('Hiring Pool');
    await expect(answer.locator('.cf-readable-body strong')).toHaveText('preview a role');
    await expect(answer.locator('.cf-readable-body li')).toHaveCount(3);
    for (const [scope, label, original] of [[task, 'Original task JSON', READING_TASK], [answer, 'Original answer text', READING_ANSWER]] as const) {
      const disclosure = scope.locator('summary').filter({ hasText: label });
      await expect(scope.locator('details')).not.toHaveAttribute('open', '');
      await disclosure.focus(); await disclosure.press('Enter');
      await expect(scope.locator('pre.cf-readable-source')).toBeVisible();
      expect(await scope.locator('pre.cf-readable-source').textContent()).toBe(original);
      await disclosure.press('Enter');
    }
    expect(await reading.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    expect((await new AxeBuilder({ page }).include('[data-readable-proof]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
    await mkdir('reports/readable-content', { recursive: true });
    await reading.screenshot({ path: `reports/readable-content/reading-${theme}-${width}.png` });
  });
}
