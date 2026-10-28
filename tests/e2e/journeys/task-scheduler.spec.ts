import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';

for (const theme of ['light', 'dark']) test(`task scheduler preserves drafts and makes routing, recurrence and recovery clear in ${theme}`, async ({ page }) => {
  test.setTimeout(90000);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#surface=node-1'); await expect(page.locator('html')).toHaveAttribute('data-prototype-ready', 'true');
  await page.evaluate(value => { document.body.classList.toggle('theme-light', value === 'light'); document.body.classList.toggle('theme-dark', value === 'dark'); }, theme);
  await page.getByRole('button', { name: 'The Council', exact: true }).first().click();
  await page.getByRole('button', { name: 'Explore Council example', exact: true }).click();
  const nav = page.getByRole('navigation', { name: 'Council workspace', exact: true });
  await nav.getByRole('button', { name: 'Task scheduler', exact: true }).click();
  await page.getByRole('button', { name: 'Explore scheduler example', exact: true }).click();
  await page.getByRole('button', { name: 'New scheduled task', exact: true }).click();
  const form = page.getByRole('form', { name: 'Scheduled task settings', exact: true });
  await form.getByLabel('Task name', { exact: true }).fill('Weekly architecture review');
  await form.getByRole('combobox', { name: 'Project team', exact: true }).selectOption('team-example');
  await form.getByRole('combobox', { name: 'Route to', exact: true }).selectOption('team');
  await form.getByRole('combobox', { name: 'Assigned team member', exact: true }).selectOption('agent-architect');
  await form.getByLabel('Task prompt', { exact: true }).fill('Review boundaries and record actionable improvements.');
  await form.getByRole('combobox', { name: 'Timing', exact: true }).selectOption('weekly');
  await form.getByLabel('Saved timezone', { exact: true }).fill('Europe/Berlin');
  await form.getByLabel('Fri', { exact: true }).check();
  await nav.getByRole('button', { name: 'Definitions', exact: true }).click();
  await nav.getByRole('button', { name: 'Task scheduler', exact: true }).click();
  await expect(form.getByLabel('Task prompt', { exact: true })).toHaveValue('Review boundaries and record actionable improvements.');
  await form.getByLabel('Saved timezone', { exact: true }).fill('Not/AZone');
  await form.getByRole('button', { name: 'Save schedule', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('valid IANA timezone');
  await expect(form.getByLabel('Task name', { exact: true })).toHaveValue('Weekly architecture review');
  await form.getByLabel('Saved timezone', { exact: true }).fill('Europe/Berlin');
  const region = page.getByRole('region', { name: 'Task scheduler', exact: true });
  await mkdir('reports/task-scheduler', { recursive: true });
  for (const width of [1280, 360]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await region.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await region.screenshot({ path: `reports/task-scheduler/form-${theme}-${width}.png` });
    expect((await new AxeBuilder({ page }).include('[aria-label="Task scheduler"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
  }
  await form.getByRole('button', { name: 'Save schedule', exact: true }).click();
  await expect(form).toHaveCount(0);
  const list = page.getByRole('list', { name: 'Saved task schedules', exact: true });
  await expect(list).toContainText('Example studio team → Architect');
  await expect(list).toContainText('Mon, Fri at 09:00 · Europe/Berlin');
  await expect(list).toContainText('Paused');
  for (const width of [1280, 360]) { await page.setViewportSize({ width, height: 900 }); expect(await region.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true); await region.screenshot({ path: `reports/task-scheduler/saved-${theme}-${width}.png` }); }
  await page.getByRole('button', { name: 'Archive Weekly architecture review', exact: true }).click();
  await expect(list).not.toContainText('Weekly architecture review');
  await page.getByLabel('Show archived schedules', { exact: true }).check(); await expect(list).toContainText('Archived');
  expect(errors).toEqual([]);
});
