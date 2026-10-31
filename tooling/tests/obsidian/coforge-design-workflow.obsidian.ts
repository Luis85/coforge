import { expect as browserExpect } from '@playwright/test';
import { describe, expect } from 'vitest';
import { parse } from 'yaml';
import { test, type ObsidianHarness } from './support/obsidian-fixture';
import { openWorkflowDisclosure, openWorkflowRuns, openWorkflowSettings } from '../../../tests/e2e/support/workflow-navigation';
import { parseWorkflowDefinition } from '../../../src/plugin/features/coforge/domain/configured-workflow';
import { workflowRunCheck } from '../../../src/plugin/features/coforge/domain/configured-workflow-run';
import { restoreWorkflowNoteData } from '../../../src/plugin/features/coforge/domain/workflow-note-data';
import { record } from '../../../src/plugin/features/coforge/domain/check';
import { splitNote } from '../../../src/plugin/infrastructure/coforge/markdown';

async function requestNote(obsidian: ObsidianHarness): Promise<string> {
  const text = await obsidian.eval(async ({ app }) => {
    const file = app.vault.getMarkdownFiles().find(file => file.path.startsWith('CoForge/Ideas/'));
    return file ? app.vault.read(file) : null;
  });
  if (text === null) throw new Error('Canonical request note is missing.');
  return text;
}
function retainedRun(note: string) {
  const yaml = splitNote(note).yaml;
  if (yaml === null) throw new Error('Canonical frontmatter is missing.');
  return workflowRunCheck(restoreWorkflowNoteData(record(parse(yaml))['workflow-run']));
}

describe('Design specification handoff in the contained host', () => {
  test('retains the private specification across reload, exposes it in the drawer and binds it to Build', async ({ obsidian }) => {
    let view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await view.locator('.cf-project-switcher').click();
    await view.getByRole('button', { name: 'Add project', exact: true }).click();
    await view.getByLabel('Project name', { exact: true }).fill('Contained Design workflow');
    await view.getByLabel(/^Project path/).fill('/synthetic/design-workflow');
    await view.getByLabel('Description', { exact: true }).fill('A private simulation verifies specification retention and review.');
    await view.getByRole('button', { name: 'Create project', exact: true }).click();
    await browserExpect(view.locator('.cf-project-switcher')).toContainText('Contained Design workflow');

    await openWorkflowSettings(view);
    await browserExpect(view.getByRole('list', { name: 'Workflow steps', exact: true }).getByRole('listitem')).toHaveCount(5);
    await openWorkflowDisclosure(view, 'Workflow tools');
    await view.getByRole('button', { name: 'Preview workflow export', exact: true }).click();
    const exported = await view.getByLabel('Workflow export JSON', { exact: true }).textContent();
    const definition = parseWorkflowDefinition(exported ?? '');
    expect(definition.steps.map(step => step.name)).toEqual(['Screen', 'Score', 'Plan', 'Design', 'Build']);
    expect(definition.steps[3]).toMatchObject({ output: 'design', access: 'readproject', inputs: ['plan'] });
    definition.steps = definition.steps.map(step => step.kind === 'ai'
      ? { ...step, provider: 'demo', automatic: false, minVotes: 0 } : step);
    await view.getByRole('button', { name: 'Close JSON panel', exact: true }).click();
    await view.getByRole('button', { name: 'Import JSON', exact: true }).click();
    await view.getByLabel('Or paste workflow JSON', { exact: true }).fill(JSON.stringify(definition));
    await view.getByRole('button', { name: 'Preview import', exact: true }).click();
    await view.getByRole('button', { name: 'Replace draft', exact: true }).click();
    await view.getByRole('button', { name: 'Save workflow', exact: true }).click();
    await browserExpect(view.locator('.cf-workflow-editor-notice')).toContainText('Workflow saved.');

    await obsidian.reloadPlugin();
    view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await view.getByRole('button', { name: /^Idea board/ }).first().click();
    await view.locator('.cf-board-page > .cf-page-heading').getByRole('button', { name: 'New request', exact: true }).click();
    const dialog = view.getByRole('dialog');
    await dialog.getByLabel('The idea', { exact: true }).fill('Native Design specification');
    await dialog.getByLabel('A little more context', { exact: true }).fill('Preserve this authored request while preparing a small lantern interaction.');
    await dialog.getByLabel('Contributor name', { exact: true }).fill('Contained streamer');
    await dialog.getByRole('button', { name: 'Add to the board', exact: true }).click();
    await browserExpect(view.locator('.cf-idea-card').filter({ hasText: 'Native Design specification' })).toBeVisible();
    const body = splitNote(await requestNote(obsidian)).body;

    await openWorkflowRuns(view, view.locator('.cf-idea-card').filter({ hasText: 'Native Design specification' }));
    const execution = () => view.getByRole('region', { name: 'Request workflow execution', exact: true });
    for (const [index, name] of ['Screen', 'Score', 'Plan', 'Design'].entries()) {
      await execution().getByRole('button', { name: `${index === 0 ? 'Start' : 'Run'} · ${name}`, exact: true }).click();
      const next = ['Score', 'Plan', 'Design', 'Build'][index];
      await browserExpect(execution().getByRole('button', { name: `Run · ${next}`, exact: true })).toBeEnabled();
    }
    const saved = retainedRun(await requestNote(obsidian));
    const design = saved.artifacts.find(artifact => artifact.output === 'design');
    expect(design?.markdown).toContain('Native Design specification');
    expect(saved.cursor).toBe(4);
    expect(saved.attempts.some(attempt => attempt.stepId === 'implement')).toBe(false);
    await view.getByRole('button', { name: 'Close idea details', exact: true }).click();
    await view.getByRole('button', { name: /^Idea board/ }).first().click();
    const card = () => view.locator('.cf-column-design .cf-idea-card').filter({ hasText: 'Native Design specification' });
    await browserExpect(card()).toBeVisible();
    await browserExpect(card()).toContainText('Design complete · Ready to build');
    await card().scrollIntoViewIfNeeded();
    await obsidian.screenshot('design-complete-ready-to-build');
    await card().locator('.cf-idea-open').click();
    await view.getByRole('button', { name: 'Plan & Design', exact: true }).click();
    await browserExpect(view.getByRole('region', { name: 'Design specification', exact: true })).toContainText('Native Design specification');
    await view.getByRole('button', { name: 'Close idea details', exact: true }).click();

    await obsidian.reloadPlugin();
    view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    const reloaded = retainedRun(await requestNote(obsidian));
    expect(reloaded.artifacts.find(artifact => artifact.output === 'design')).toEqual(design);
    expect(splitNote(await requestNote(obsidian)).body).toBe(body);
    await view.getByRole('button', { name: /^Idea board/ }).first().click();
    await browserExpect(card()).toContainText('Design complete · Ready to build');
    await card().locator('.cf-idea-open').click();
    await view.getByRole('button', { name: 'Plan & Design', exact: true }).click();
    await browserExpect(view.getByRole('region', { name: 'Design specification', exact: true })).toContainText('Native Design specification');
    await view.getByRole('button', { name: 'Close idea details', exact: true }).click();
    await openWorkflowRuns(view, view.locator('.cf-idea-card').filter({ hasText: 'Native Design specification' }));
    await execution().getByRole('button', { name: 'Run · Build', exact: true }).click();
    await browserExpect(execution().getByRole('button', { name: 'Review code changes', exact: true })).toBeVisible();
    const built = retainedRun(await requestNote(obsidian));
    expect(built.state).toBe('awaiting-review');
    expect(built.attempts.find(attempt => attempt.stepId === 'implement')?.inputs).toEqual([
      saved.artifacts.find(artifact => artifact.output === 'plan')?.id, design?.id,
    ]);
    expect(splitNote(await requestNote(obsidian)).body).toBe(body);
    await obsidian.screenshot('design-retained-build-awaiting-review');
    expect(obsidian.errors()).toEqual([]);
  });
});
