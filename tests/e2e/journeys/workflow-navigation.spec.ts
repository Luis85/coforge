import { expect, test } from '@playwright/test';
import { openWorkflowAttempts, openWorkflowRuns, openWorkflowSettings } from '../support/workflow-navigation';
import { settingsPageButton } from '../support/settings-navigation';

for (const theme of ['light', 'dark']) {
  test(`workflow settings belongs to bottom project settings and guards local drafts in ${theme}`, async ({ page }) => {
    await page.goto('/#surface=node-1');
    await expect(page.locator('html')).toHaveAttribute('data-prototype-ready', 'true');
    await page.evaluate(value => {
      document.body.classList.remove('theme-light', 'theme-dark');
      document.body.classList.add(`theme-${value}`);
    }, theme);
    const sidebar = page.locator('.cf-sidebar');
    const parent = sidebar.getByRole('button', { name: 'Project settings', exact: true });
    await expect(parent).toHaveCount(1);
    await expect(sidebar.getByRole('button', { name: 'Agent workflow', exact: true })).toHaveCount(0);
    await expect(sidebar.getByRole('button', { name: 'Idea Board Workflow', exact: true })).toHaveCount(0);
    await expect(sidebar.getByRole('navigation', { name: 'CoForge navigation', exact: true }).locator('.cf-nav-item').last()).toHaveText('Project settings');
    await openWorkflowAttempts(page);
    await expect(page.locator('.cf-workflow-count')).toHaveText('0 attempts');
    await openWorkflowSettings(page);
    await expect(parent).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('.cf-settings-page').getByRole('heading', { level: 1 })).toHaveText('Project settings');
    await expect(page.locator('.cf-workflow-page').getByRole('heading', { level: 2, name: 'Agent workflow', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Idea Board Workflow', exact: true })).toBeVisible();
    const pages = page.getByRole('navigation', { name: 'Agent workflow pages', exact: true });
    const settings = pages.getByRole('button', { name: 'Idea Board Workflow', exact: true });
    await page.getByLabel('Workflow name', { exact: true }).fill('Keep this workflow draft');
    await settingsPageButton(page, 'General').click();
    await expect(settingsPageButton(page, 'Agent workflow')).toHaveAttribute('aria-current', 'page');
    await expect(page.getByLabel('Workflow name', { exact: true })).toHaveValue('Keep this workflow draft');
    await pages.getByRole('button', { name: 'Step attempts', exact: true }).click();
    await expect(settings).toHaveAttribute('aria-current', 'page');
    await expect(page.getByLabel('Workflow name', { exact: true })).toHaveValue('Keep this workflow draft');
    await pages.getByRole('button', { name: 'Herdr', exact: true }).click();
    await expect(settings).toHaveAttribute('aria-current', 'page');
    await expect(page.getByLabel('Workflow name', { exact: true })).toHaveValue('Keep this workflow draft');
    await page.getByRole('button', { name: 'Discard workflow changes', exact: true }).click();
    await openWorkflowAttempts(page);
    await expect(page.locator('.cf-workflow-count')).toHaveText('0 attempts');
    await openWorkflowRuns(page, 'CF-101');
    await expect(page.getByRole('region', { name: 'Request workflow execution', exact: true })).toContainText('Not started');
  });
}
