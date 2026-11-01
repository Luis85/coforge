import { expect as browserExpect } from '@playwright/test';
import { describe, expect } from 'vitest';
import { parse } from 'yaml';
import { test } from './support/obsidian-fixture';
import { openWorkflowDisclosure, openWorkflowRuns, openWorkflowSettings } from '../../../tests/e2e/support/workflow-navigation';
import { splitNote } from '../../../src/plugin/infrastructure/coforge/markdown';
import { record } from '../../../src/plugin/features/coforge/domain/check';
import { restoreWorkflowNoteData } from '../../../src/plugin/features/coforge/domain/workflow-note-data';
import { workflowRunCheck } from '../../../src/plugin/features/coforge/domain/configured-workflow-run';

const title = 'Synthetic self-write integrity request';
const workflow = {
  format: 'coforge-workflow/v1', revision: 'synthetic-note-integrity', name: 'Manual integrity fixture',
  limits: { timeoutSeconds: 180, maxTurns: 12, maxBudgetUsd: 1, intervalSeconds: 5 },
  steps: [
    { id: 'scope', kind: 'approval', name: 'Review scope', instructions: 'Review the synthetic request.' },
    { id: 'check', kind: 'checklist', name: 'Finish review', instructions: 'Keep the current manual step.', items: [{ id: 'read', label: 'I reviewed the request', required: true }] },
  ],
};
function runFromNote(bytes: string) {
  const yaml = splitNote(bytes).yaml;
  if (yaml === null) throw new Error('Synthetic canonical note missing frontmatter.');
  return workflowRunCheck(restoreWorkflowNoteData(record(parse(yaml))['workflow-run']));
}

describe('Committed own-note writes in the contained host', () => {
  test('preserves current workflow through duplicate/stale notifications and reload, while quarantining a real old-state revert', async ({ obsidian }) => {
    let view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await view.locator('.cf-project-switcher').click();
    await view.getByRole('button', { name: 'Add project', exact: true }).click();
    await view.getByLabel('Project name', { exact: true }).fill('Synthetic note integrity fixture');
    await view.getByLabel(/^Project path/).fill('/synthetic/no-provider');
    await view.getByLabel('Description', { exact: true }).fill('Manual steps only; no model, test command or real request execution.');
    await view.getByRole('button', { name: 'Create project', exact: true }).click();
    await browserExpect(view.locator('.cf-project-switcher')).toContainText('Synthetic note integrity fixture');
    await openWorkflowSettings(view); await openWorkflowDisclosure(view, 'Workflow tools');
    await view.getByRole('button', { name: 'Import JSON', exact: true }).click();
    await view.getByLabel('Or paste workflow JSON', { exact: true }).fill(JSON.stringify(workflow));
    await view.getByRole('button', { name: 'Preview import', exact: true }).click();
    await view.getByRole('button', { name: 'Replace draft', exact: true }).click();
    await view.getByRole('button', { name: 'Save workflow', exact: true }).click();
    await browserExpect(view.locator('.cf-workflow-editor-notice')).toContainText('Workflow saved.');
    await view.getByRole('button', { name: /^Idea board/ }).first().click();
    await view.locator('.cf-board-page > .cf-page-heading').getByRole('button', { name: 'New request', exact: true }).click();
    const intake = view.getByRole('dialog');
    await intake.getByLabel('The idea', { exact: true }).fill(title);
    await intake.getByLabel('A little more context', { exact: true }).fill('The original request body must stay byte-identical.');
    await intake.getByLabel('Contributor name', { exact: true }).fill('Synthetic fixture owner');
    await intake.getByRole('button', { name: 'Add to the board', exact: true }).click();
    const card = view.locator('.cf-idea-card').filter({ hasText: title }); await browserExpect(card).toBeVisible();
    const initial = await obsidian.eval(async ({ app }) => {
      const note = app.vault.getMarkdownFiles().find(file => file.path.startsWith('CoForge/Ideas/'));
      if (!note) throw new Error('Synthetic canonical request missing.');
      await app.vault.process(note, bytes => bytes.replace('---\n', '---\nowner: "Keep quoted" # human annotation\n') + '\r\n## Human annotation\r\nKeep these **body bytes**.\r\n');
      return { path: note.path, bytes: await app.vault.read(note) };
    });
    await card.getByRole('button', { name: /^Actions for CF-/ }).click();
    await obsidian.page.getByRole('menu').getByRole('menuitem', { name: /Start · Review scope/ }).click();
    const manual = view.getByRole('region', { name: 'Manual workflow step', exact: true });
    await browserExpect(manual).toContainText('Review the synthetic request.');
    const earlier = await obsidian.eval(async ({ app }, path) => {
      const note = app.vault.getFileByPath(path); if (!note) throw new Error('Synthetic note disappeared.'); return app.vault.read(note);
    }, initial.path);
    await manual.getByRole('button', { name: 'Approve workflow step', exact: true }).click();
    await browserExpect(manual.getByRole('button', { name: 'Complete checklist step', exact: true })).toBeVisible();
    const latest = await obsidian.eval(async ({ app }, path) => {
      const note = app.vault.getFileByPath(path); if (!note) throw new Error('Synthetic note disappeared.'); return app.vault.read(note);
    }, initial.path);
    expect(runFromNote(latest)).toMatchObject({ cursor: 1, state: 'waiting-human' });
    await obsidian.eval(({ app }, input) => {
      const note = app.vault.getFileByPath(input.path); if (!note) throw new Error('Synthetic note disappeared.');
      const cache = app.metadataCache.getFileCache(note);
      app.metadataCache.trigger('changed', note, input.latest, cache);
      app.metadataCache.trigger('changed', note, input.latest, cache);
      app.metadataCache.trigger('changed', note, input.earlier, cache);
    }, { path: initial.path, latest, earlier });
    await obsidian.reloadPlugin(); view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await openWorkflowRuns(view, view.locator('.cf-idea-card').filter({ hasText: title }));
    await browserExpect(view.getByRole('button', { name: 'Complete checklist step', exact: true })).toBeVisible();
    const reloaded = await obsidian.eval(async ({ app }, path) => {
      const note = app.vault.getFileByPath(path); if (!note) throw new Error('Synthetic note disappeared.'); return app.vault.read(note);
    }, initial.path);
    expect(reloaded).toBe(latest);
    await obsidian.eval(async ({ app }, input) => {
      const note = app.vault.getFileByPath(input.path); if (!note) throw new Error('Synthetic note disappeared.'); await app.vault.modify(note, input.bytes);
    }, { path: initial.path, bytes: earlier });
    await browserExpect.poll(async () => runFromNote(await obsidian.eval(async ({ app }, path) => {
      const note = app.vault.getFileByPath(path); if (!note) throw new Error('Synthetic note disappeared.'); return app.vault.read(note);
    }, initial.path)).state).toBe('stopped');
    const final = await obsidian.eval(async ({ app, pluginId }, path) => {
      const note = app.vault.getFileByPath(path); if (!note) throw new Error('Synthetic note disappeared.');
      const folder = app.plugins.manifests[pluginId]?.dir ?? `${app.vault.configDir}/plugins/${pluginId}`;
      const state = JSON.parse(await app.vault.adapter.read(`${folder}/coforge-state.json`));
      return { bytes: await app.vault.read(note), jobs: state.jobs.length };
    }, initial.path);
    expect(runFromNote(final.bytes).error).toContain('changed outside CoForge');
    expect(splitNote(final.bytes).body).toBe(splitNote(initial.bytes).body);
    expect(final.bytes).toContain('owner: "Keep quoted" # human annotation\n'); expect(final.jobs).toBe(0);
    await obsidian.screenshot('synthetic-note-external-revert-quarantined');
    expect(obsidian.errors()).toEqual([]);
  });
});
