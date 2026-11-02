import { expect as browserExpect } from '@playwright/test';
import { describe, expect } from 'vitest';
import { test, type ObsidianHarness } from './support/obsidian-fixture';
import { READING_TASK, READING_ANSWER } from '../../../tests/e2e/support/readable-content-fixture';

const TITLE = 'Codex context disclosure rendering fixture';
const PROMPT = READING_TASK;
const INSTRUCTIONS = 'Rendering fixture CoForge instructions only. No personal AGENTS or skill content was read.';
const RESPONSE = READING_ANSWER;
const AT = '2026-11-01T08:00:00.000Z';

async function requestNote(obsidian: ObsidianHarness) {
  return obsidian.eval(async ({ app }) => {
    const note = app.vault.getMarkdownFiles().find(file => file.path.startsWith('CoForge/Ideas/'));
    if (!note) throw new Error('Fixture request note missing.');
    return { path: note.path, content: await app.vault.read(note) };
  });
}

describe('Codex CoForge-context disclosure in the contained host', () => {
  test('qualifies captured-task labels and SDK context boundaries with an explicitly labelled unpaid rendering fixture', async ({ obsidian }) => {
    let view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await view.locator('.cf-project-switcher').click();
    await view.getByRole('button', { name: 'Add project', exact: true }).click();
    await view.getByLabel('Project name', { exact: true }).fill('Codex disclosure rendering fixture');
    await view.getByLabel(/^Project path/).fill('/synthetic/codex-disclosure');
    await view.getByLabel('Description', { exact: true }).fill('Rendering qualification only. No provider or global-context file is read.');
    await view.getByRole('button', { name: 'Create project', exact: true }).click();
    await view.getByRole('button', { name: /^Idea board/ }).first().click();
    await view.locator('.cf-board-page > .cf-page-heading').getByRole('button', { name: 'New request', exact: true }).click();
    const dialog = view.getByRole('dialog');
    await dialog.getByLabel('The idea', { exact: true }).fill(TITLE);
    await dialog.getByLabel('A little more context', { exact: true }).fill('Render an explicitly labelled fixture of captured CoForge context.');
    await dialog.getByLabel('Contributor name', { exact: true }).fill('Rendering fixture owner');
    await dialog.getByRole('button', { name: 'Add to the board', exact: true }).click();
    await browserExpect(view.locator('.cf-idea-card').filter({ hasText: TITLE })).toBeVisible();
    const original = await requestNote(obsidian);
    const ideaId = /^id:\s*(CF-\d+)\s*$/mu.exec(original.content)?.[1];
    if (!ideaId) throw new Error('Canonical fixture identity missing.');
    await obsidian.disablePlugin();
    // Seed only this contained test vault's private evidence while the plugin is stopped.
    await obsidian.eval(async ({ app, pluginId }, fixture) => {
      const path = `.coforge-data/studio/coforge-state.json`;
      const state = JSON.parse(await app.vault.adapter.read(path));
      if (state.jobs.length !== 0) throw new Error('Rendering fixture must begin with no dispatched jobs.');
      state.jobs = [{ id: 'codex-render-fixture', ideaId: fixture.ideaId, projectId: state.activeProjectId, provider: 'codex', model: 'gpt-6.1-sol', stage: 'plan', status: 'succeeded', startedAt: fixture.at, finishedAt: fixture.at, logs: ['Unpaid rendering fixture; no CLI inference was started.'],
        conversation: { capturedAt: fixture.at, instructions: { text: fixture.instructions, truncated: false }, prompt: { text: fixture.prompt, truncated: false }, response: { text: fixture.response, truncated: false }, responseCapturedAt: fixture.at, simulated: false } }];
      await app.vault.adapter.write(path, JSON.stringify(state, null, 2));
    }, { ideaId, at: AT, prompt: PROMPT, instructions: INSTRUCTIONS, response: RESPONSE });
    await obsidian.enablePlugin();
    view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await view.getByRole('button', { name: /^Idea board/ }).first().click();
    await view.locator('.cf-idea-card').filter({ hasText: TITLE }).locator('.cf-idea-open').click();
    await view.getByRole('button', { name: 'Activity', exact: true }).click();
    const run = view.locator('[data-job-id="codex-render-fixture"]');
    await run.locator('summary').first().focus();
    await obsidian.page.keyboard.press('Enter');
    const history = run.getByRole('region', { name: 'Chat history', exact: true });
    await browserExpect(history.getByRole('heading', { name: 'CoForge task prompt', exact: true })).toBeVisible();
    await browserExpect(history).toContainText('not the complete SDK prompt');
    await browserExpect(history).toContainText('global AGENTS.md and skills');
    await browserExpect(history.locator('[data-attempt-section="task"] .cf-readable-body')).toContainText('Community proposal (untrusted)');
    await browserExpect(history.locator('[data-attempt-section="task"] .cf-readable-body strong')).toHaveText('Hiring Pool');
    await browserExpect(history.locator('[data-attempt-section="response"] .cf-readable-body strong')).toHaveText('preview a role');
    await browserExpect(history.locator('.cf-readable-original[open]')).toHaveCount(0);
    await browserExpect(run.locator('summary').first()).toContainText('gpt-6.1-sol');
    const instructions = history.locator('summary').filter({ hasText: /^CoForge instructions$/ });
    await instructions.focus(); await obsidian.page.keyboard.press('Enter');
    expect(await history.locator('.cf-readable-source').allTextContents()).toEqual([PROMPT, RESPONSE, INSTRUCTIONS]);
    for (const label of ['Original prompt text', 'Original response text']) {
      const original = history.locator('summary').filter({ hasText: new RegExp(`^${label}$`, 'u') });
      await original.focus(); await original.press('Enter');
      await browserExpect(history.locator(`pre[aria-label="${label}"]`)).toBeVisible();
      await original.press('Enter');
    }
    await browserExpect(history.locator('script')).toHaveCount(0);
    for (const width of [1360, 760]) for (const theme of ['light', 'dark']) {
      await obsidian.page.setViewportSize({ width, height: 900 });
      await obsidian.eval((_context, selected) => {
        document.body.classList.toggle('theme-light', selected === 'light');
        document.body.classList.toggle('theme-dark', selected === 'dark');
      }, theme);
      await history.getByRole('heading', { name: 'CoForge task prompt', exact: true }).scrollIntoViewIfNeeded();
      expect(await history.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await obsidian.screenshot(`codex-coforge-context-fixture-${theme}-${width}`);
      await history.getByRole('heading', { name: 'LLM response', exact: true }).scrollIntoViewIfNeeded();
      await obsidian.screenshot(`readable-agent-answer-${theme}-${width}`);
    }
    expect(await requestNote(obsidian)).toEqual(original);
    expect(obsidian.errors()).toEqual([]);
  });
});
