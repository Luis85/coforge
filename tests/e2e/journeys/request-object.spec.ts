import { test, expect, type Page } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';

async function capture(page: Page, theme: string, phase: string, selector: string) {
  const surface = page.locator(selector);
  await mkdir('reports/request-object', { recursive: true });
  for (const width of [1440, 480]) {
    await page.setViewportSize({ width: 1800, height: 1000 });
    await page.locator('[data-plugin-ui="coforge"]').first().evaluate((element, width) => { element.style.width = `${width}px`; element.style.maxWidth = `${width}px`; }, width);
    expect(await surface.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    expect((await new AxeBuilder({ page }).include(selector).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
    await surface.screenshot({ path: `reports/request-object/${phase}-${theme}-${width}.png` });
  }
}

for (const theme of ['light', 'dark']) {
  test(`project Request Objects retain captured categories and values in ${theme}`, async ({ page }) => {
    test.setTimeout(90000);
    await page.goto('/#surface=node-1');
    await expect(page.locator('html')).toHaveAttribute('data-prototype-ready', 'true');
    await page.evaluate(value => { document.body.classList.remove('theme-light', 'theme-dark'); document.body.classList.add(`theme-${value}`); }, theme);
    await page.locator('.cf-project-switcher').click();
    await page.getByRole('button', { name: 'Add project', exact: true }).click();
    const project = page.getByRole('form', { name: 'Add project', exact: true });
    await project.getByLabel('Project name', { exact: true }).fill('Business experiments');
    await project.getByLabel(/^Project path/).fill('/synthetic/request-object');
    await project.getByLabel('Description', { exact: true }).fill('A project with its own request categories and business metadata.');
    await project.getByRole('button', { name: 'Create project', exact: true }).click();
    const settingsButton = page.locator('.cf-sidebar').getByRole('button', { name: 'Project settings', exact: true });
    await settingsButton.click();
    await page.getByRole('navigation', { name: 'Project settings pages', exact: true }).getByRole('button', { name: /^Requests(?:\s|$)/ }).click();
    await page.getByLabel('Request note class', { exact: true }).fill('Business Idea');
    const categories = page.getByLabel('Request categories', { exact: true });
    await categories.fill('Strategy');
    await categories.press('End'); await categories.press('Enter');
    await categories.pressSequentially('Commercial');
    await page.getByRole('button', { name: 'Add request field', exact: true }).click();
    await page.getByLabel('Field 1 label', { exact: true }).fill('Audience');
    await page.getByLabel('Field 1 property key', { exact: true }).fill('target_audience');
    await page.getByRole('button', { name: 'Add request field', exact: true }).click();
    await page.getByLabel('Field 2 label', { exact: true }).fill('Investment');
    await page.getByLabel('Field 2 property key', { exact: true }).fill('investment');
    await page.getByRole('combobox', { name: 'Field 2 type', exact: true }).selectOption('number');
    await page.getByLabel('Field 2 default value', { exact: true }).fill('0');
    await page.getByRole('button', { name: 'Save settings', exact: true }).click();
    await expect(page.getByText('Settings saved', { exact: true })).toBeVisible();
    await capture(page, theme, 'configuration', '.cf-request-object-settings');
    await page.locator('.cf-sidebar').getByRole('button', { name: /^Idea board/ }).click();
    await page.getByRole('button', { name: 'New request', exact: true }).first().click();
    const drawer = page.getByRole('dialog', { name: 'New request', exact: true });
    await expect(drawer).toContainText('Business Idea');
    await expect(drawer.getByRole('combobox', { name: 'Category', exact: true })).toHaveValue('Strategy');
    await drawer.getByLabel('The idea', { exact: true }).fill('Explore a makers subscription');
    await drawer.getByLabel('A little more context', { exact: true }).fill('A small business experiment with private audience information.');
    await drawer.getByLabel('Audience', { exact: true }).fill('Independent makers');
    await expect(drawer.getByLabel('Investment', { exact: true })).toHaveValue('0');
    await capture(page, theme, 'creation', '.cf-new-idea-drawer');
    await drawer.getByRole('button', { name: 'Add to the board', exact: true }).click();
    const card = page.locator('.cf-idea-card').filter({ hasText: 'Explore a makers subscription' });
    await card.locator('.cf-idea-open').click();
    const fields = page.getByRole('region', { name: 'Captured request object', exact: true });
    await expect(fields.getByLabel('Audience', { exact: true })).toHaveValue('Independent makers');
    await fields.getByLabel('Audience', { exact: true }).fill('Local makers');
    await fields.getByRole('button', { name: 'Save request fields', exact: true }).click();
    await expect(fields.getByRole('button', { name: 'Save request fields', exact: true })).toBeDisabled();
    await capture(page, theme, 'captured-values', '.cf-request-values-editor');
    await page.getByRole('button', { name: 'Close idea details', exact: true }).click();
    await settingsButton.click();
    await page.getByRole('navigation', { name: 'Project settings pages', exact: true }).getByRole('button', { name: /^Requests(?:\s|$)/ }).click();
    await page.getByLabel('Request note class', { exact: true }).fill('Feature Idea');
    await page.getByLabel('Request categories', { exact: true }).fill('Product');
    await page.getByRole('button', { name: 'Save settings', exact: true }).click();
    await expect(page.getByText('Settings saved', { exact: true })).toBeVisible();
    await page.locator('.cf-sidebar').getByRole('button', { name: /^Idea board/ }).click();
    await card.locator('.cf-idea-open').click();
    await expect(fields.getByRole('heading', { name: 'Business Idea', exact: true })).toBeVisible();
    await expect(fields.getByLabel('Audience', { exact: true })).toHaveValue('Local makers');
    await expect(page.locator('.cf-idea-drawer')).toContainText('Strategy');
  });
}
