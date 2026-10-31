import { expect as browserExpect } from '@playwright/test';
import { describe, expect } from 'vitest';
import { test } from './support/obsidian-fixture';

async function revealProvider(field: import('@playwright/test').Locator): Promise<void> {
  await field.evaluate(element => {
    const scroll = element.closest('.cf-content');
    if (scroll) scroll.scrollTop += element.getBoundingClientRect().top - scroll.getBoundingClientRect().top - 32;
  });
}

describe('Provider model and effort in the contained host', () => {
  test('saves workflow and CoWorker choices without dispatch and restores them after reload', async ({ obsidian }) => {
    let view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await view.locator('.cf-project-switcher').click();
    await view.getByRole('button', { name: 'Add project', exact: true }).click();
    await view.getByLabel('Project name', { exact: true }).fill('Provider configuration');
    await view.getByLabel(/^Project path/).fill('/synthetic/provider-settings');
    await view.getByLabel('Description', { exact: true }).fill('Configure models and effort without starting a provider.');
    await view.getByRole('button', { name: 'Create project', exact: true }).click();
    await browserExpect(view.locator('.cf-project-switcher')).toContainText('Provider configuration');
    await view.getByRole('button', { name: 'Project settings', exact: true }).click();
    await view.getByRole('button', { name: 'Agent workflow', exact: true }).click();
    await view.getByRole('button', { name: 'Workflow settings', exact: true }).click();
    await view.locator('.cf-workflow-options summary').filter({ hasText: 'Agent and project access' }).click();
    await view.getByLabel('AI provider', { exact: true }).selectOption('codex');
    await view.getByLabel('AI model', { exact: true }).selectOption('gpt-6.1-sol');
    await view.getByLabel('Reasoning effort', { exact: true }).selectOption('xhigh');
    await obsidian.page.keyboard.press('Escape');
    await view.getByLabel('Reasoning effort', { exact: true }).blur();
    await revealProvider(view.getByLabel('AI provider', { exact: true }));
    await obsidian.screenshot('workflow-provider-model-effort');
    await view.getByRole('button', { name: 'Save workflow', exact: true }).click();
    await browserExpect(view.locator('.cf-workflow-editor-notice')).toContainText('Workflow saved.');
    await view.locator('.cf-sidebar').getByRole('button', { name: 'CoWorkers', exact: true }).click();
    await view.getByRole('button', { name: 'Create CoWorker', exact: true }).click();
    await view.getByLabel('Definition name', { exact: true }).fill('Configured reviewer');
    await view.getByLabel('Provider', { exact: true }).selectOption('codex');
    await view.getByLabel('Model', { exact: true }).selectOption('gpt-6.1-sol');
    await view.getByLabel('Reasoning effort', { exact: true }).selectOption('high');
    await obsidian.page.keyboard.press('Escape');
    await view.getByLabel('Reasoning effort', { exact: true }).blur();
    await view.getByRole('button', { name: 'Save CoWorker', exact: true }).click();
    await browserExpect(view.locator('.cf-coworker-card')).toContainText('Configured reviewer');
    await revealProvider(view.getByLabel('Provider', { exact: true }));
    await obsidian.screenshot('coworker-provider-model-effort');
    await obsidian.reloadPlugin();
    view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await view.locator('.cf-sidebar').getByRole('button', { name: 'CoWorkers', exact: true }).click();
    await view.locator('.cf-coworker-card').filter({ hasText: 'Configured reviewer' }).click();
    await browserExpect(view.getByLabel('Model', { exact: true })).toHaveValue('gpt-6.1-sol');
    await browserExpect(view.getByLabel('Reasoning effort', { exact: true })).toHaveValue('high');
    await view.getByRole('button', { name: 'Project settings', exact: true }).click();
    await view.getByRole('button', { name: 'Agent workflow', exact: true }).click();
    await view.getByRole('button', { name: 'Workflow settings', exact: true }).click();
    await view.locator('.cf-workflow-options summary').filter({ hasText: 'Agent and project access' }).click();
    await browserExpect(view.getByLabel('AI model', { exact: true })).toHaveValue('gpt-6.1-sol');
    await browserExpect(view.getByLabel('Reasoning effort', { exact: true })).toHaveValue('xhigh');
    const saved = await obsidian.eval(async ({ app }) => {
      const files = app.vault.getMarkdownFiles();
      const project = files.find(file => file.path.startsWith('CoForge/Projects/'));
      const agent = files.find(file => file.path.startsWith('CoForge/Agents/'));
      if (!project || !agent) throw new Error('Missing canonical definitions');
      return { project: await app.vault.read(project), agent: await app.vault.read(agent) };
    });
    expect(saved.project).toContain('effort: xhigh');
    expect(saved.agent).toContain('effort: high');
    expect(obsidian.errors()).toEqual([]);
  });
});
