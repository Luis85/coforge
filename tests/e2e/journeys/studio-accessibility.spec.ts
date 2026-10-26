import { test, expect } from '@playwright/test';

test('collapsed studio navigation keeps its visible labels available to assistive technology', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/#surface=node-1');
  await expect(page.locator('html')).toHaveAttribute('data-prototype-ready', 'true');

  const sidebar = page.locator('.cf-sidebar');
  const navigation = sidebar.getByRole('navigation', { name: 'CoForge navigation' });
  await expect(navigation.getByRole('button', { name: 'Idea board', exact: true })).toBeVisible();
  await navigation.getByRole('button', { name: 'Stream chat', exact: true }).click();
  await expect(page.locator('.cf-topbar strong')).toHaveText('Stream chat');

  const project = sidebar.getByRole('button', { name: /Mosslight.*Community game project/ });
  await expect(project).toBeVisible();
  await project.click();
  await expect(page.locator('.cf-topbar strong')).toHaveText('Settings');
});
