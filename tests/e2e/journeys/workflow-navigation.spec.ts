import { expect, test } from '@playwright/test';
import { openWorkflowRuns, openWorkflowSettings } from '../support/workflow-navigation';

for (const theme of ['light', 'dark']) {
  test(`workflow settings is a guarded local page with one parent sidebar entry in ${theme}`, async ({ page }) => {
    await page.goto('/#surface=node-1');
    await expect(page.locator('html')).toHaveAttribute('data-prototype-ready', 'true');
    await page.evaluate(value => {
      document.body.classList.remove('theme-light', 'theme-dark');
      document.body.classList.add(`theme-${value}`);
    }, theme);
    const sidebar = page.locator('.cf-sidebar');
    const parent = sidebar.getByRole('button', { name: 'Agent workflow', exact: true });
    await expect(parent).toHaveCount(1);
    await expect(sidebar.getByRole('button', { name: 'Workflow settings', exact: true })).toHaveCount(0);
    await openWorkflowRuns(page);
    await expect(page.locator('.cf-workflow-count')).toHaveText('0 attempts');
    await openWorkflowSettings(page);
    await expect(parent).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('.cf-workflow-page').getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.locator('.cf-workflow-page').getByRole('heading', { level: 1 })).toHaveText('Agent workflow');
    await expect(page.getByRole('heading', { name: 'Workflow settings', level: 2, exact: true })).toBeVisible();
    const pages = page.getByRole('navigation', { name: 'Agent workflow pages', exact: true });
    const settings = pages.getByRole('button', { name: 'Workflow settings', exact: true });
    await page.getByLabel('Workflow name', { exact: true }).fill('Keep this workflow draft');
    await pages.getByRole('button', { name: 'Workflow runs', exact: true }).click();
    await expect(settings).toHaveAttribute('aria-current', 'page');
    await expect(page.getByLabel('Workflow name', { exact: true })).toHaveValue('Keep this workflow draft');
    await pages.getByRole('button', { name: 'Herdr workspaces', exact: true }).click();
    await expect(settings).toHaveAttribute('aria-current', 'page');
    await expect(page.getByLabel('Workflow name', { exact: true })).toHaveValue('Keep this workflow draft');
    await page.getByRole('button', { name: 'Discard workflow changes', exact: true }).click();
    await openWorkflowRuns(page);
    await expect(page.locator('.cf-workflow-count')).toHaveText('0 attempts');
    await expect(page.getByRole('region', { name: 'Request workflow execution', exact: true })).toContainText('Not started');
  });
}
