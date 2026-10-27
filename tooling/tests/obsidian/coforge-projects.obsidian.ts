import { expect as browserExpect } from '@playwright/test';
import { describe, expect } from 'vitest';
import { test } from './support/obsidian-fixture.ts';

describe('CoForge projects in the contained vault', () => {
  test('hides the native header only inside the CoForge studio', async ({ obsidian }) => {
    const type = obsidian.pluginViewTypes.find(value => value === `${obsidian.pluginId}-view-project-workbench`);
    expect(type).toBeDefined();
    const view = await obsidian.openView(type!);
    await browserExpect(view.getByText('Twitch chat is not connected.', { exact: true })).toBeVisible();
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
    await view.getByRole('button', { name: 'Test commands locally', exact: true }).click();
    await view.getByLabel('Chat message', { exact: true }).fill('!register');
    await view.getByRole('button', { name: 'Send chat message', exact: true }).click();
    await browserExpect(view.getByLabel('Chat message', { exact: true })).toHaveValue('');
    await view.getByLabel('Chat message', { exact: true }).fill('!request CFP-001 Build a lunar garden');
    await view.getByRole('button', { name: 'Send chat message', exact: true }).click();
    await expect.poll(() => obsidian.eval(({ app }) => app.vault.getMarkdownFiles().filter(file => file.path.startsWith('CoForge/Ideas/')).length)).toBe(1);
    await view.getByLabel('Simulated viewer name', { exact: true }).fill('Bug reporter');
    await view.getByLabel('Chat message', { exact: true }).fill('!register');
    await view.getByRole('button', { name: 'Send chat message', exact: true }).click();
    await browserExpect(view.getByLabel('Chat message', { exact: true })).toHaveValue('');
    await view.getByLabel('Chat message', { exact: true }).fill('!bug CFP-001 The lunar gate crashes the game');
    await view.getByRole('button', { name: 'Send chat message', exact: true }).click();
    await expect.poll(() => obsidian.eval(({ app }) => app.vault.getMarkdownFiles().filter(file => file.path.startsWith('CoForge/Ideas/')).length)).toBe(2);
    const notes = await obsidian.eval(async ({ app }) => Promise.all(app.vault.getMarkdownFiles()
      .filter(file => file.path.startsWith('CoForge/')).map(async file => ({ path: file.path, content: await app.vault.read(file) }))));
    const project = notes.find(note => note.content.includes('name: Obsidian moon'));
    expect(project?.path).toMatch(/^CoForge\/Projects\/.*\.md$/);
    expect(project?.content).toContain('/synthetic/games/obsidian-moon');
    const id = project?.content.match(/^id: (.+)$/m)?.[1];
    expect(id).toBeDefined();
    expect(notes.find(note => note.path.startsWith('CoForge/Ideas/'))?.content).toContain(`coforge-project: ${id}`);
    expect(notes.find(note => note.content.includes('The lunar gate crashes'))?.content).toContain('coforge-kind: bug');
    await view.getByRole('button', { name: 'Players', exact: true }).click();
    await view.getByRole('button', { name: /Bug reporter.*simulator:bug reporter/ }).click();
    await browserExpect(view.getByRole('complementary', { name: 'Player details' })).toContainText('Chat-presence minutes');
    await view.getByRole('button', { name: 'Block participation', exact: true }).click();
    await view.getByRole('button', { name: 'Confirm block', exact: true }).click();
    await browserExpect(view.getByRole('button', { name: 'Unblock participation', exact: true })).toBeVisible();
    await view.getByRole('button', { name: 'Stream chat', exact: true }).click();
    await view.getByRole('tab', { name: 'Bot messages', exact: true }).click();
    await view.getByLabel('Message text', { exact: true }).fill('Join The Hood with !register');
    await view.getByLabel('Interval (minutes)', { exact: true }).fill('5');
    await view.getByRole('button', { name: 'Add message', exact: true }).click();
    await browserExpect(view.locator('.cf-stream-message-list')).toContainText('Paused');
    await view.getByRole('button', { name: 'Community settings', exact: true }).click();
    await view.getByLabel('Community actor name', { exact: true }).fill('Citizen');
    await view.getByLabel('Currency name', { exact: true }).fill('credits');
    await view.getByRole('button', { name: 'Add rank', exact: true }).click();
    await view.getByLabel('Rank 2 name', { exact: true }).fill('Builder');
    await view.getByLabel('Rank 2 minimum XP', { exact: true }).fill('200');
    await view.getByRole('button', { name: 'Save community settings', exact: true }).click();
    await browserExpect(view.getByText('Community settings saved. Existing balances are unchanged.', { exact: true })).toBeVisible();
    const saved: unknown = JSON.parse(await obsidian.eval(({ app, pluginId }) => app.vault.adapter.read(`${app.vault.configDir}/plugins/${pluginId}/coforge-state.json`)));
    expect(saved).toMatchObject({ population: { players: expect.arrayContaining([expect.objectContaining({ id: 'simulator:bug reporter', blocked: true })]),
      environment: { actorName: 'Citizen', currencyName: 'credits', ranks: [{ name: 'Agent', minimumXp: 0 }, { name: 'Builder', minimumXp: 200 }] } },
      streamMessages: [expect.objectContaining({ text: 'Join The Hood with !register', active: false, intervalMinutes: 5 })] });
    await obsidian.reloadPlugin();
    const restored = await obsidian.openView(type!);
    await restored.getByRole('button', { name: 'Players', exact: true }).click();
    await restored.getByRole('button', { name: /Bug reporter.*simulator:bug reporter/ }).click();
    await browserExpect(restored.getByRole('button', { name: 'Unblock participation', exact: true })).toBeVisible();
    await browserExpect(restored.getByRole('complementary', { name: 'Player details' })).toContainText('credits');
    await obsidian.screenshot('moon-project-request');
    expect(obsidian.errors()).toEqual([]);
  });
});
