import { expect, test } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
import { openProjectSettings, settingsPageButton } from '../support/settings-navigation';
import { openWorkflowDisclosure, openWorkflowSettings } from '../support/workflow-navigation';

for (const theme of ['light', 'dark']) {
  test(`nested workflow authoring and invalid settings stay recoverable in ${theme}`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 1800, height: 1000 });
    await page.goto('/#surface=node-1');
    await expect(page.locator('html')).toHaveAttribute('data-prototype-ready', 'true');
    await page.evaluate(value => {
      document.body.classList.remove('theme-light', 'theme-dark'); document.body.classList.add(`theme-${value}`);
    }, theme);
    await openWorkflowSettings(page);
    const settings = page.locator('.cf-settings-page');
    const host = page.locator('[data-plugin-ui="coforge"]').first();
    await mkdir('reports/project-settings', { recursive: true });
    await openWorkflowDisclosure(settings.locator('.cf-workflow-settings-page'), 'Workflow tools');
    await expect(settings.locator('.cf-workflow-tools').getByRole('button', { name: 'Attach an event trigger', exact: true })).toBeVisible();
    await expect(page.getByLabel('Workflow name', { exact: true })).toHaveValue('Community development');
    for (const width of [1280, 480]) {
      await host.evaluate((element, width) => { element.style.width = `${width}px`; element.style.maxWidth = 'none'; }, width);
      await expect.poll(() => settings.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
      await settings.screenshot({ path: `reports/project-settings/workflow-settings-${theme}-${width}.png` });
      const violations = (await new AxeBuilder({ page }).include('.cf-settings-page')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations;
      expect(violations.map(item => ({ rule: item.id, targets: item.nodes.map(node => node.target) }))).toEqual([]);
    }
    await page.getByLabel('Workflow name', { exact: true }).fill('');
    await expect(page.getByRole('button', { name: 'Save workflow', exact: true })).toBeDisabled();
    await settingsPageButton(page, 'General').click();
    await expect(settingsPageButton(page, 'Agent workflow')).toHaveAttribute('aria-current', 'page');
    await expect(page.getByLabel('Workflow name', { exact: true })).toHaveValue('');
    await page.getByRole('button', { name: 'Discard workflow changes', exact: true }).click();
    await openProjectSettings(page, 'General');
    await page.getByLabel('Project name', { exact: true }).fill('');
    await openProjectSettings(page, 'Repository');
    await page.getByRole('button', { name: 'Save settings', exact: true }).click();
    await expect(settings.getByRole('alert')).toContainText('Add a project name');
    await expect(page.locator('.cf-project-switcher')).toContainText('Mosslight');
    await settings.screenshot({ path: `reports/project-settings/invalid-draft-${theme}-480.png` });
    await openProjectSettings(page, 'General');
    await expect(page.getByLabel('Project name', { exact: true })).toHaveValue('');
    await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
    await expect(page.getByLabel('Project name', { exact: true })).toHaveValue('Mosslight');
    await expect(page.getByRole('button', { name: 'Save settings', exact: true })).toBeDisabled();
  });
}
