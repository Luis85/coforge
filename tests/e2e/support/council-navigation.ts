import { expect, type Locator, type Page } from '@playwright/test';

const pages: Record<string, [string, string]> = {
  'Ask the Council': ['Ask', 'New question'], 'New question': ['Ask', 'New question'],
  Definitions: ['Setup', 'Councils & roster'], 'Councils & roster': ['Setup', 'Councils & roster'],
  'Submit existing note': ['Ask', 'Existing note'], 'Existing note': ['Ask', 'Existing note'],
  'Watched inboxes': ['Automation', 'Watched inboxes'], 'Task scheduler': ['Automation', 'Schedules'], Schedules: ['Automation', 'Schedules'],
  'Event triggers': ['Automation', 'Event triggers'], 'Run monitor': ['Activity', 'Runs & answers'], 'Runs & answers': ['Activity', 'Runs & answers'],
  'Council workflows': ['Automation', 'Proposal workflows'], 'Proposal workflows': ['Automation', 'Proposal workflows'],
  'Team messages': ['Activity', 'Team messages'], 'Definition folders': ['Setup', 'Storage folders'], 'Storage folders': ['Setup', 'Storage folders'],
};
export async function showAdvancedCouncilTools(surface: Page | Locator) {
  await expect(surface.getByRole('navigation', { name: 'Council tasks', exact: true })).toBeVisible();
}
/** Follow the visible task family and secondary page without bypassing user navigation. */
export async function councilPageButton(surface: Page | Locator, name: string) {
  const page = pages[name]; if (!page) throw new Error(`Unknown Council page ${name}`);
  await surface.getByRole('navigation', { name: 'Council tasks', exact: true }).getByRole('button', { name: page[0], exact: true }).click();
  return surface.getByRole('navigation', { name: 'Council workspace', exact: true }).getByRole('button', { name: page[1], exact: true });
}
export async function openCouncilPage(surface: Page | Locator, name: string) {
  const button = await councilPageButton(surface, name); await button.click();
  await expect(button).toHaveAttribute('aria-current', 'page');
}
