import { expect as browserExpect } from '@playwright/test';
import { describe, expect } from 'vitest';
import { test } from './support/obsidian-fixture.ts';

describe('Owner request admission in native Obsidian', () => {
  test('shows that studio requests skip screening and persists the exemption without an agent attempt', async ({ obsidian }) => {
    const view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await view.locator('.cf-project-switcher').click();
    await view.getByRole('button', { name: 'Add project', exact: true }).click();
    await view.getByLabel('Project name', { exact: true }).fill('Owner screening fixture');
    await view.getByLabel(/^Project path/).fill('/synthetic/owner-screening');
    await view.getByLabel('Description', { exact: true }).fill('Owner requests go directly to scoring.');
    await view.getByRole('button', { name: 'Create project', exact: true }).click();
    await view.getByRole('button', { name: 'New request', exact: true }).first().click();
    await view.getByLabel(/^The idea/).fill('Owner request without screening');
    await browserExpect(view.getByText(/skips screening as an owner request/)).toBeVisible();
    await obsidian.screenshot('owner-request-intake');
    await view.getByRole('button', { name: 'Add to the board', exact: true }).click();
    const card = view.locator('.cf-idea-card').filter({ hasText: 'Owner request without screening' });
    await browserExpect(card).toBeVisible();
    await card.click({ button: 'right' });
    await view.getByRole('menuitem', { name: /^Open CF-/ }).click();
    await browserExpect(view.getByText('Owner request · screening not required', { exact: true })).toBeVisible();
    await browserExpect(view.getByText('Screening not required', { exact: true })).toBeVisible();
    await browserExpect(view.getByRole('button', { name: /Start · Score/ })).toBeVisible();
    const notes = await obsidian.eval(async ({ app }) => {
      const files = app.vault.getMarkdownFiles().filter(file => file.path.startsWith('CoForge/Ideas/'));
      return Promise.all(files.map(file => app.vault.read(file)));
    });
    const note = notes.find(content => content.includes('Owner request without screening'));
    expect(note).toContain('status: screened'); expect(note).toContain('screening-provider: owner');
    await obsidian.screenshot('owner-request-admitted');
    expect(obsidian.errors()).toEqual([]);
  });
});
