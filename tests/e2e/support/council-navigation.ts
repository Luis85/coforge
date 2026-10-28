import { expect, type Locator, type Page } from '@playwright/test';

export async function showAdvancedCouncilTools(surface: Page | Locator) {
  const advanced = surface.locator('.cf-council-advanced');
  await expect(advanced).toBeVisible();
  if (!await advanced.evaluate(element => element.hasAttribute('open')))
    await advanced.locator('summary').first().click();
}

/** Follow the visible Council task/administration hierarchy without bypassing navigation. */
export async function councilPageButton(surface: Page | Locator, name: string) {
  if (name === 'Ask the Council')
    return surface.getByRole('navigation', { name: 'Council tasks', exact: true }).getByRole('button', { name, exact: true });
  await showAdvancedCouncilTools(surface);
  return surface.getByRole('navigation', { name: 'Council workspace', exact: true }).getByRole('button', { name, exact: true });
}

export async function openCouncilPage(surface: Page | Locator, name: string) {
  const button = await councilPageButton(surface, name);
  await button.click();
  await expect(button).toHaveAttribute('aria-current', 'page');
}
