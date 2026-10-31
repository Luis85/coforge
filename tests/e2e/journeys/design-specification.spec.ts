import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
import { openWorkflowRuns } from '../support/workflow-navigation';

for (const theme of ['light', 'dark']) {
  test(`reads the simulated Design specification before Build in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/#surface=node-1');
    await expect(page.locator('html')).toHaveAttribute('data-prototype-ready', 'true');
    await page.evaluate(theme => {
      document.body.classList.toggle('theme-light', theme === 'light');
      document.body.classList.toggle('theme-dark', theme === 'dark');
    }, theme);
    await openWorkflowRuns(page, 'CF-101');
    const execution = page.getByRole('region', { name: 'Request workflow execution', exact: true });
    for (const name of ['Start · Screen', 'Run · Score', 'Run · Plan', 'Run · Design']) {
      const action = execution.getByRole('button', { name, exact: true });
      await expect(action).toBeEnabled();
      await action.click();
    }
    await expect(execution.getByRole('button', { name: 'Run · Build', exact: true })).toBeEnabled();
    const drawer = page.getByRole('dialog', { name: 'Let us pet the forest foxes', exact: true });
    await drawer.getByRole('button', { name: 'Plan & Design', exact: true }).click();
    const specification = drawer.getByRole('region', { name: 'Design specification', exact: true });
    await expect(specification).toContainText('Simulated Design:');
    await expect(specification).toContainText('Intended behavior');
    await expect(specification).toContainText('Failure and recovery');
    await expect(specification).toContainText('no model was called');
    await expect(drawer.getByRole('button', { name: /^Run · Build/ })).toBeEnabled();
    await mkdir('reports/design-step', { recursive: true });
    for (const width of [1280, 360]) {
      await page.setViewportSize({ width, height: 900 });
      await specification.getByRole('heading', { name: 'Design specification', exact: true }).scrollIntoViewIfNeeded();
      expect(await drawer.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await drawer.screenshot({ path: `reports/design-step/specification-${theme}-${width}.png` });
    }
    expect((await new AxeBuilder({ page }).include('.cf-idea-drawer').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
  });
}
