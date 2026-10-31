import { expect as browserExpect, type Locator } from '@playwright/test';
import { describe, expect } from 'vitest';
import { parse } from 'yaml';
import { test } from './support/obsidian-fixture';
import { openWorkflowDisclosure, openWorkflowRuns, openWorkflowSettings } from '../../../tests/e2e/support/workflow-navigation';
import { splitNote } from '../../../src/plugin/infrastructure/coforge/markdown';
import { record } from '../../../src/plugin/features/coforge/domain/check';

async function createRequest(view: Locator, title: string) {
  await view.locator('.cf-board-page > .cf-page-heading').getByRole('button', { name: 'New request', exact: true }).click();
  const dialog = view.getByRole('dialog');
  await dialog.getByLabel('The idea', { exact: true }).fill(title);
  await dialog.getByLabel('A little more context', { exact: true }).fill('Keep this request and its workflow evidence isolated.');
  await dialog.getByLabel('Contributor name', { exact: true }).fill('Contained owner');
  await dialog.getByRole('button', { name: 'Add to the board', exact: true }).click();
  await browserExpect(view.locator('.cf-idea-card').filter({ hasText: title })).toBeVisible();
}

describe('Request-scoped workflow details in the contained host', () => {
  test('retains separate request runs after reload and preserves the shared configuration draft across flat tabs', async ({ obsidian }) => {
    let view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await view.locator('.cf-project-switcher').click();
    await view.getByRole('button', { name: 'Add project', exact: true }).click();
    await view.getByLabel('Project name', { exact: true }).fill('Scoped workflow details');
    await view.getByLabel(/^Project path/).fill('/synthetic/workflow-details');
    await view.getByLabel('Description', { exact: true }).fill('Per-request runs and explicit configuration drafts.');
    await view.getByRole('button', { name: 'Create project', exact: true }).click();
    await openWorkflowSettings(view);
    await openWorkflowDisclosure(view, 'Workflow tools');
    await view.getByRole('button', { name: 'Import JSON', exact: true }).click();
    await view.getByLabel('Or paste workflow JSON', { exact: true }).fill(JSON.stringify({
      format: 'coforge-workflow/v1', revision: 'scoped-host', name: 'Scoped checkpoint process', startupMode: 'paused',
      limits: { timeoutSeconds: 180, maxTurns: 12, maxBudgetUsd: 1, intervalSeconds: 5 },
      steps: [{ id: 'checkpoint', kind: 'approval', name: 'Human checkpoint', instructions: 'Keep this decision attached to its original request.' }],
    }));
    await view.getByRole('button', { name: 'Preview import', exact: true }).click();
    await view.getByRole('button', { name: 'Replace draft', exact: true }).click();
    await view.getByRole('button', { name: 'Save workflow', exact: true }).click();
    await browserExpect(view.getByText('Workflow saved. New runs use this definition; existing runs retain their captured steps.', { exact: true })).toBeVisible();
    await view.locator('.cf-sidebar').getByRole('button', { name: /^Idea board/ }).click();
    await createRequest(view, 'First isolated workflow');
    await createRequest(view, 'Second isolated workflow');
    const firstCard = () => view.locator('.cf-idea-card').filter({ hasText: 'First isolated workflow' });
    const secondCard = () => view.locator('.cf-idea-card').filter({ hasText: 'Second isolated workflow' });
    await openWorkflowRuns(view, firstCard());
    const firstId = await view.locator('.cf-idea-drawer .cf-idea-id').innerText();
    await view.getByRole('button', { name: 'Start · Human checkpoint', exact: true }).click();
    await browserExpect(view.getByRole('region', { name: 'Manual workflow step', exact: true })).toBeVisible();
    await openWorkflowRuns(view, secondCard());
    const secondId = await view.locator('.cf-idea-drawer .cf-idea-id').innerText();
    expect(secondId).not.toBe(firstId);
    await browserExpect(view.getByRole('button', { name: 'Start · Human checkpoint', exact: true })).toBeEnabled();
    await browserExpect(view.getByRole('region', { name: 'Manual workflow step', exact: true })).toHaveCount(0);
    const notes = await obsidian.eval(async ({ app }) => Promise.all(app.vault.getMarkdownFiles().filter(file => file.path.startsWith('CoForge/Ideas/')).map(file => app.vault.read(file))));
    const metadata = notes.map(note => record(parse(splitNote(note).yaml ?? '')));
    expect(metadata.find(note => note['id'] === firstId)?.['workflow-run']).toBeDefined();
    expect(metadata.find(note => note['id'] === secondId)?.['workflow-run']).toBeUndefined();
    await obsidian.reloadPlugin();
    view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await openWorkflowRuns(view, firstCard());
    await browserExpect(view.getByRole('region', { name: 'Manual workflow step', exact: true })).toBeVisible();
    await browserExpect(view.getByRole('region', { name: 'Request workflow execution', exact: true })).not.toContainText(secondId);
    await obsidian.screenshot('workflow-detail-selected-request');
    await openWorkflowSettings(view);
    const nav = view.getByRole('navigation', { name: 'Agent workflow pages', exact: true });
    await browserExpect(nav.getByRole('button')).toHaveText(['Idea Board Workflow', 'Step attempts', 'Timing & limits', 'Answer / output templates', 'Herdr']);
    await view.getByLabel('Workflow name', { exact: true }).fill('Preserved host draft');
    await nav.getByRole('button', { name: 'Timing & limits', exact: true }).click();
    await view.locator('[data-workflow-field="limits.timeoutSeconds"]').fill('240');
    await nav.getByRole('button', { name: 'Idea Board Workflow', exact: true }).click();
    await browserExpect(view.getByLabel('Workflow name', { exact: true })).toHaveValue('Preserved host draft');
    await nav.getByRole('button', { name: 'Timing & limits', exact: true }).click();
    await browserExpect(view.locator('[data-workflow-field="limits.timeoutSeconds"]')).toHaveValue('240');
    await nav.getByRole('button', { name: 'Step attempts', exact: true }).click();
    await browserExpect(nav.getByRole('button', { name: 'Timing & limits', exact: true })).toHaveAttribute('aria-current', 'page');
    await obsidian.screenshot('workflow-settings-flat-tabs');
    expect(obsidian.errors()).toEqual([]);
  });
});
