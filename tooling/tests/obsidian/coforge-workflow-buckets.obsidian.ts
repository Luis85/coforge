import { expect as browserExpect, type Locator } from '@playwright/test';
import { describe, expect } from 'vitest';
import { parse } from 'yaml';
import { test, type ObsidianHarness } from './support/obsidian-fixture';
import { openWorkflowDisclosure, openWorkflowRuns, openWorkflowSettings } from '../../../tests/e2e/support/workflow-navigation';
import { parseWorkflowDefinition, workflowDefinitionCheck } from '../../../src/plugin/features/coforge/domain/configured-workflow';
import { workflowRunCheck } from '../../../src/plugin/features/coforge/domain/configured-workflow-run';
import { restoreWorkflowNoteData } from '../../../src/plugin/features/coforge/domain/workflow-note-data';
import { record } from '../../../src/plugin/features/coforge/domain/check';
import { splitNote } from '../../../src/plugin/infrastructure/coforge/markdown';

async function note(obsidian: ObsidianHarness, folder: string): Promise<string> {
  const text = await obsidian.eval(async ({ app }, prefix) => {
    const file = app.vault.getMarkdownFiles().find(file => file.path.startsWith(prefix));
    return file ? app.vault.read(file) : null;
  }, folder);
  if (text === null) throw new Error('Missing contained canonical note.');
  return text;
}
function property(text: string, key: string): unknown {
  const yaml = splitNote(text).yaml;
  if (yaml === null) throw new Error('Missing canonical frontmatter.');
  return restoreWorkflowNoteData(record(parse(yaml))[key]);
}
async function choosePlan(view: Locator) {
  await view.locator('[data-step-id="plan"] .cf-workflow-step-select').click();
}

describe('Bucket-first Idea board workflow in the contained host', () => {
  test('saves bucket structure, runs captured nested steps and keeps Design readiness/history across reload', async ({ obsidian }) => {
    let view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await view.locator('.cf-project-switcher').click();
    await view.getByRole('button', { name: 'Add project', exact: true }).click();
    await view.getByLabel('Project name', { exact: true }).fill('Contained bucket workflow');
    await view.getByLabel(/^Project path/).fill('/synthetic/bucket-workflow');
    await view.getByLabel('Description', { exact: true }).fill('Private simulation of nested workflow configuration.');
    await view.getByRole('button', { name: 'Create project', exact: true }).click();
    await browserExpect(view.locator('.cf-project-switcher')).toContainText('Contained bucket workflow');
    await openWorkflowSettings(view);
    let outline = view.getByRole('region', { name: 'Workflow step order', exact: true });
    await outline.getByRole('button', { name: 'Edit Up next bucket', exact: true }).click();
    await view.getByLabel('Bucket name', { exact: true }).fill('Discovery');
    await outline.getByRole('button', { name: 'Add bucket', exact: true }).click();
    await view.getByLabel('Bucket name', { exact: true }).fill('Research');
    await view.getByLabel('Bucket description', { exact: true }).fill('Plan before the retained design specification.');
    await outline.getByRole('button', { name: 'Move Research bucket up', exact: true }).click();
    await outline.getByRole('button', { name: 'Move Research bucket up', exact: true }).click();
    await choosePlan(view);
    await view.getByLabel('Bucket', { exact: true }).selectOption({ label: 'Research' });
    await browserExpect(outline.getByRole('list', { name: 'Steps in Research', exact: true })).toContainText('Plan');
    await openWorkflowDisclosure(view, 'Workflow tools');
    await view.getByRole('button', { name: 'Preview workflow export', exact: true }).click();
    const definition = parseWorkflowDefinition(await view.getByLabel('Workflow export JSON', { exact: true }).textContent() ?? '');
    definition.steps = definition.steps.map(step => step.kind === 'ai' ? { ...step, provider: 'demo', automatic: false, minVotes: 0 } : step);
    await view.getByRole('button', { name: 'Close JSON panel', exact: true }).click();
    await view.getByRole('button', { name: 'Import JSON', exact: true }).click();
    await view.getByLabel('Or paste workflow JSON', { exact: true }).fill(JSON.stringify(definition));
    await view.getByRole('button', { name: 'Preview import', exact: true }).click();
    await view.getByRole('button', { name: 'Replace draft', exact: true }).click();
    await view.getByRole('button', { name: 'Save workflow', exact: true }).click();
    await browserExpect(view.locator('.cf-workflow-editor-notice')).toContainText('Workflow saved.');
    const project = workflowDefinitionCheck(property(await note(obsidian, 'CoForge/Projects/'), 'workflow-definition'));
    expect(project.buckets?.map(bucket => bucket.name)).toEqual(['Inbox', 'Discovery', 'Research', 'Design', 'In progress', 'Accepted']);
    expect(project.steps.map(step => step.id)).toEqual(['screen', 'score', 'plan', 'design', 'implement']);
    expect(project.steps.find(step => step.id === 'plan')?.bucketId).toBe(project.buckets?.find(bucket => bucket.name === 'Research')?.id);
    await obsidian.reloadPlugin();
    view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await openWorkflowSettings(view);
    outline = view.getByRole('region', { name: 'Workflow step order', exact: true });
    await browserExpect(outline.getByRole('button', { name: 'Edit Research bucket', exact: true })).toBeVisible();
    await view.getByRole('button', { name: /^Idea board/ }).first().click();
    await browserExpect(view.locator('.cf-pipeline-stage-label')).toHaveText(['Inbox', 'Discovery', 'Research', 'Design', 'In progress', 'Accepted']);
    await view.locator('.cf-board-page > .cf-page-heading').getByRole('button', { name: 'New request', exact: true }).click();
    const dialog = view.getByRole('dialog');
    await dialog.getByLabel('The idea', { exact: true }).fill('Bucket workflow lantern');
    await dialog.getByLabel('A little more context', { exact: true }).fill('Preserve this authored request through grouped workflow execution.');
    await dialog.getByLabel('Contributor name', { exact: true }).fill('Contained streamer');
    await dialog.getByRole('button', { name: 'Add to the board', exact: true }).click();
    const card = () => view.locator('.cf-idea-card').filter({ hasText: 'Bucket workflow lantern' });
    await browserExpect(card()).toBeVisible();
    const body = splitNote(await note(obsidian, 'CoForge/Ideas/')).body;
    await openWorkflowRuns(view, card());
    const execution = () => view.getByRole('region', { name: 'Request workflow execution', exact: true });
    for (const [index, name] of ['Score', 'Plan', 'Design'].entries()) {
      await execution().getByRole('button', { name: `${index === 0 ? 'Start' : 'Run'} · ${name}`, exact: true }).click();
      await browserExpect(execution().getByRole('button', { name: `Run · ${['Plan', 'Design', 'Build'][index]}`, exact: true })).toBeEnabled();
    }
    const captured = workflowRunCheck(property(await note(obsidian, 'CoForge/Ideas/'), 'workflow-run'));
    expect(captured.definition).toEqual(project);
    expect(captured.cursor).toBe(4);
    expect(captured.attempts[0]).toMatchObject({ stepId: 'screen', status: 'skipped' });
    await view.getByRole('button', { name: 'Close idea details', exact: true }).click();
    await browserExpect(card()).toContainText('Design complete · Ready to build');
    await browserExpect(view.locator('.cf-column-design .cf-idea-card').filter({ hasText: 'Bucket workflow lantern' })).toBeVisible();
    await openWorkflowSettings(view);
    await view.getByRole('button', { name: 'Edit Design bucket', exact: true }).click();
    await view.getByLabel('Bucket name', { exact: true }).fill('Specification');
    await view.getByRole('button', { name: 'Save workflow', exact: true }).click();
    await browserExpect(view.locator('.cf-workflow-editor-notice')).toContainText('Workflow saved.');
    await obsidian.reloadPlugin();
    view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await view.getByRole('button', { name: /^Idea board/ }).first().click();
    await browserExpect(card()).toContainText('Design complete · Ready to build');
    await browserExpect(card().locator('xpath=ancestor::section[contains(@class,"cf-kanban-column")]')).toContainText('Earlier workflow');
    expect(workflowRunCheck(property(await note(obsidian, 'CoForge/Ideas/'), 'workflow-run')).definition).toEqual(project);
    expect(splitNote(await note(obsidian, 'CoForge/Ideas/')).body).toBe(body);
    await card().scrollIntoViewIfNeeded();
    await obsidian.screenshot('captured-bucket-design-ready-after-settings-change');
    await openWorkflowRuns(view, card());
    await execution().getByRole('button', { name: 'Run · Build', exact: true }).click();
    await browserExpect(execution().getByRole('button', { name: 'Review code changes', exact: true })).toBeVisible();
    expect(workflowRunCheck(property(await note(obsidian, 'CoForge/Ideas/'), 'workflow-run')).state).toBe('awaiting-review');
    expect(splitNote(await note(obsidian, 'CoForge/Ideas/')).body).toBe(body);
    expect(obsidian.errors()).toEqual([]);
  });
});
