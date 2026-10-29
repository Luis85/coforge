import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';

for (const theme of ['light', 'dark']) {
  test(`a card assessment preserves an existing Council draft until replaced in ${theme}`, async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/#surface=node-1');
    await expect(page.locator('html')).toHaveAttribute('data-prototype-ready', 'true');
    await page.evaluate(value => { document.body.classList.remove('theme-light', 'theme-dark'); document.body.classList.add(`theme-${value}`); }, theme);
    await page.locator('.cf-sidebar').getByRole('button', { name: 'The Council', exact: true }).click();
    await page.getByRole('button', { name: 'Explore Council example', exact: true }).click();
    await page.getByLabel('Task title', { exact: true }).fill('Keep this unrelated question');
    await page.getByLabel('Your question or task', { exact: true }).fill('These authored words must survive a card action.');
    const board = page.locator('.cf-sidebar').getByRole('button', { name: /^Idea board/ });
    const title = 'Save the camp between visits';
    await board.click();
    const card = page.locator('.cf-idea-card').filter({ hasText: title });
    const originalCard = await card.innerText();
    await card.click({ button: 'right' });
    const action = page.getByRole('menuitem', { name: /^Send to the Council\b/ });
    await expect(action).toBeEnabled(); await action.click();
    const replacement = page.getByRole('region', { name: 'Replace Council draft', exact: true });
    await expect(replacement).toContainText('Keep this unrelated question');
    await replacement.getByRole('button', { name: 'Keep current draft', exact: true }).click();
    await expect(page.getByLabel('Your question or task', { exact: true })).toHaveValue('These authored words must survive a card action.');
    await board.click();
    await card.getByRole('button', { name: /^Actions for CF-/ }).focus();
    await page.keyboard.press('Enter'); await action.click();
    await replacement.getByRole('button', { name: 'Replace draft with item assessment', exact: true }).click();
    await expect(page.getByLabel('Task title', { exact: true })).toHaveValue(new RegExp(`Assess CF-.+: ${title}`));
    await expect(page.getByRole('region', { name: 'Council task history', exact: true })).toContainText('No tasks yet');
    await page.getByRole('combobox', { name: 'Council', exact: true }).selectOption('council-example');
    await page.getByRole('button', { name: 'Save task and review', exact: true }).click();
    const review = page.getByRole('region', { name: 'Review Council task', exact: true });
    await expect(review).toContainText(title);
    await expect(review).toContainText('Captured request context');
    await expect(review).toContainText('open gaps');
    await expect(page.getByRole('region', { name: 'Council task history', exact: true })).toContainText('Saved note · no retained run');
    await mkdir('reports/council-card-assessment', { recursive: true });
    await page.setViewportSize({ width: 480, height: 1000 });
    expect(await page.locator('.cf-council').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    expect((await new AxeBuilder({ page }).include('.cf-council').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
    await page.locator('.cf-council').screenshot({ path: `reports/council-card-assessment/linked-review-${theme}-480.png` });
    await board.click();
    await expect(card).toHaveText(originalCard, { useInnerText: true });
  });
}
