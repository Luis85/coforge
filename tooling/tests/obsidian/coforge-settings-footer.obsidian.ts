import { expect as browserExpect, type Locator, type Page } from '@playwright/test';
import { join } from 'node:path';
import { describe, expect } from 'vitest';
import { test } from './support/obsidian-fixture';
import { writeEvidence } from './support/evidence';

async function footerGeometry(footer: Locator) {
  return footer.evaluate(element => {
    let scroll = element.parentElement;
    while (scroll && !/(?:auto|scroll)/u.test(getComputedStyle(scroll).overflowY)) scroll = scroll.parentElement;
    if (!scroll) throw new Error('Settings scroll viewport is unavailable');
    const viewport = scroll.getBoundingClientRect();
    const bounds = element.getBoundingClientRect();
    const buttons = [...element.querySelectorAll('button')].map(button => button.getBoundingClientRect().bottom);
    const bar = document.querySelector('.status-bar');
    const status = bar?.getBoundingClientRect();
    const overlap = status && bar && getComputedStyle(bar).display !== 'none' && status.right > bounds.left && status.left < bounds.right && status.bottom >= viewport.bottom;
    const ancestors = [];
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      ancestors.push({ className: parent.className, bottom: parent.getBoundingClientRect().bottom,
        paddingBottom: style.paddingBottom, marginBottom: style.marginBottom, overflow: style.overflowY });
      if (parent === scroll) break;
    }
    return { gap: viewport.top + scroll.clientTop + scroll.clientHeight - bounds.bottom,
      background: getComputedStyle(element).backgroundColor,
      controlsClear: !overlap || buttons.every(bottom => bottom <= status.top + 1),
      controlsContained: [...element.querySelectorAll('button')].every(button => {
        const rect = button.getBoundingClientRect();
        return rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1;
      }), ancestors };
  });
}
async function checkAtScrollPositions(footer: Locator) {
  const measurements = [];
  for (const position of ['middle', 'bottom']) {
    await footer.evaluate((element, position) => {
      let scroll = element.parentElement;
      while (scroll && !/(?:auto|scroll)/u.test(getComputedStyle(scroll).overflowY)) scroll = scroll.parentElement;
      if (!scroll) throw new Error('Settings scroll viewport is unavailable');
      scroll.scrollTop = position === 'bottom' ? scroll.scrollHeight : (scroll.scrollHeight - scroll.clientHeight) / 2;
    }, position);
    await footer.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    measurements.push({ position, ...await footerGeometry(footer) });
  }
  return measurements;
}
async function checkSizesAndThemes(page: Page, footer: Locator, directory: string, surface: string) {
  const measurements = [];
  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => {
      document.body.classList.toggle('theme-dark', theme === 'dark');
      document.body.classList.toggle('theme-light', theme === 'light');
    }, theme);
    for (const size of [{ name: 'wide', width: 1440, height: 860 }, { name: 'narrow', width: 820, height: 600 }]) {
      await page.setViewportSize({ width: size.width, height: size.height });
      measurements.push({ theme, size: size.name, positions: await checkAtScrollPositions(footer) });
      await page.screenshot({ path: join(directory, `${surface}-${theme}-${size.name}.png`) });
    }
  }
  return measurements;
}

describe('Settings action footers in the contained host', () => {
  test('paint flush to the scroll viewport while keeping native status-bar controls clear', async ({ obsidian }) => {
    const view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await view.locator('.cf-project-switcher').click();
    await view.getByRole('button', { name: 'Add project', exact: true }).click();
    await view.getByLabel('Project name', { exact: true }).fill('Footer geometry');
    await view.getByLabel(/^Project path/).fill('/synthetic/footer-geometry');
    await view.getByLabel('Description', { exact: true }).fill('Contained settings layout regression.');
    await view.getByRole('button', { name: 'Create project', exact: true }).click();
    await browserExpect(view.locator('.cf-project-switcher')).toContainText('Footer geometry');
    await view.getByRole('button', { name: 'Project settings', exact: true }).click();
    const project = await checkSizesAndThemes(obsidian.page, view.locator('.cf-settings-save'), obsidian.directory, 'project-footer');
    const settingsWindow = obsidian.page.context().waitForEvent('page');
    await obsidian.runCommand('app:open-settings');
    const nativePage = await settingsWindow;
    await nativePage.waitForLoadState('domcontentloaded');
    await nativePage.locator('.vertical-tab-nav-item').filter({ hasText: /^CoForge$/u }).last().click();
    const nativeFooter = nativePage.locator('.cf-plugin-settings-save');
    await browserExpect(nativeFooter).toBeVisible();
    const native = await checkSizesAndThemes(nativePage, nativeFooter, obsidian.directory, 'native-footer');
    await writeEvidence(obsidian.directory, 'footer-geometry', { project, native });
    for (const measurement of [...project, ...native].flatMap(configuration => configuration.positions)) {
      expect(Math.abs(measurement.gap)).toBeLessThanOrEqual(1);
      expect(measurement.background).not.toBe('rgba(0, 0, 0, 0)');
      expect(measurement.controlsClear).toBe(true);
      expect(measurement.controlsContained).toBe(true);
    }
    expect(obsidian.errors()).toEqual([]);
  });
});
