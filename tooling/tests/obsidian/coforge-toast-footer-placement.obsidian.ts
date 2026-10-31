import { expect as browserExpect, type Locator } from '@playwright/test';
import { describe, expect } from 'vitest';
import { test } from './support/obsidian-fixture';
import { writeEvidence } from './support/evidence';

async function clearOfFooter(view: Locator, selector: string) {
  const toast = view.locator('.cf-toast-stack'); const footer = view.locator(selector);
  await browserExpect(toast.locator('.cf-toast').last()).toBeVisible();
  await browserExpect.poll(async () => {
    const panel = await toast.boundingBox(); const actions = await footer.boundingBox();
    return Boolean(panel && actions && (panel.x + panel.width <= actions.x || panel.x >= actions.x + actions.width || panel.y + panel.height <= actions.y - 1));
  }).toBe(true);
  const geometry = await toast.evaluate((element, selector) => {
    const root = element.closest('.cf-studio'); const footer = root?.querySelector(selector);
    if (!footer) throw new Error('Missing operator footer');
    const box = element.getBoundingClientRect(); const actions = footer.getBoundingClientRect();
    const header = root?.querySelector(selector === '.cf-idea-footer' ? '.cf-idea-tabs' : '.cf-topbar')?.getBoundingClientRect();
    return { toastTop: box.top, toastBottom: box.bottom, footerTop: actions.top, footerHeight: actions.height, headerBottom: header?.bottom ?? 0 };
  }, selector);
  expect(geometry.toastTop).toBeGreaterThanOrEqual(geometry.headerBottom);
  return geometry;
}
async function dismissToast(view: Locator) {
  const toast = view.locator('.cf-toast-stack'); const count = await toast.locator('.cf-toast').count();
  await toast.getByRole('button', { name: 'Dismiss notification', exact: true }).last().click();
  await browserExpect(toast.locator('.cf-toast')).toHaveCount(count - 1);
}

describe('Floating feedback clears operator controls', () => {
  test('keeps feature and project action footers clear after narrow wrapping and resizing', async ({ obsidian }) => {
    const view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await view.locator('.cf-project-switcher').click();
    await view.getByRole('button', { name: 'Add project', exact: true }).click();
    await view.getByLabel('Project name', { exact: true }).fill('Toast action clearance');
    await view.getByLabel(/^Project path/).fill('/synthetic/toast-action-clearance');
    await view.getByLabel('Description', { exact: true }).fill('Measured floating feedback without any agent dispatch.');
    await view.getByRole('button', { name: 'Create project', exact: true }).click();
    await view.locator('.cf-sidebar').getByRole('button', { name: /^Idea board/u }).click();
    const measurements = [];
    for (const theme of ['light', 'dark']) for (const width of [1600, 620]) {
      // Create at the wide size, then resize with the actual toast and detail footer mounted.
      await obsidian.page.setViewportSize({ width: 1600, height: 1000 });
      await obsidian.page.evaluate(theme => { document.body.classList.remove('theme-light', 'theme-dark'); document.body.classList.add(`theme-${theme}`); }, theme);
      const title = `Notification clearance ${theme} ${width}`;
      await view.locator('.cf-board-page > .cf-page-heading').getByRole('button', { name: 'New request', exact: true }).click();
      const draft = view.getByRole('dialog', { name: 'New request', exact: true });
      await draft.getByLabel('The idea', { exact: true }).fill(title);
      await draft.getByLabel('A little more context', { exact: true }).fill('Retain the action and complete notification.');
      await draft.getByLabel('Contributor name', { exact: true }).fill('Contained owner');
      await draft.getByRole('button', { name: 'Add to the board', exact: true }).click();
      await browserExpect(draft).toHaveCount(0);
      await view.locator('.cf-idea-card').filter({ hasText: title }).locator('.cf-idea-open').click();
      await obsidian.page.setViewportSize({ width, height: 1000 });
      measurements.push({ scope: 'feature', theme, width, ...await clearOfFooter(view, '.cf-idea-footer') });
      await obsidian.screenshot(`toast-clears-feature-${theme}-${width}`);
      await dismissToast(view);
      await view.getByRole('button', { name: 'Close idea details', exact: true }).click();
    }
    await obsidian.page.setViewportSize({ width: 1600, height: 1000 });
    await view.getByRole('button', { name: 'Project settings', exact: true }).click();
    for (const width of [1600, 620]) {
      await obsidian.page.setViewportSize({ width, height: 1000 });
      await view.getByLabel('Project description', { exact: true }).fill(`Keep project actions accessible after saving at ${width}px.`);
      await view.getByRole('button', { name: 'Save settings', exact: true }).click();
      measurements.push({ scope: 'project', width, ...await clearOfFooter(view, '.cf-settings-save') });
      await obsidian.screenshot(`toast-clears-project-${width}`);
      await dismissToast(view);
    }
    await writeEvidence(obsidian.directory, 'toast-footer-clearance', measurements);
    expect(obsidian.errors()).toEqual([]);
  });
});
