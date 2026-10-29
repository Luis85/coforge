import { expect, type Locator, type Page } from '@playwright/test';

export async function showAdvancedCouncilTools(surface: Page | Locator) {
  await expect(surface.getByRole('navigation', { name: 'Council workspace', exact: true })).toBeVisible();
}

/** Follow the visible Council task/administration hierarchy without bypassing navigation. */
export async function councilPageButton(surface: Page | Locator, name: string) {
  return surface.getByRole('navigation', { name: 'Council workspace', exact: true }).getByRole('button', { name, exact: true });
}

export async function openCouncilPage(surface: Page | Locator, name: string) {
  const button = await councilPageButton(surface, name);
  await button.click();
  await expect(button).toHaveAttribute('aria-current', 'page');
}
