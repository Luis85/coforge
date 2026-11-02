import { expect as browserExpect, type Locator } from '@playwright/test';
import { describe, expect } from 'vitest';
import { parse } from 'yaml';
import { test, type ObsidianHarness } from './support/obsidian-fixture';
import { openWorkflowDisclosure, openWorkflowRuns, openWorkflowSettings } from '../../../tests/e2e/support/workflow-navigation';
import { splitNote } from '../../../src/plugin/infrastructure/coforge/markdown';
import { record } from '../../../src/plugin/features/coforge/domain/check';
import { parsePersistedStudio } from '../../../src/plugin/features/coforge/domain/persisted';

async function createRequest(view: Locator, title: string) {
  await view.locator('.cf-board-page > .cf-page-heading').getByRole('button', { name: 'New request', exact: true }).click();
  const dialog = view.getByRole('dialog');
  await dialog.getByLabel('The idea', { exact: true }).fill(title);
  await dialog.getByLabel('A little more context', { exact: true }).fill('Keep this request and its workflow evidence isolated.');
  await dialog.getByLabel('Contributor name', { exact: true }).fill('Contained owner');
  await dialog.getByRole('button', { name: 'Add to the board', exact: true }).click();
  await browserExpect(view.locator('.cf-idea-card').filter({ hasText: title })).toBeVisible();
}

async function inspectRequestSections(obsidian: ObsidianHarness, view: Locator) {
  const retained = () => obsidian.eval(async ({ app, pluginId }) => {
    const directory = app.plugins.manifests[pluginId]?.dir ?? `${app.vault.configDir}/plugins/${pluginId}`;
    return {
      state: await app.vault.adapter.read(`${directory}/coforge-state.json`),
      notes: await Promise.all(app.vault.getMarkdownFiles().filter(file => file.path.startsWith('CoForge/Ideas/')).sort((left, right) => left.path.localeCompare(right.path)).map(file => app.vault.read(file))),
    };
  });
  // Reload starts contained OBS installation detection independently of this panel.
  // Wait for its durable completion before taking the no-mutation baseline.
  await expect.poll(async () => {
    const operations = parsePersistedStudio(JSON.parse((await retained()).state)).population?.operations ?? [];
    const requested = operations.filter(operation => operation.code === 'obs-detection-requested').at(-1);
    const detected = operations.filter(operation => operation.code === 'obs-detected').at(-1);
    return Boolean(requested && detected && detected.sequence > requested.sequence);
  }, { timeout: 15000 }).toBe(true);
  const before = await retained();
  const drawer = view.locator('.cf-idea-drawer');
  const navigation = drawer.getByRole('navigation', { name: 'Idea sections', exact: true });
  const sections = ['Overview', 'Workflow runs', 'Plan & Design', 'Increment', 'Sessions', 'AI costs', 'Activity'];
  for (const width of [1280, 720]) for (const theme of ['light', 'dark']) {
    await obsidian.page.setViewportSize({ width, height: 900 });
    await obsidian.eval((_context, selected) => {
      document.body.classList.toggle('theme-light', selected === 'light');
      document.body.classList.toggle('theme-dark', selected === 'dark');
    }, theme);
    for (const [index, label] of sections.entries()) {
      const control = navigation.getByRole('button', { name: label, exact: true });
      await control.click();
      await browserExpect(control).toHaveAttribute('aria-pressed', 'true');
      const pane = drawer.locator('#cf-idea-section-content');
      await browserExpect(pane).toHaveAttribute('aria-label', label);
      await browserExpect(pane.locator('.cf-idea-pane-intro h3')).toHaveText(label);
      await browserExpect(pane.locator('.cf-idea-pane-intro p')).not.toBeEmpty();
      expect(await pane.evaluate(element => element.scrollTop)).toBe(0);
      expect(await drawer.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      if (label === 'Sessions' || label === 'AI costs') {
        await browserExpect(drawer.getByRole('button', { name: /^(Start ·|Run ·|Cancel run|Accept increment)/ })).toHaveCount(0);
      }
      if (label === 'AI costs') await browserExpect(pane.getByText('Loading retained cost history…', { exact: true })).toHaveCount(0);
      await obsidian.screenshot(`request-panel-${index + 1}-${theme}-${width}`);
    }
  }
  expect(await retained()).toEqual(before);
  await navigation.getByRole('button', { name: 'Workflow runs', exact: true }).click();
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
    await inspectRequestSections(obsidian, view);
    await openWorkflowSettings(view);
    const nav = view.getByRole('navigation', { name: 'Agent workflow pages', exact: true });
    await browserExpect(nav.getByRole('button')).toHaveText(['Idea Board Workflow', 'Step attempts', 'Answer / output templates', 'Herdr']);
    await view.getByLabel('Workflow name', { exact: true }).fill('Preserved host draft');
    await nav.getByRole('button', { name: 'Answer / output templates', exact: true }).click();
    await browserExpect(view.locator('[data-workflow-field="limits.timeoutSeconds"]')).toHaveCount(0);
    await nav.getByRole('button', { name: 'Idea Board Workflow', exact: true }).click();
    await browserExpect(view.getByLabel('Workflow name', { exact: true })).toHaveValue('Preserved host draft');
    await nav.getByRole('button', { name: 'Answer / output templates', exact: true }).click();
    await browserExpect(view.getByRole('heading', { name: 'Answer / output templates', exact: true })).toBeVisible();
    await nav.getByRole('button', { name: 'Step attempts', exact: true }).click();
    await browserExpect(nav.getByRole('button', { name: 'Answer / output templates', exact: true })).toHaveAttribute('aria-current', 'page');
    await obsidian.screenshot('workflow-settings-flat-tabs');
    expect(obsidian.errors()).toEqual([]);
  });
});
