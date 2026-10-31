import { expect as browserExpect } from '@playwright/test';
import { describe, expect } from 'vitest';
import { test } from './support/obsidian-fixture';
import { writeEvidence } from './support/evidence';

describe('Notification clarity in the contained host', () => {
  test('keeps actual feature recovery text beside a compact icon in both themes and narrow leaves', async ({ obsidian }) => {
    const view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await view.locator('.cf-project-switcher').click();
    await view.getByRole('button', { name: 'Add project', exact: true }).click();
    await view.getByLabel('Project name', { exact: true }).fill('Notification clarity');
    await view.getByLabel(/^Project path/).fill('/synthetic/notification-clarity');
    await view.getByLabel('Description', { exact: true }).fill('Contained recovery-message layout only.');
    await view.getByRole('button', { name: 'Create project', exact: true }).click();
    await view.locator('.cf-sidebar').getByRole('button', { name: /^Idea board/u }).click();
    await view.locator('.cf-board-page > .cf-page-heading').getByRole('button', { name: 'New request', exact: true }).click();
    const draft = view.getByRole('dialog', { name: 'New request', exact: true });
    await draft.getByLabel('The idea', { exact: true }).fill('Preserve stream chat safely');
    await draft.getByLabel('A little more context', { exact: true }).fill('Keep complete recovery guidance readable.');
    await draft.getByLabel('Contributor name', { exact: true }).fill('Contained owner');
    await draft.getByRole('button', { name: 'Add to the board', exact: true }).click();
    await browserExpect(draft).toHaveCount(0);
    await browserExpect(view.locator('.cf-idea-card').filter({ hasText: 'Preserve stream chat safely' })).toBeVisible();
    const detail = `The game repository has uncommitted changes. Commit or stash them before creating a workflow workspace. ${'LongRecoveryReference'.repeat(12)}`;
    await obsidian.eval(async ({ app }, detail) => {
      let file;
      for (const candidate of app.vault.getMarkdownFiles().filter(file => file.path.startsWith('CoForge/Ideas/'))) {
        if ((await app.vault.read(candidate)).includes('Preserve stream chat safely')) { file = candidate; break; }
      }
      if (!file) throw new Error('Missing contained request');
      await app.fileManager.processFrontMatter(file, properties => { properties['last-error'] = detail; });
    }, detail);
    await view.locator('.cf-idea-card').filter({ hasText: 'Preserve stream chat safely' }).locator('.cf-idea-open').click();
    const dialog = view.locator('.cf-idea-drawer');
    const notice = dialog.locator('.cf-idea-alert.is-error');
    await browserExpect(notice).toContainText(detail);
    await dialog.getByRole('button', { name: 'Plan & Design', exact: true }).click();
    const measurements = [];
    for (const theme of ['light', 'dark']) for (const width of [1600, 620]) {
      await obsidian.page.setViewportSize({ width, height: 1000 });
      await obsidian.page.evaluate(theme => { document.body.classList.remove('theme-light', 'theme-dark'); document.body.classList.add(`theme-${theme}`); }, theme);
      await notice.scrollIntoViewIfNeeded();
      await browserExpect(notice).toHaveAttribute('role', 'alert');
      const box = await notice.evaluate(element => {
        const icon = element.querySelector('.cf-icon')!.getBoundingClientRect(); const body = element.querySelector('.cf-notice-body')!.getBoundingClientRect();
        const outer = element.getBoundingClientRect();
        return { icon: icon.width, gap: body.left - icon.right, body: body.width, width: outer.width, clipped: element.scrollWidth > element.clientWidth + 1 };
      });
      expect(box.icon).toBeLessThanOrEqual(20); expect(box.gap).toBeLessThanOrEqual(12); expect(box.body).toBeGreaterThan(box.width / 2); expect(box.clipped).toBe(false);
      measurements.push({ theme, width, ...box });
      await obsidian.screenshot(`feature-notification-${theme}-${width}`);
    }
    await writeEvidence(obsidian.directory, 'notification-geometry', measurements);
    expect(obsidian.errors()).toEqual([]);
  });
});
