import { expect as browserExpect, type Locator } from '@playwright/test';
import { describe, expect } from 'vitest';
import { test, type ObsidianHarness } from './support/obsidian-fixture';
import { openWorkflowDisclosure, openWorkflowRuns, openWorkflowSettings } from '../../../tests/e2e/support/workflow-navigation';
import { parseWorkflowDefinition } from '../../../src/plugin/features/coforge/domain/configured-workflow';
import { parsePersistedStudio } from '../../../src/plugin/features/coforge/domain/persisted';
import { splitNote } from '../../../src/plugin/infrastructure/coforge/markdown';

const TITLE = 'Read the saved lantern conversation';
const SCREEN_INSTRUCTION = 'History screening instruction captured at admission.';
const SCORE_INSTRUCTION = 'History scoring instruction captured at admission.';

async function privateState(obsidian: ObsidianHarness) {
  const json = await obsidian.eval(async ({ app, pluginId }) => {
    const directory = app.plugins.manifests[pluginId]?.dir ?? `${app.vault.configDir}/plugins/${pluginId}`;
    return app.vault.adapter.read(`${directory}/coforge-state.json`);
  });
  return parsePersistedStudio(JSON.parse(json));
}

async function requestNote(obsidian: ObsidianHarness) {
  return obsidian.eval(async ({ app }) => {
    const file = app.vault.getMarkdownFiles().find(file => file.path.startsWith('CoForge/Ideas/'));
    if (!file) throw new Error('The canonical request note is missing.');
    return app.vault.read(file);
  });
}

async function openActivity(view: Locator) {
  await view.getByRole('button', { name: /^Idea board/ }).first().click();
  await view.locator('.cf-idea-card').filter({ hasText: TITLE }).locator('.cf-idea-open').click();
  await view.getByRole('button', { name: 'Activity', exact: true }).click();
}

describe('Idea activity conversation history in the contained host', () => {
  test('reads each simulated prompt and answer after reload without rerunning work or changing the request', async ({ obsidian }) => {
    let view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await view.locator('.cf-project-switcher').click();
    await view.getByRole('button', { name: 'Add project', exact: true }).click();
    await view.getByLabel('Project name', { exact: true }).fill('Contained private conversation');
    await view.getByLabel(/^Project path/).fill('/synthetic/private-history');
    await view.getByLabel('Description', { exact: true }).fill('Verify private simulated input and output evidence.');
    await view.getByRole('button', { name: 'Create project', exact: true }).click();
    await browserExpect(view.locator('.cf-project-switcher')).toContainText('Contained private conversation');

    await openWorkflowSettings(view);
    await openWorkflowDisclosure(view, 'Workflow tools');
    await view.getByRole('button', { name: 'Preview workflow export', exact: true }).click();
    const definition = parseWorkflowDefinition(await view.getByLabel('Workflow export JSON', { exact: true }).textContent() ?? '');
    definition.steps = definition.steps.map((step, index) => step.kind === 'ai'
      ? { ...step, provider: 'demo', automatic: false, minVotes: 0,
        instructions: `${step.instructions}\n\n${index === 0 ? SCREEN_INSTRUCTION : SCORE_INSTRUCTION}` }
      : step);
    await view.getByRole('button', { name: 'Close JSON panel', exact: true }).click();
    await view.getByRole('button', { name: 'Import JSON', exact: true }).click();
    await view.getByLabel('Or paste workflow JSON', { exact: true }).fill(JSON.stringify(definition));
    await view.getByRole('button', { name: 'Preview import', exact: true }).click();
    await view.getByRole('button', { name: 'Replace draft', exact: true }).click();
    await view.getByRole('button', { name: 'Save workflow', exact: true }).click();
    await browserExpect(view.locator('.cf-workflow-editor-notice')).toContainText('Workflow saved.');

    await view.getByRole('button', { name: /^Idea board/ }).first().click();
    await view.locator('.cf-board-page > .cf-page-heading').getByRole('button', { name: 'New request', exact: true }).click();
    const dialog = view.getByRole('dialog');
    await dialog.getByLabel('The idea', { exact: true }).fill(TITLE);
    await dialog.getByLabel('A little more context', { exact: true }).fill('Keep this authored request intact while inspecting its history.');
    await dialog.getByLabel('Contributor name', { exact: true }).fill('Contained owner');
    await dialog.getByRole('button', { name: 'Add to the board', exact: true }).click();
    await browserExpect(view.locator('.cf-idea-card').filter({ hasText: TITLE })).toBeVisible();
    const authoredBody = splitNote(await requestNote(obsidian)).body;

    await openWorkflowRuns(view);
    const execution = view.getByRole('region', { name: 'Request workflow execution', exact: true });
    await execution.getByRole('button', { name: 'Start · Screen', exact: true }).click();
    await browserExpect(execution.getByRole('button', { name: 'Run · Score', exact: true })).toBeEnabled();
    await execution.getByRole('button', { name: 'Run · Score', exact: true }).click();
    await browserExpect(execution.getByRole('button', { name: 'Run · Plan', exact: true })).toBeEnabled();

    const saved = await privateState(obsidian);
    expect(saved.jobs).toHaveLength(2);
    const screen = saved.jobs.find(job => job.stage === 'screen');
    const score = saved.jobs.find(job => job.stage === 'score');
    if (!screen || !score) throw new Error('Both completed attempts must have retained history.');
    expect(screen?.conversation?.instructions.text).toContain(SCREEN_INSTRUCTION);
    expect(screen?.conversation?.prompt.text).toContain(TITLE);
    expect(screen?.conversation?.response?.text).toContain('screening');
    expect(score?.conversation?.instructions.text).toContain(SCORE_INSTRUCTION);
    expect(score?.conversation?.response?.text).toContain('rice');
    expect(saved.jobs.every(job => job.conversation?.simulated)).toBe(true);
    const note = await requestNote(obsidian);
    expect(splitNote(note).body).toBe(authoredBody);
    expect(note).not.toContain('responseCapturedAt');

    await openActivity(view);
    await browserExpect(view.locator('.cf-idea-run')).toHaveCount(2);
    const screeningRun = view.locator(`.cf-idea-run[data-job-id="${screen.id}"]`);
    await screeningRun.locator('summary').first().focus();
    await obsidian.page.keyboard.press('Enter');
    await browserExpect(screeningRun).toHaveAttribute('open', '');
    await browserExpect(screeningRun.getByRole('heading', { name: 'Simulated input', exact: true })).toBeVisible();
    await browserExpect(screeningRun.getByRole('heading', { name: 'Simulated response', exact: true })).toBeVisible();
    await screeningRun.locator('summary').filter({ hasText: /^System instructions$/ }).click();
    await browserExpect(screeningRun).toContainText(SCREEN_INSTRUCTION);
    await browserExpect(screeningRun).toContainText(TITLE);
    await browserExpect(screeningRun).toContainText('screening');
    await browserExpect(screeningRun).not.toContainText(SCORE_INSTRUCTION);
    await obsidian.screenshot('idea-activity-simulated-conversation');

    await obsidian.reloadPlugin();
    view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await openActivity(view);
    const scoringRun = view.locator(`.cf-idea-run[data-job-id="${score.id}"]`);
    await scoringRun.locator('summary').first().click();
    await scoringRun.locator('summary').filter({ hasText: /^System instructions$/ }).click();
    await browserExpect(scoringRun).toContainText(SCORE_INSTRUCTION);
    await browserExpect(scoringRun).toContainText('rice');
    await browserExpect(scoringRun).not.toContainText(SCREEN_INSTRUCTION);
    const reloaded = await privateState(obsidian);
    expect(reloaded.jobs).toEqual(saved.jobs);
    expect(splitNote(await requestNote(obsidian)).body).toBe(authoredBody);
    await obsidian.screenshot('idea-activity-conversation-after-reload');
    const history = scoringRun.getByRole('region', { name: 'Chat history', exact: true });
    for (const width of [1280, 720]) for (const theme of ['light', 'dark']) {
      await obsidian.page.setViewportSize({ width, height: 900 });
      await obsidian.eval((_context, value) => {
        document.body.classList.remove('theme-light', 'theme-dark');
        document.body.classList.add(`theme-${value}`);
      }, theme);
      await browserExpect(history).toBeVisible();
      expect(await history.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await scoringRun.locator('summary').first().evaluate(element => element.scrollIntoView({ block: 'start' }));
      await obsidian.screenshot(`idea-chat-history-${theme}-${width}`);
      await scoringRun.getByRole('heading', { name: 'Simulated response', exact: true }).evaluate(element => element.scrollIntoView({ block: 'start' }));
      await obsidian.screenshot(`idea-chat-response-${theme}-${width}`);
    }
    expect(obsidian.errors()).toEqual([]);
  });
});
