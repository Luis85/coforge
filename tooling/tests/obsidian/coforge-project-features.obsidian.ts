import { expect as browserExpect } from '@playwright/test';
import { describe, expect } from 'vitest';
import { test } from './support/obsidian-fixture';
import { splitNote } from '../../../src/plugin/infrastructure/coforge/markdown';

describe('Project feature groups in the contained host', () => {
  test('saves visibility in the canonical project note and restores it after reload', async ({ obsidian }) => {
    let view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await view.locator('.cf-project-switcher').click();
    await view.getByRole('button', { name: 'Add project', exact: true }).click();
    await view.getByLabel('Project name', { exact: true }).fill('No stream project');
    await view.getByLabel(/^Project path/).fill('/synthetic/project-features');
    await view.getByLabel('Description', { exact: true }).fill('A contained workspace that does not need streaming features.');
    await view.getByRole('button', { name: 'Create project', exact: true }).click();
    await browserExpect(view.locator('.cf-project-switcher')).toContainText('No stream project');
    const body = await obsidian.eval(async ({ app }) => {
      const file = app.vault.getMarkdownFiles().find(file => file.path.startsWith('CoForge/Projects/'));
      if (!file) throw new Error('Missing canonical project note');
      await app.fileManager.processFrontMatter(file, properties => { properties.human = 'keep'; });
      await app.vault.process(file, text => text + '\r\n## Human notes\r\nKeep this body.\r\n');
      return app.vault.read(file);
    });
    await view.getByRole('button', { name: 'Project settings', exact: true }).click();
    await view.getByLabel('Show Stream features', { exact: true }).uncheck();
    await view.getByLabel('Show Service Design', { exact: true }).uncheck();
    await view.getByRole('button', { name: 'Save settings', exact: true }).click();
    await browserExpect(view.locator('.cf-settings-save-message')).toContainText('Settings saved');
    await browserExpect(view.getByRole('group', { name: 'Stream navigation', exact: true })).toHaveCount(0);
    await browserExpect(view.locator('.cf-sidebar').getByRole('button', { name: 'Service Design', exact: true })).toHaveCount(0);
    await view.getByRole('button', { name: /^Idea board/ }).first().click();
    await browserExpect(view.locator('.cf-chat-panel')).toHaveCount(0);
    await obsidian.reloadPlugin();
    view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await browserExpect(view.locator('.cf-board-page')).toBeVisible();
    await browserExpect(view.getByRole('group', { name: 'Stream navigation', exact: true })).toHaveCount(0);
    await view.getByRole('button', { name: 'Project settings', exact: true }).click();
    await browserExpect(view.getByLabel('Show Stream features', { exact: true })).not.toBeChecked();
    await browserExpect(view.getByLabel('Show Service Design', { exact: true })).not.toBeChecked();
    await browserExpect(view.getByLabel('Show The Council', { exact: true })).toBeChecked();
    const saved = await obsidian.eval(async ({ app }) => {
      const file = app.vault.getMarkdownFiles().find(file => file.path.startsWith('CoForge/Projects/'));
      if (!file) throw new Error('Missing canonical project note');
      return app.vault.read(file);
    });
    expect(saved).toContain('coforge-feature-groups:');
    expect(saved).toContain('coforge-features:');
    expect(saved).toContain('human: keep');
    expect(splitNote(saved).body).toBe(splitNote(body).body);
    await view.getByLabel('Show Service Design', { exact: true }).scrollIntoViewIfNeeded();
    await obsidian.screenshot('project-feature-groups');
    expect(obsidian.errors()).toEqual([]);
  });
});
