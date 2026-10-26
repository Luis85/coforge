import { expect as browserExpect } from '@playwright/test';
import { describe, expect } from 'vitest';
import { test } from './support/obsidian-fixture.ts';

describe('CoForge projects in the contained vault', () => {
  test('hides the native header only inside the CoForge studio', async ({ obsidian }) => {
    const type = obsidian.pluginViewTypes.find(value => value === `${obsidian.pluginId}-view-project-workbench`);
    expect(type).toBeDefined();
    const view = await obsidian.openView(type!);
    await browserExpect(view.locator('.cf-studio')).toBeVisible();
    await browserExpect(view.locator(':scope > .view-header')).toBeHidden();
    await obsidian.screenshot('studio-without-native-header');
    await obsidian.eval(async ({ app }) => {
      const note = app.vault.getMarkdownFiles().find(file => !file.path.startsWith('CoForge/'));
      if (!note) throw new Error('The contained fixture has no ordinary note.');
      await app.workspace.getLeaf('tab').openFile(note);
    });
    await browserExpect(obsidian.page.locator('.workspace-leaf-content[data-type="markdown"]').last().locator(':scope > .view-header')).toBeVisible();
    expect(obsidian.errors()).toEqual([]);
  });

  test('creates a project note and attaches a viewer request to that project', async ({ obsidian }) => {
    const type = obsidian.pluginViewTypes.find(value => value === `${obsidian.pluginId}-view-project-workbench`);
    expect(type).toBeDefined();
    const view = await obsidian.openView(type!);
    await view.locator('.cf-project-switcher').click();
    await view.getByRole('button', { name: 'Add project', exact: true }).click();
    await view.getByLabel('Project name', { exact: true }).fill('Obsidian moon');
    await view.getByLabel(/^Project path/).fill('/synthetic/games/obsidian-moon');
    await view.getByLabel('Description', { exact: true }).fill('A quiet moon garden built with the stream community.');
    await view.getByRole('button', { name: 'Create project', exact: true }).click();
    await browserExpect(view.locator('.cf-project-switcher')).toContainText('Obsidian moon');
    await view.getByRole('button', { name: 'Stream chat', exact: true }).click();
    await view.getByLabel('Chat message', { exact: true }).fill('!request CFP-002 Build a lunar garden');
    await view.getByRole('button', { name: 'Send chat message', exact: true }).click();
    await expect.poll(() => obsidian.eval(({ app }) => app.vault.getMarkdownFiles().filter(file => file.path.startsWith('CoForge/Ideas/')).length)).toBe(1);
    const notes = await obsidian.eval(async ({ app }) => Promise.all(app.vault.getMarkdownFiles()
      .filter(file => file.path.startsWith('CoForge/')).map(async file => ({ path: file.path, content: await app.vault.read(file) }))));
    const project = notes.find(note => note.content.includes('name: Obsidian moon'));
    expect(project?.path).toMatch(/^CoForge\/Projects\/.*\.md$/);
    expect(project?.content).toContain('/synthetic/games/obsidian-moon');
    const id = project?.content.match(/^id: (.+)$/m)?.[1];
    expect(id).toBeDefined();
    expect(notes.find(note => note.path.startsWith('CoForge/Ideas/'))?.content).toContain(`coforge-project: ${id}`);
    await obsidian.screenshot('moon-project-request');
    expect(obsidian.errors()).toEqual([]);
  });
});
