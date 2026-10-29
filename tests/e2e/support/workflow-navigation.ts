import { expect, type Locator, type Page } from '@playwright/test';
import { openProjectSettings } from './settings-navigation';

/** Follow progressive disclosure through its visible summary before using advanced controls. */
export async function openWorkflowDisclosure(surface: Page | Locator, name: string) {
  const control = surface.locator('summary').filter({ hasText: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) });
  const details = control.locator('xpath=..');
  if (!await details.evaluate(element => element.hasAttribute('open')))
    await control.click();
}

/** Workflow execution and configuration belong to the project's settings workspace. */
export async function openAgentWorkflow(surface: Page | Locator) {
  if (await surface.locator('.cf-workflow-page').isVisible()) return;
  await openProjectSettings(surface, 'Agent workflow');
  await expect(surface.locator('.cf-workflow-page')).toBeVisible();
}

export async function openWorkflowSettings(surface: Page | Locator) {
  await openAgentWorkflow(surface);
  const pages = surface.getByRole('navigation', { name: 'Agent workflow pages', exact: true });
  await pages.getByRole('button', { name: 'Workflow settings', exact: true }).click();
  await expect(surface.locator('.cf-workflow-settings-page')).toBeVisible();
  await expect(pages.getByRole('button', { name: 'Workflow settings', exact: true })).toHaveAttribute('aria-current', 'page');
}

/** A parent sidebar entry may restore settings; execution requests name the local runs page. */
export async function openWorkflowRuns(surface: Page | Locator) {
  await openAgentWorkflow(surface);
  const pages = surface.getByRole('navigation', { name: 'Agent workflow pages', exact: true });
  await pages.getByRole('button', { name: 'Workflow runs', exact: true }).click();
  await expect(pages.getByRole('button', { name: 'Workflow runs', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(surface.getByRole('region', { name: 'Request workflow runs', exact: true })).toBeVisible();
}
