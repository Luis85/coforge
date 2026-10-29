import { expect, type Locator, type Page } from '@playwright/test';

type SettingsPage = 'General' | 'Requests' | 'Repository' | 'Agent workflow' | 'Runtime' | 'Data & examples';

/** A task's accessible name includes its visible supporting description. */
export function settingsPageButton(surface: Page | Locator, name: SettingsPage) {
  const title = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return surface.getByRole('navigation', { name: 'Project settings pages', exact: true })
    .getByRole('button', { name: new RegExp(`^${title}(?:\\s|$)`) });
}

/** Browser and native journeys select the task before accessing its settings. */
export async function openProjectSettings(surface: Page | Locator, name: SettingsPage) {
  if (!await surface.locator('.cf-settings-page').isVisible())
    await surface.locator('.cf-sidebar').getByRole('button', { name: 'Project settings', exact: true }).click();
  const item = settingsPageButton(surface, name);
  await item.click();
  await expect(item).toHaveAttribute('aria-current', 'page');
}
