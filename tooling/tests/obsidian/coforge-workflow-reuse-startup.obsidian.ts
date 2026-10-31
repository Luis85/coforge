import { expect as browserExpect, type Locator } from '@playwright/test';
import { describe, expect } from 'vitest';
import { parse } from 'yaml';
import { test, type ObsidianHarness } from './support/obsidian-fixture';
import { openWorkflowSettings, openWorkflowDisclosure } from '../../../tests/e2e/support/workflow-navigation';
import { splitNote } from '../../../src/plugin/infrastructure/coforge/markdown';
import { record } from '../../../src/plugin/features/coforge/domain/check';
import { restoreWorkflowNoteData } from '../../../src/plugin/features/coforge/domain/workflow-note-data';
import { workflowDefinitionCheck } from '../../../src/plugin/features/coforge/domain/configured-workflow';

async function createProject(view: Locator, name: string, path: string) {
  await view.locator('.cf-project-switcher').click();
  await view.getByRole('button', { name: 'Add project', exact: true }).click();
  await view.getByLabel('Project name', { exact: true }).fill(name);
  await view.getByLabel(/^Project path/).fill(path);
  await view.getByLabel('Description', { exact: true }).fill('A contained workflow-copy and startup preference scenario.');
  await view.getByRole('button', { name: 'Create project', exact: true }).click();
  await browserExpect(view.locator('.cf-project-switcher')).toContainText(name);
  return (await view.locator('.cf-project-selector-id').textContent())!.trim();
}
async function projectNote(obsidian: ObsidianHarness, id: string) {
  return obsidian.eval(async ({ app }, projectId) => {
    const file = app.vault.getMarkdownFiles().find(file => file.path.startsWith('CoForge/Projects/') && file.basename.startsWith(`${projectId} `));
    if (!file) throw new Error('Missing contained project note');
    return app.vault.read(file);
  }, id);
}
function savedWorkflow(text: string) {
  const yaml = splitNote(text).yaml;
  if (yaml === null) throw new Error('Missing project frontmatter');
  return workflowDefinitionCheck(restoreWorkflowNoteData(record(parse(yaml))['workflow-definition']));
}

describe('Reusable request workflows and automation startup in real Obsidian', () => {
  test('copies a saved definition independently and restores explicit Play/Paused choices across reload', async ({ obsidian }) => {
    let view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    const sourceId = await createProject(view, 'Workflow source', '/synthetic/workflow-source');
    await openWorkflowSettings(view);
    await view.getByRole('textbox', { name: 'Workflow name', exact: true }).fill('Reusable source process');
    await view.getByLabel('Idea board automation on startup', { exact: true }).selectOption('play');
    await view.getByRole('button', { name: 'Save workflow', exact: true }).click();
    await browserExpect(view.locator('.cf-workflow-editor-notice')).toContainText('Workflow saved.');
    await browserExpect(view.getByRole('button', { name: 'Resume automation', exact: true })).toBeVisible();
    const sourceBefore = await projectNote(obsidian, sourceId);
    const sourceWorkflow = savedWorkflow(sourceBefore);

    const destinationId = await createProject(view, 'Workflow destination', '/synthetic/workflow-destination');
    await openWorkflowSettings(view);
    await openWorkflowDisclosure(view, 'Copy workflow from another project');
    await view.getByLabel('Saved workflow to copy', { exact: true }).selectOption(sourceId);
    await browserExpect(view.getByRole('region', { name: 'Workflow copy preview', exact: true })).toContainText('Start playing');
    await view.getByRole('button', { name: 'Copy into draft', exact: true }).click();
    await view.getByRole('textbox', { name: 'Workflow name', exact: true }).fill('Destination adaptation');
    await browserExpect(view.getByRole('button', { name: 'Resume automation', exact: true })).toBeVisible();
    await view.getByRole('button', { name: 'Save workflow', exact: true }).click();
    await browserExpect(view.locator('.cf-workflow-editor-notice')).toContainText('Workflow saved.');
    expect(await projectNote(obsidian, sourceId)).toBe(sourceBefore);
    const destination = savedWorkflow(await projectNote(obsidian, destinationId));
    expect(destination).toMatchObject({ name: 'Destination adaptation', startupMode: 'play' });
    expect(destination.revision).not.toBe(sourceWorkflow.revision);

    await obsidian.reloadPlugin();
    view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await openWorkflowSettings(view);
    await browserExpect(view.getByRole('button', { name: 'Pause automation', exact: true })).toBeVisible();
    await browserExpect(view.getByRole('textbox', { name: 'Workflow name', exact: true })).toHaveValue('Destination adaptation');
    await view.getByLabel('Idea board automation on startup', { exact: true }).selectOption('paused');
    await view.getByRole('button', { name: 'Save workflow', exact: true }).click();
    await browserExpect(view.locator('.cf-workflow-editor-notice')).toContainText('Workflow saved.');
    await browserExpect(view.getByRole('button', { name: 'Pause automation', exact: true })).toBeVisible();
    await obsidian.reloadPlugin();
    view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await openWorkflowSettings(view);
    await browserExpect(view.getByRole('button', { name: 'Resume automation', exact: true })).toBeVisible();
    await browserExpect(view.getByLabel('Idea board automation on startup', { exact: true })).toHaveValue('paused');
    expect(savedWorkflow(await projectNote(obsidian, sourceId))).toEqual(sourceWorkflow);
    const jobs = await obsidian.eval(async ({ app, pluginId }) => {
      const state: unknown = JSON.parse(await app.vault.adapter.read(`${app.vault.configDir}/plugins/${pluginId}/coforge-state.json`));
      if (!state || typeof state !== 'object' || !('jobs' in state) || !Array.isArray(state.jobs)) throw new Error('Missing durable job inventory');
      return state.jobs.length;
    });
    expect(jobs).toBe(0);
    await view.getByLabel('Idea board automation on startup', { exact: true }).scrollIntoViewIfNeeded();
    await obsidian.screenshot('independent-workflow-copy-startup-mode');
    expect(obsidian.errors()).toEqual([]);
  });
});
