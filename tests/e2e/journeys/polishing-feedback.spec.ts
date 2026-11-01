import { expect, test } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
import { backgroundRetryProofBundle } from '../support/background-retry-proof-bundle';
import { openWorkflowSettings } from '../support/workflow-navigation';

let script = '';
test.beforeAll(async () => { script = await backgroundRetryProofBundle(); });
for (const [theme, width] of [['light', 360], ['dark', 1280]] as const) {
  test(`polishing feedback remains an isolated, accessible modal in ${theme} at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 }); await page.goto('/#surface=node-1');
    await expect(page.locator('html')).toHaveAttribute('data-prototype-ready', 'true');
    await page.evaluate(theme => { document.body.classList.toggle('theme-dark', theme === 'dark'); document.body.classList.toggle('theme-light', theme === 'light'); }, theme);
    await page.evaluate(script);
    const detail = page.getByRole('dialog', { name: 'Retry presentation proof', exact: true });
    const trigger = detail.getByRole('button', { name: 'Improve & polish', exact: true });
    await trigger.focus(); await trigger.press('Enter');
    const modal = page.getByRole('dialog', { name: 'Improve & polish current result', exact: true });
    await expect(modal).toBeVisible(); await expect(detail).toBeHidden();
    const feedback = modal.getByRole('textbox', { name: 'Feedback for this polishing pass', exact: true }); await expect(feedback).toBeFocused();
    const review = modal.getByRole('button', { name: 'Review improvement pass', exact: true }); await review.click();
    await expect(modal.getByRole('alert')).toContainText('Enter feedback');
    const text = `Preserve the source result and improve clarity.\n${'LongFeedbackReference'.repeat(20)}`;
    await feedback.fill(text); await review.click();
    const preview = modal.getByRole('region', { name: 'Review polishing pass', exact: true }); await expect(preview).toBeVisible();
    const confirm = modal.getByRole('button', { name: 'Confirm Improve & polish', exact: true }); await expect(confirm).toBeDisabled();
    expect(await page.evaluate(() => window.coforgeRetryProof?.polishingConfirmations)).toBe(0);
    expect(await modal.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await modal.getByRole('checkbox', { name: 'I reviewed the current result and feedback', exact: true }).check();
    await expect(confirm).toBeEnabled(); await mkdir('reports/polishing-feedback', { recursive: true });
    await modal.screenshot({ path: `reports/polishing-feedback/review-${theme}-${width}.png` });
    expect((await new AxeBuilder({ page }).include('[data-retry-proof]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
    await modal.press('Escape'); await expect(modal).toBeHidden(); await expect(detail).toBeVisible(); await expect(trigger).toBeFocused();
    await trigger.press('Enter'); await expect(feedback).toHaveValue(text); await review.click(); await expect(confirm).toBeDisabled();
    await modal.getByRole('checkbox', { name: 'I reviewed the current result and feedback', exact: true }).check(); await confirm.focus(); await confirm.press('Enter');
    await expect(modal).toBeHidden(); await expect(detail).toBeVisible();
    expect(await page.evaluate(() => ({ confirmations: window.coforgeRetryProof?.polishingConfirmations, feedback: window.coforgeRetryProof?.feedback, providerCalls: window.coforgeRetryProof?.providerCalls }))).toEqual({ confirmations: 1, feedback: text, providerCalls: 0 });
    await page.evaluate(() => window.coforgeRetryProof?.destroy());
  });
}

test('makes the actual clean repository code source explicit instead of implying that historical accepted changes were copied', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 900 }); await page.goto('/#surface=node-1');
  await expect(page.locator('html')).toHaveAttribute('data-prototype-ready', 'true'); await page.evaluate(script);
  await page.evaluate(() => window.coforgeRetryProof?.showCleanCodeSource());
  await page.getByRole('dialog', { name: 'Retry presentation proof', exact: true }).getByRole('button', { name: 'Improve & polish', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Improve & polish current result', exact: true });
  await modal.getByRole('textbox', { name: 'Feedback for this polishing pass', exact: true }).fill('Polish from the reviewed actual base.');
  await modal.getByRole('button', { name: 'Review improvement pass', exact: true }).click();
  const snapshot = modal.getByRole('region', { name: 'Reviewed code snapshot', exact: true });
  await expect(snapshot).toContainText('Current clean repository'); await expect(snapshot).toContainText('Repository base');
  await expect(snapshot).toContainText('0 changed files'); await expect(snapshot).toContainText('Earlier result context');
  await expect(modal.getByRole('checkbox', { name: 'I inspected earlier polishing source executors', exact: true })).toHaveCount(0);
  expect(await modal.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await mkdir('reports/polishing-feedback', { recursive: true }); await modal.screenshot({ path: 'reports/polishing-feedback/code-clean-base-360.png' });
  expect((await new AxeBuilder({ page }).include('[data-retry-proof]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => window.coforgeRetryProof?.providerCalls)).toBe(0); await page.evaluate(() => window.coforgeRetryProof?.destroy());
});

test('saves the optional pass explicitly using real model/effort choices without changing workflow steps or starting work', async ({ page }) => {
  await page.goto('/#surface=node-1'); await expect(page.locator('html')).toHaveAttribute('data-prototype-ready', 'true');
  await openWorkflowSettings(page);
  await page.getByRole('checkbox', { name: 'Enable Improve & polish', exact: true }).check();
  const settings = page.getByRole('region', { name: 'Improve & polish configuration', exact: true });
  await settings.getByLabel('Improvement provider', { exact: true }).selectOption('claude');
  await settings.getByLabel('Improvement model', { exact: true }).selectOption('sonnet');
  await settings.getByLabel('Improvement reasoning effort', { exact: true }).selectOption('high');
  await settings.getByLabel('Improvement instructions', { exact: true }).fill('Polish only the reviewed current result and honor the captured feedback.');
  await page.getByRole('button', { name: 'Save workflow', exact: true }).click();
  await expect(page.locator('.cf-workflow-editor-notice')).toContainText('Workflow saved.');
  await expect(settings.getByLabel('Improvement reasoning effort', { exact: true })).toHaveValue('high');
  await page.setViewportSize({ width: 360, height: 900 });
  expect(await page.locator('.cf-content').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  expect((await new AxeBuilder({ page }).include('.cf-workflow-page').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
});

test('keeps main manual continuation behind pending pass resolution while auxiliary Stop and dismissal stay reachable', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 900 }); await page.goto('/#surface=node-1');
  await expect(page.locator('html')).toHaveAttribute('data-prototype-ready', 'true'); await page.evaluate(script);
  await page.evaluate(() => window.coforgeRetryProof?.showPendingMainDecision());
  const detail = page.getByRole('dialog', { name: 'Retry presentation proof', exact: true });
  await expect(detail.getByRole('region', { name: 'Manual workflow step', exact: true })).toHaveCount(0);
  await expect(detail.getByRole('button', { name: 'Start a new workflow run', exact: true })).toHaveCount(0);
  await expect(detail.getByRole('region', { name: 'Next workflow action', exact: true })).toContainText('Review Improve & polish pass');
  await expect(detail.getByRole('button', { name: 'Stop polishing pass', exact: true })).toBeVisible();
  await expect(detail.getByRole('button', { name: 'Dismiss polishing attempt', exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.coforgeRetryProof?.providerCalls)).toBe(0); await page.evaluate(() => window.coforgeRetryProof?.destroy());
});
