import { expect as browserExpect } from '@playwright/test';
import { describe, expect } from 'vitest';
import { parse } from 'yaml';
import { test, type ObsidianHarness } from './support/obsidian-fixture';
import { openWorkflowDisclosure, openWorkflowSettings } from '../../../tests/e2e/support/workflow-navigation';
import { splitNote } from '../../../src/plugin/infrastructure/coforge/markdown';
import { record } from '../../../src/plugin/features/coforge/domain/check';
import { restoreWorkflowNoteData } from '../../../src/plugin/features/coforge/domain/workflow-note-data';
import { workflowRunCheck } from '../../../src/plugin/features/coforge/domain/configured-workflow-run';
import { parsePersistedStudio } from '../../../src/plugin/features/coforge/domain/persisted';

async function requestNote(obsidian: ObsidianHarness) {
  return obsidian.eval(async ({ app }) => {
    const file = app.vault.getMarkdownFiles().find(file => file.path.startsWith('CoForge/Ideas/'));
    if (!file) throw new Error('Missing canonical request note');
    return app.vault.read(file);
  });
}
function run(note: string) {
  const yaml = splitNote(note).yaml;
  if (yaml === null) throw new Error('Missing request frontmatter');
  return workflowRunCheck(restoreWorkflowNoteData(record(parse(yaml))['workflow-run']));
}
async function durableState(obsidian: ObsidianHarness) {
  return parsePersistedStudio(JSON.parse(await obsidian.eval(async ({ app, pluginId }) => app.vault.adapter.read(`${app.vault.configDir}/plugins/${pluginId}/coforge-state.json`))));
}

describe('Operator Stop and Restart in real Obsidian', () => {
  test('returns Design to Inbox, preserves a stop across Play startup, and restarts only from the card menu', async ({ obsidian }) => {
    let view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await view.locator('.cf-project-switcher').click();
    await view.getByRole('button', { name: 'Add project', exact: true }).click();
    await view.getByLabel('Project name', { exact: true }).fill('Operator stop fixture');
    await view.getByLabel(/^Project path/).fill('/synthetic/operator-stop');
    await view.getByLabel('Description', { exact: true }).fill('Contained workflow controls and durable operator holds.');
    await view.getByRole('button', { name: 'Create project', exact: true }).click();
    await openWorkflowSettings(view); await openWorkflowDisclosure(view, 'Workflow tools');
    await view.getByRole('button', { name: 'Import JSON', exact: true }).click();
    await view.getByLabel('Or paste workflow JSON', { exact: true }).fill(JSON.stringify({
      format: 'coforge-workflow/v1', revision: 'operator-fixture', name: 'Operator workflow', startupMode: 'play',
      limits: { timeoutSeconds: 180, maxTurns: 12, maxBudgetUsd: 1, intervalSeconds: 2 },
      steps: [
        { id: 'plan', kind: 'ai', name: 'Plan', instructions: 'Prepare a small implementation plan.', output: 'plan', access: 'none', provider: 'demo', model: 'sonnet', automatic: true },
        { id: 'design', kind: 'ai', name: 'Design', instructions: 'Design the planned change.', output: 'design', access: 'none', provider: 'demo', model: 'sonnet', automatic: false },
      ],
    }));
    await view.getByRole('button', { name: 'Preview import', exact: true }).click();
    await view.getByRole('button', { name: 'Replace draft', exact: true }).click();
    await view.getByRole('button', { name: 'Save workflow', exact: true }).click();
    await browserExpect(view.locator('.cf-workflow-editor-notice')).toContainText('Workflow saved.');
    await view.locator('.cf-sidebar').getByRole('button', { name: /^Idea board/ }).click();
    await view.locator('.cf-board-page > .cf-page-heading').getByRole('button', { name: 'New request', exact: true }).click();
    const dialog = view.getByRole('dialog');
    await dialog.getByLabel('The idea', { exact: true }).fill('Preserve my stopped request');
    await dialog.getByLabel('A little more context', { exact: true }).fill('Create a small lantern interaction and preserve this authored context.');
    await dialog.getByLabel('Contributor name', { exact: true }).fill('Contained operator');
    await dialog.getByRole('button', { name: 'Add to the board', exact: true }).click();
    const card = () => view.locator('.cf-idea-card').filter({ hasText: 'Preserve my stopped request' });
    const menu = () => view.locator('.cf-card-menu[role="menu"]');
    await card().click({ button: 'right' });
    await menu().getByRole('menuitem', { name: /Start · Plan/ }).click();
    await browserExpect(view.locator('.cf-column-design .cf-idea-card').filter({ hasText: 'Preserve my stopped request' })).toBeVisible();
    const before = await requestNote(obsidian); const original = run(before);
    expect(original.cursor).toBe(1);
    await card().click({ button: 'right' });
    await menu().getByRole('menuitem', { name: 'Stop workflow', exact: false }).click();
    await browserExpect(view.locator('.cf-column-inbox .cf-idea-card').filter({ hasText: 'Preserve my stopped request' })).toBeVisible();
    expect(splitNote(await requestNote(obsidian)).body).toBe(splitNote(before).body);
    expect((await durableState(obsidian)).workflowStopHolds).toContain(original.ideaId);
    await obsidian.reloadPlugin(); view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await view.locator('.cf-sidebar').getByRole('button', { name: /^Idea board/ }).click();
    await browserExpect(view.locator('.cf-column-inbox .cf-idea-card').filter({ hasText: 'Preserve my stopped request' })).toBeVisible();
    expect(run(await requestNote(obsidian))).toMatchObject({ id: original.id, state: 'stopped', cursor: 1 });
    expect((await durableState(obsidian)).jobs).toHaveLength(1);
    await card().click({ button: 'right' });
    await browserExpect(menu().getByRole('menuitem', { name: /Restart workflow/ })).toBeEnabled();
    await obsidian.screenshot('operator-stop-persisted-inbox');
    await menu().getByRole('menuitem', { name: /Restart workflow/ }).click();
    await expect.poll(async () => run(await requestNote(obsidian)).id).not.toBe(original.id);
    await expect.poll(async () => run(await requestNote(obsidian)).cursor).toBe(1);
    expect(run(await requestNote(obsidian)).attempts[0]?.stepId).toBe('plan');
    expect((await durableState(obsidian)).workflowStopHolds).not.toContain(original.ideaId);
    expect(splitNote(await requestNote(obsidian)).body).toBe(splitNote(before).body);
    expect(obsidian.errors()).toEqual([]);
  });
});
