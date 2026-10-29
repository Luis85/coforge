import { expect, type Locator, type Page } from '@playwright/test';

/** Browser and native journeys enter settings through its owning workflow workspace. */
export async function openWorkflowSettings(surface: Page | Locator) {
  if (!await surface.locator('.cf-workflow-settings-page').isVisible())
    await surface.locator('.cf-sidebar').getByRole('button', { name: 'Agent workflow', exact: true }).click();
  const pages = surface.getByRole('navigation', { name: 'Agent workflow pages', exact: true });
  await pages.getByRole('button', { name: 'Workflow settings', exact: true }).click();
  await expect(surface.locator('.cf-workflow-settings-page')).toBeVisible();
  await expect(pages.getByRole('button', { name: 'Workflow settings', exact: true })).toHaveAttribute('aria-current', 'page');
}

/** A parent sidebar entry may restore settings; execution requests name the local runs page. */
export async function openWorkflowRuns(surface: Page | Locator) {
  await surface.locator('.cf-sidebar').getByRole('button', { name: 'Agent workflow', exact: true }).click();
  const pages = surface.getByRole('navigation', { name: 'Agent workflow pages', exact: true });
  await pages.getByRole('button', { name: 'Workflow runs', exact: true }).click();
  await expect(pages.getByRole('button', { name: 'Workflow runs', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(surface.getByRole('region', { name: 'Request workflow runs', exact: true })).toBeVisible();
}
