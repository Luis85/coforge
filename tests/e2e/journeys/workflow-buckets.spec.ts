import { expect, test } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
import { openWorkflowSettings } from '../support/workflow-navigation';

for (const width of [1280, 360]) for (const theme of ['light', 'dark']) {
  test(`bucket-first workflow editing and left alignment at ${width}px in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/#surface=node-1');
    await expect(page.locator('html')).toHaveAttribute('data-prototype-ready', 'true');
    await page.evaluate(next => {
      document.body.classList.toggle('theme-dark', next === 'dark');
      document.body.classList.toggle('theme-light', next === 'light');
    }, theme);
    await openWorkflowSettings(page);
    const outline = page.getByRole('region', { name: 'Workflow step order', exact: true });
    await outline.getByRole('button', { name: 'Edit Up next bucket', exact: true }).click();
    await page.getByLabel('Bucket name', { exact: true }).fill('Discovery');
    await page.getByLabel('Bucket description', { exact: true }).fill('Plan the next useful increment.');
    await outline.getByRole('button', { name: 'Add bucket', exact: true }).click();
    await page.getByLabel('Bucket name', { exact: true }).fill('Research');
    const moveResearch = outline.getByRole('button', { name: 'Move Research bucket up', exact: true });
    await moveResearch.focus();
    await page.keyboard.press('Enter');
    await expect(moveResearch).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(moveResearch).toBeFocused();
    await outline.locator('[data-step-id="plan"] .cf-workflow-step-select').click();
    await page.getByLabel('Bucket', { exact: true }).selectOption({ label: 'Research' });
    const research = outline.getByRole('list', { name: 'Steps in Research', exact: true });
    await expect(research.locator('[data-step-id]')).toHaveCount(1);
    await expect(research).toContainText('Plan');
    await outline.getByRole('button', { name: 'Edit Research bucket', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Remove Research bucket', exact: true })).toBeDisabled();
    await outline.locator('[data-step-id="plan"] .cf-workflow-step-select').click();
    const editor = page.getByRole('region', { name: 'Selected workflow step', exact: true });
    const name = editor.getByLabel('Step name', { exact: true });
    await name.scrollIntoViewIfNeeded();
    expect(await outline.locator('.cf-workflow-step-select').evaluateAll(buttons => buttons.every(button => {
      const row = button.getBoundingClientRect();
      const number = button.querySelector('.cf-workflow-step-number')!.getBoundingClientRect();
      const title = button.querySelector('strong')!.getBoundingClientRect();
      return number.left - row.left <= 14 && title.left - row.left <= 46 && row.height <= 68;
    }))).toBe(true);
    expect(await editor.evaluate(root => {
      const targets = root.querySelectorAll('h2, label, input, select, textarea, summary, p');
      return [...targets].filter(el => el.getBoundingClientRect().width > 0)
        .every(el => ['start', 'left'].includes(getComputedStyle(el).textAlign));
    })).toBe(true);
    expect(await editor.evaluate(root => {
      const heading = root.querySelector('h2')?.getBoundingClientRect();
      const field = root.querySelector('.cf-field')?.getBoundingClientRect();
      return Boolean(heading && field && Math.abs(heading.left - field.left) <= 2);
    })).toBe(true);
    expect(await page.locator('.cf-workflow-settings-page').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    expect((await new AxeBuilder({ page }).include('.cf-workflow-settings-page').analyze()).violations).toEqual([]);
    await mkdir('reports/workflow-buckets', { recursive: true });
    await page.locator('.cf-workflow-editor-layout').screenshot({ path: `reports/workflow-buckets/editor-${theme}-${width}.png` });
    await page.getByRole('button', { name: 'Save workflow', exact: true }).click();
    await expect(page.locator('.cf-workflow-editor-notice')).toContainText('Workflow saved.');
    await outline.getByRole('button', { name: 'Edit Discovery bucket', exact: true }).click();
    await page.getByLabel('Bucket name', { exact: true }).fill('Unsaved rename');
    await page.getByRole('button', { name: 'Discard workflow changes', exact: true }).click();
    await expect(outline.getByRole('button', { name: 'Edit Discovery bucket', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Resume automation', exact: true })).toBeVisible();
    await page.getByRole('button', { name: /^Idea board/ }).first().click();
    await expect(page.locator('.cf-kanban-column h2').filter({ hasText: /^Discovery$/ })).toBeVisible();
    await expect(page.locator('.cf-kanban-column h2').filter({ hasText: /^Research$/ })).toBeVisible();
  });
}

test('long authored bucket labels and descriptions wrap inside their private board column', async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 900 });
  await page.goto('/#surface=node-1');
  await expect(page.locator('html')).toHaveAttribute('data-prototype-ready', 'true');
  await openWorkflowSettings(page);
  await page.getByRole('button', { name: 'Edit Up next bucket', exact: true }).click();
  const label = 'Discovery'.repeat(10);
  await page.getByLabel('Bucket name', { exact: true }).fill(label);
  await page.getByLabel('Bucket description', { exact: true }).fill('Research'.repeat(100));
  await page.getByRole('button', { name: 'Save workflow', exact: true }).click();
  await expect(page.locator('.cf-workflow-editor-notice')).toContainText('Workflow saved.');
  await page.getByRole('button', { name: /^Idea board/ }).first().click();
  const heading = page.getByRole('heading', { name: label, exact: true });
  await heading.scrollIntoViewIfNeeded();
  expect(await heading.evaluate(el => {
    const column = el.closest('.cf-kanban-column');
    const count = column?.querySelector('.cf-column-count');
    if (!column || !count) return false;
    const bounds = column.getBoundingClientRect();
    const title = el.getBoundingClientRect();
    return title.left >= bounds.left && title.right <= count.getBoundingClientRect().left
      && column.scrollWidth <= column.clientWidth + 1;
  })).toBe(true);
  expect(await page.locator('.cf-board-page').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
});
