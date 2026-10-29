import { expect as browserExpect } from '@playwright/test';
import { describe, expect } from 'vitest';
import { test } from './support/obsidian-fixture';

describe('Navigation room in the contained native studio', () => {
  for (const theme of ['light', 'dark']) test(`fits a short desktop pane and keeps private identity without a banner in ${theme}`, async ({ obsidian }) => {
    await obsidian.page.setViewportSize({ width: 1600, height: 1100 });
    const view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await view.locator('.cf-project-switcher').click();
    await view.getByRole('button', { name: 'Add project', exact: true }).click();
    await view.getByLabel('Project name', { exact: true }).fill('Navigation fixture');
    await view.getByLabel('Project visibility', { exact: true }).selectOption('private');
    await view.getByLabel(/^Project path/).fill('/synthetic/navigation');
    await view.getByLabel('Description', { exact: true }).fill('An isolated private project for navigation geometry.');
    await view.getByRole('button', { name: 'Create project', exact: true }).click();
    await browserExpect(view.locator('.cf-project-switcher')).toContainText('Private');
    await browserExpect(view.locator('.cf-project-work-context')).toHaveCount(0);
    await obsidian.eval((_context, theme) => {
      document.body.classList.remove('theme-light', 'theme-dark'); document.body.classList.add(`theme-${theme}`);
      const root = document.querySelector('.cf-studio'); const message = document.querySelector('.cf-streamer-profile small');
      if (!(root instanceof HTMLElement) || !message) throw new Error('Navigation fixture is unavailable');
      root.style.width = '980px'; root.style.height = '740px'; root.style.minHeight = '0';
      message.textContent = 'Twitch authorization expired or was revoked. Reconnect this account.';
    }, theme);
    const nav = view.locator('.cf-sidebar nav');
    await browserExpect(view.locator('.cf-sidebar')).toHaveCSS('width', '240px');
    const geometry = await nav.evaluate(element => ({ height: element.clientHeight, overflow: element.scrollHeight - element.clientHeight }));
    expect(geometry.overflow).toBeLessThanOrEqual(1);
    await browserExpect(nav.getByRole('button', { name: 'Operations', exact: true })).toBeVisible();
    expect(obsidian.errors()).toEqual([]);
    await obsidian.screenshot(`navigation-${theme}`);
  });
});
