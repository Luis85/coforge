import { expect, type Locator, type Page } from '@playwright/test';
import { openProjectSettings } from './settings-navigation';

/** Follow progressive disclosure through its visible summary before using advanced controls. */
export async function openWorkflowDisclosure(surface: Page | Locator, name: string) {
  const control = surface.locator('summary').filter({ hasText: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) });
  if (!(await control.isVisible()) && await surface.locator('.cf-workflow-page').isVisible()) await openWorkflowSettings(surface);
  const details = control.locator('xpath=..');
  if (!await details.evaluate(element => element.hasAttribute('open')))
    await control.click();
}

/** Project-wide workflow configuration lives in the project's settings workspace. */
export async function openAgentWorkflow(surface: Page | Locator) {
  const close = surface.getByRole('button', { name: 'Close idea details', exact: true });
  if (await close.isVisible()) await close.click();
  if (await surface.locator('.cf-workflow-page').isVisible()) return;
  await openProjectSettings(surface, 'Agent workflow');
  await expect(surface.locator('.cf-workflow-page')).toBeVisible();
}

export async function openWorkflowSettings(surface: Page | Locator) {
  await openAgentWorkflow(surface);
  const pages = surface.getByRole('navigation', { name: 'Agent workflow pages', exact: true });
  await pages.getByRole('button', { name: 'Idea Board Workflow', exact: true }).click();
  await expect(surface.locator('.cf-workflow-settings-page')).toBeVisible();
  await expect(pages.getByRole('button', { name: 'Idea Board Workflow', exact: true })).toHaveAttribute('aria-current', 'page');
}

export async function openWorkflowAttempts(surface: Page | Locator) {
  await openAgentWorkflow(surface);
  const pages = surface.getByRole('navigation', { name: 'Agent workflow pages', exact: true });
  await pages.getByRole('button', { name: 'Step attempts', exact: true }).click();
  await expect(pages.getByRole('button', { name: 'Step attempts', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(surface.getByRole('region', { name: 'Workflow step attempts', exact: true })).toBeVisible();
}

export async function openWorkflowTemplates(surface: Page | Locator) {
  await openAgentWorkflow(surface);
  await surface.getByRole('navigation', { name: 'Agent workflow pages', exact: true }).getByRole('button', { name: 'Answer / output templates', exact: true }).click();
  await expect(surface.getByRole('heading', { name: 'Answer / output templates', exact: true })).toBeVisible();
}

/** Tests explicitly choose a card; production execution never falls back to another request. */
export async function openWorkflowRuns(surface: Page | Locator, request?: string | Locator) {
  const close = surface.getByRole('button', { name: 'Close idea details', exact: true });
  if (await close.isVisible()) await close.click();
  const navigation = surface.getByRole('button', { name: 'Expand navigation panel', exact: true });
  if (await navigation.isVisible()) await navigation.click();
  await surface.locator('.cf-sidebar').getByRole('button', { name: /^Idea board/ }).click();
  const cards = surface.locator('.cf-idea-card');
  const card = typeof request === 'string'
    ? cards.filter({ has: ('page' in surface ? surface.page() : surface).locator('.cf-idea-id').filter({ hasText: new RegExp(`^${request.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }) }).first()
    : request ?? cards.first();
  await expect(card).toBeVisible();
  await card.locator('.cf-idea-open').click();
  await surface.getByRole('navigation', { name: 'Idea sections', exact: true }).getByRole('button', { name: 'Workflow runs', exact: true }).click();
  await expect(surface.getByRole('region', { name: 'Request workflow execution', exact: true })).toBeVisible();
}
