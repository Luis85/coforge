import { test, expect, type Page } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { openProjectSettings } from '../support/settings-navigation';

async function projects(page: Page) {
  await page.goto('/#surface=node-1');
  await expect(page.locator('html')).toHaveAttribute('data-prototype-ready', 'true');
  await page.locator('.cf-project-switcher').click();
  await expect(page.locator('.cf-topbar strong')).toHaveText('Projects');
}
async function fillProject(page: Page) {
  await page.getByRole('button', { name: 'Add project', exact: true }).click();
  await page.getByLabel('Project name', { exact: true }).fill('Moon orchard');
  await page.getByLabel(/^Project path/).fill('/synthetic/games/moon-orchard');
  await page.getByLabel('Git repository URL', { exact: true }).fill('https://github.com/example/moon-orchard');
  await page.getByLabel('Website URL', { exact: true }).fill('https://moon-orchard.example');
  await page.getByLabel('Description', { exact: true }).fill('A quiet orchard on the moon, built with our community.');
}

test('adds a project, keeps boards separate, and edits its external workspace path', async ({ page }) => {
  await projects(page);
  await fillProject(page);
  await page.getByRole('button', { name: 'Create project', exact: true }).click();
  await expect(page.locator('.cf-project-switcher')).toContainText('Moon orchard');
  await expect(page.locator('.cf-idea-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'New request', exact: true }).first().click();
  await page.getByLabel(/^The idea/).fill('A moonlit orchard path');
  await page.getByRole('button', { name: 'Add to the board', exact: true }).click();
  await expect(page.locator('.cf-idea-card')).toContainText('A moonlit orchard path');

  await page.locator('.cf-project-switcher').click();
  await page.getByRole('button', { name: 'Open board for Mosslight', exact: true }).click();
  await expect(page.locator('.cf-idea-card').filter({ hasText: 'Let us pet the forest foxes' })).toHaveCount(1);
  await expect(page.locator('.cf-idea-card').filter({ hasText: 'A moonlit orchard path' })).toHaveCount(0);
  await page.locator('.cf-project-switcher').click();
  await page.getByRole('button', { name: 'Settings for Moon orchard', exact: true }).click();
  await openProjectSettings(page, 'Repository');
  await expect(page.getByLabel(/^Project path/)).toHaveValue('/synthetic/games/moon-orchard');
  await page.getByLabel(/^Project path/).fill('/synthetic/games/moon-orchard-next');
  await page.getByRole('button', { name: 'Save settings', exact: true }).click();
  await expect(page.getByText('Settings saved', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Idea board/ }).click();
  await expect(page.locator('.cf-idea-card')).toContainText('A moonlit orchard path');
});

test('viewer requests require a project ID and target that project while another board is selected', async ({ page }) => {
  await projects(page);
  await fillProject(page);
  await page.getByRole('button', { name: 'Create project', exact: true }).click();
  await page.locator('.cf-project-switcher').click();
  await page.getByRole('button', { name: 'Open board for Mosslight', exact: true }).click();
  await page.getByRole('button', { name: 'Stream chat', exact: true }).click();
  await page.getByRole('button', { name: 'Test commands locally', exact: true }).click();
  await page.getByLabel('Chat message', { exact: true }).fill('!register');
  await page.getByRole('button', { name: 'Send chat message', exact: true }).click();
  await expect(page.getByLabel('Chat message', { exact: true })).toHaveValue('');
  const message = page.getByLabel('Chat message', { exact: true });
  await message.fill('!request A lantern beside the moon gate');
  await page.getByRole('button', { name: 'Send chat message', exact: true }).click();
  await expect(message).toHaveValue('!request A lantern beside the moon gate');
  await message.fill('!request CFP-002 A lantern beside the moon gate');
  await page.getByRole('button', { name: 'Send chat message', exact: true }).click();
  await expect(message).toHaveValue('');
  await expect(page.locator('.cf-project-switcher')).toContainText('Mosslight');
  await page.locator('.cf-project-switcher').click();
  await page.getByRole('button', { name: 'Open board for Moon orchard', exact: true }).click();
  await expect(page.locator('.cf-idea-card')).toContainText('A lantern beside the moon gate');
});

for (const theme of ['light', 'dark']) {
  test(`project management and creation meet WCAG 2.1 A/AA in ${theme}`, async ({ page }) => {
    await projects(page);
    await page.evaluate(value => {
      document.body.classList.toggle('theme-dark', value === 'dark');
      document.body.classList.toggle('theme-light', value === 'light');
    }, theme);
    await fillProject(page);
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(result.violations).toEqual([]);
    await test.info().attach(`project-manager-${theme}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  });
}

test('project management and the create form fit a narrow studio pane', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await projects(page);
  await fillProject(page);
  const size = await page.evaluate(() => {
    const root = document.scrollingElement ?? document.documentElement;
    return { width: root.clientWidth, content: root.scrollWidth };
  });
  expect(size.content).toBeLessThanOrEqual(size.width);
  await test.info().attach('project-manager-narrow', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
});
