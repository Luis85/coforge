import { describe, expect } from 'vitest';
import { expect as browserExpect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { test } from './support/obsidian-fixture';
import { backgroundRetryProofBundle } from '../../../tests/e2e/support/background-retry-proof-bundle';

describe('Reviewed background retry presentation in the contained native host', () => {
  test('opens polishing feedback as the only active modal and preserves the current detail without a paid provider', async ({ obsidian }) => {
    await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    const script = await backgroundRetryProofBundle();
    for (const [theme, width] of [['dark', 1440], ['light', 820]] as const) {
      await obsidian.page.setViewportSize({ width, height: 900 });
      await obsidian.eval((_context, theme) => { document.body.classList.toggle('theme-dark', theme === 'dark'); document.body.classList.toggle('theme-light', theme === 'light'); }, theme);
      await obsidian.page.evaluate(script);
      const detail = obsidian.page.getByRole('dialog', { name: 'Retry presentation proof', exact: true });
      const trigger = detail.getByRole('button', { name: 'Improve & polish', exact: true }); await trigger.focus(); await trigger.press('Enter');
      const modal = obsidian.page.getByRole('dialog', { name: 'Improve & polish current result', exact: true });
      await browserExpect(modal).toBeVisible(); await browserExpect(detail).toBeHidden();
      const feedback = modal.getByRole('textbox', { name: 'Feedback for this polishing pass', exact: true }); await browserExpect(feedback).toBeFocused();
      await feedback.fill('Polish the current retained result.\n' + 'NativeFeedbackReference'.repeat(15));
      await modal.getByRole('button', { name: 'Review improvement pass', exact: true }).click();
      await browserExpect(modal.getByRole('region', { name: 'Review polishing pass', exact: true })).toBeVisible();
      expect(await modal.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await modal.getByRole('checkbox', { name: 'I reviewed the current result and feedback', exact: true }).check();
      await browserExpect(modal.getByRole('button', { name: 'Confirm Improve & polish', exact: true })).toBeEnabled();
      await obsidian.screenshot(`native-polishing-feedback-${theme}-${width}`);
      const palette = await modal.getByRole('button', { name: 'Confirm Improve & polish', exact: true }).evaluate(element => ({ theme: document.body.className, background: getComputedStyle(element).backgroundColor,
        accent: getComputedStyle(element).getPropertyValue('--cf-accent'), text: getComputedStyle(element).getPropertyValue('--cf-text'), surface: getComputedStyle(element).getPropertyValue('--cf-bg') }));
      expect((await new AxeBuilder({ page: obsidian.page }).setLegacyMode(true).include('[data-retry-proof]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations, JSON.stringify(palette)).toEqual([]);
      await modal.press('Escape'); await browserExpect(modal).toBeHidden(); await browserExpect(trigger).toBeFocused();
      expect(await obsidian.page.evaluate(() => ({ confirmations: window.coforgeRetryProof?.polishingConfirmations, providerCalls: window.coforgeRetryProof?.providerCalls }))).toEqual({ confirmations: 0, providerCalls: 0 });
      await obsidian.page.evaluate(() => window.coforgeRetryProof?.destroy());
    }
  });
  test('keeps captured snapshot consent, wrapping and local Escape behavior without any provider port', async ({ obsidian }) => {
    await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    const script = await backgroundRetryProofBundle();
    for (const [theme, width] of [['dark', 1440], ['light', 820]] as const) {
      await obsidian.page.setViewportSize({ width, height: 900 });
      await obsidian.eval((_context, theme) => { document.body.classList.toggle('theme-dark', theme === 'dark'); document.body.classList.toggle('theme-light', theme === 'light'); }, theme);
      await obsidian.page.evaluate(script);
      const dialog = obsidian.page.getByRole('dialog', { name: 'Retry presentation proof', exact: true });
      const entry = dialog.getByRole('button', { name: 'Retry Build in background', exact: true });
      await entry.focus(); await entry.press('Enter');
      const panel = dialog.getByRole('region', { name: 'Review background Build retry', exact: true });
      await browserExpect(panel).toBeVisible(); await browserExpect(panel).toBeFocused();
      expect(await dialog.locator('.cf-idea-scroll').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await obsidian.screenshot(`native-retry-preview-${theme}-${width}`);
      const confirm = panel.getByRole('button', { name: 'Confirm background retry', exact: true }); await browserExpect(confirm).toBeDisabled();
      await panel.getByRole('checkbox', { name: 'I inspected earlier Build executors and confirmed they stopped', exact: true }).check();
      await browserExpect(confirm).toBeDisabled();
      await panel.getByRole('checkbox', { name: 'I reviewed this Build snapshot', exact: true }).check();
      await browserExpect(confirm).toBeEnabled(); await confirm.scrollIntoViewIfNeeded();
      await obsidian.screenshot(`native-retry-consent-${theme}-${width}`);
      expect((await new AxeBuilder({ page: obsidian.page }).setLegacyMode(true).include('[data-retry-proof]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
      await panel.press('Escape'); await browserExpect(panel).toBeHidden(); await browserExpect(entry).toBeFocused(); await browserExpect(dialog).toBeVisible();
      expect(await obsidian.page.evaluate(() => ({ inspections: window.coforgeRetryProof?.inspections, confirmations: window.coforgeRetryProof?.confirmations, providerCalls: window.coforgeRetryProof?.providerCalls }))).toEqual({ inspections: 1, confirmations: 0, providerCalls: 0 });
      await obsidian.page.evaluate(() => window.coforgeRetryProof?.destroy());
    }
  });
});
