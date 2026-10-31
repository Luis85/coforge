import { expect as browserExpect } from '@playwright/test';
import { describe, expect } from 'vitest';
import { test } from './support/obsidian-fixture';
import { openWorkflowDisclosure, openWorkflowSettings } from '../../../tests/e2e/support/workflow-navigation';

describe('Assigned workflow CoWorkers in the contained host', () => {
  test('saves a CoWorker assignment, restores it after reload and preserves manual customization without dispatch', async ({ obsidian }) => {
    let view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await view.locator('.cf-project-switcher').click();
    await view.getByRole('button', { name: 'Add project', exact: true }).click();
    await view.getByLabel('Project name', { exact: true }).fill('Assigned CoWorker workflow');
    await view.getByLabel(/^Project path/).fill('/synthetic/assigned-coworker');
    await view.getByLabel('Description', { exact: true }).fill('Explicit profile assignment and saved workflow configuration only.');
    await view.getByRole('button', { name: 'Create project', exact: true }).click();
    await browserExpect(view.locator('.cf-project-switcher')).toContainText('Assigned CoWorker workflow');
    await view.locator('.cf-sidebar').getByRole('button', { name: 'CoWorkers', exact: true }).click();
    await view.getByRole('button', { name: 'Create CoWorker', exact: true }).click();
    await view.getByLabel('Definition name', { exact: true }).fill('Saved compatibility reviewer');
    await view.getByLabel('Available for new runs', { exact: true }).check();
    await view.getByLabel('Role', { exact: true }).fill('Compatibility reviewer');
    await view.getByLabel('CoWorker instructions', { exact: true }).fill('Preserve supported saved-note formats.');
    await view.getByLabel('Provider', { exact: true }).selectOption('claude');
    await view.getByLabel('Model', { exact: true }).selectOption('sonnet');
    await view.getByLabel('Reasoning effort', { exact: true }).selectOption('high');
    await view.getByRole('button', { name: 'Save CoWorker', exact: true }).click();
    await browserExpect(view.getByRole('status').filter({ hasText: 'Definition saved for future runs.' })).toBeVisible();
    await openWorkflowSettings(view);
    await openWorkflowDisclosure(view, 'Agent and project access');
    await view.getByLabel('Step agent configuration', { exact: true }).selectOption('coworker');
    await view.getByLabel('Assigned CoWorker', { exact: true }).selectOption({ label: 'Saved compatibility reviewer' });
    await browserExpect(view.getByLabel('AI provider', { exact: true })).toHaveCount(0);
    await view.getByRole('button', { name: 'Save workflow', exact: true }).click();
    await browserExpect(view.locator('.cf-workflow-editor-notice')).toContainText('Workflow saved.');
    await obsidian.reloadPlugin();
    view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await openWorkflowSettings(view);
    await openWorkflowDisclosure(view, 'Agent and project access');
    await browserExpect(view.getByLabel('Step agent configuration', { exact: true })).toHaveValue('coworker');
    await browserExpect(view.getByLabel('Assigned CoWorker', { exact: true }).locator('option:checked')).toHaveText('Saved compatibility reviewer');
    await view.getByLabel('Assigned CoWorker', { exact: true }).scrollIntoViewIfNeeded();
    await obsidian.screenshot('workflow-assigned-coworker');
    await view.getByLabel('Step agent configuration', { exact: true }).selectOption('manual');
    await browserExpect(view.getByLabel('AI model', { exact: true })).toHaveValue('sonnet');
    await browserExpect(view.getByLabel('Reasoning effort', { exact: true })).toHaveValue('high');
    await view.getByLabel('Reasoning effort', { exact: true }).selectOption('medium');
    await view.getByRole('button', { name: 'Save workflow', exact: true }).click();
    await browserExpect(view.locator('.cf-workflow-editor-notice')).toContainText('Workflow saved.');
    const saved = await obsidian.eval(async ({ app, pluginId }) => {
      let note = '';
      for (const file of app.vault.getMarkdownFiles().filter(file => file.path.startsWith('CoForge/Projects/'))) {
        const body = await app.vault.read(file);
        if (body.includes('Assigned CoWorker workflow')) { note = body; break; }
      }
      if (!note) throw new Error('Missing canonical assigned-workflow project');
      const state: unknown = JSON.parse(await app.vault.adapter.read(`${app.vault.configDir}/plugins/${pluginId}/coforge-state.json`));
      return { note, jobs: state && typeof state === 'object' && 'jobs' in state && Array.isArray(state.jobs) ? state.jobs.length : -1 };
    });
    expect(saved.note).toContain('effort: medium');
    expect(saved.note).not.toContain('coworkerId:');
    expect(saved.jobs).toBe(0);
    expect(obsidian.errors()).toEqual([]);
  });
});
