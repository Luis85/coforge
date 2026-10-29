import { expect, test, type Page } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
const secretName = 'Unannounced owner project';
async function privateProject(page: Page, theme: string) {
  await page.goto('/#surface=node-1');
  await expect(page.locator('html')).toHaveAttribute('data-prototype-ready', 'true');
  await page.evaluate(value => { document.body.classList.remove('theme-light', 'theme-dark'); document.body.classList.add(`theme-${value}`); }, theme);
  await page.locator('.cf-project-switcher').click();
  await page.getByRole('button', { name: 'Add project', exact: true }).click();
  const form = page.getByRole('form', { name: 'Add project', exact: true });
  await form.getByLabel('Project name', { exact: true }).fill(secretName);
  await form.getByRole('combobox', { name: 'Project visibility', exact: true }).selectOption('private');
  await form.getByLabel(/^Project path/).fill('/synthetic/private-owner');
  await form.getByLabel('Description', { exact: true }).fill('This owner-only project must stay out of every derived viewer projection.');
  await form.getByRole('button', { name: 'Create project', exact: true }).click();
  await expect(page.locator('.cf-project-switcher')).toContainText('Private');
  await expect(page.locator('.cf-project-work-context')).toHaveCount(0);
  return page.locator('.cf-project-switcher .cf-project-selector-id').innerText();
}
for (const theme of ['light', 'dark']) {
  test(`private owner projects retain manual work and explicit visibility in ${theme}`, async ({ page }) => {
    await privateProject(page, theme);
    await expect(page.locator('.cf-board-welcome')).toContainText('Private projects do not accept viewer chat requests');
    await page.getByRole('button', { name: 'New request', exact: true }).first().click();
    await page.getByLabel('The idea', { exact: true }).fill('An owner-only feature remains usable');
    await page.getByLabel('A little more context', { exact: true }).fill('Private owner context stays in this project note.');
    await page.getByRole('button', { name: 'Add to the board', exact: true }).click();
    await expect(page.locator('.cf-board-page')).toContainText('An owner-only feature remains usable');
    await page.locator('.cf-sidebar').getByRole('button', { name: 'Project settings', exact: true }).click();
    await expect(page.getByRole('combobox', { name: 'Project visibility', exact: true })).toHaveValue('private');
    await mkdir('reports/project-privacy', { recursive: true });
    for (const width of [1280, 480]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(await page.locator('.cf-settings-page').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await page.locator('.cf-studio').screenshot({ path: `reports/project-privacy/owner-${theme}-${width}.png` });
    }
    expect((await new AxeBuilder({ page }).include('.cf-settings-page').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
  });
  test(`all four public captures fail closed for the selected private project in ${theme}`, async ({ page }) => {
    const privateId = await privateProject(page, theme);
    await page.locator('.cf-sidebar').getByRole('button', { name: 'Stream studio', exact: true }).click();
    await page.getByRole('navigation', { name: 'Stream studio pages', exact: true }).getByRole('button', { name: 'Public displays', exact: true }).click();
    await page.setViewportSize({ width: 480, height: 1000 });
    await mkdir('reports/project-privacy', { recursive: true });
    for (const [id, label] of [['kanban', 'Stream Kanban'], ['chat', 'Stream Chat'], ['leaderboards', 'Stream Leaderboards'], ['community', 'Stream Community']]) {
      await page.getByRole('button', { name: `Preview ${label}`, exact: true }).click();
      const surface = page.locator(`.cf-stream-surface-${id}`);
      await expect(surface).toBeVisible(); await expect(surface).not.toContainText(secretName); await expect(surface).not.toContainText(privateId);
      await expect(surface.locator('input,button,textarea,a')).toHaveCount(0);
      expect(await surface.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await surface.screenshot({ path: `reports/project-privacy/public-${id}-${theme}-480.png` });
      expect((await new AxeBuilder({ page }).include(`.cf-stream-surface-${id}`).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
    }
  });
}
