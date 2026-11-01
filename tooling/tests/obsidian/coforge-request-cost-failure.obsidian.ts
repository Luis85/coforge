import { expect as browserExpect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { describe, expect } from 'vitest';
import { test } from './support/obsidian-fixture';

const TITLE = 'Synthetic failed Build and retained cost fixture';
describe('Recorded failure and request cost details in the contained host', () => {
  test('makes missing legacy evidence explicit and reads scoped retained costs without dispatch or note changes', async ({ obsidian }) => {
    let view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await view.locator('.cf-project-switcher').click();
    await view.getByRole('button', { name: 'Add project', exact: true }).click();
    await view.getByLabel('Project name', { exact: true }).fill('Synthetic failure and cost project');
    await view.getByLabel(/^Project path/).fill('/synthetic/failure-costs');
    await view.getByLabel('Description', { exact: true }).fill('Historical rendering fixture only. No model, shell or verification command is invoked.');
    await view.getByRole('button', { name: 'Create project', exact: true }).click();
    await view.getByRole('button', { name: /^Idea board/ }).first().click();
    await view.getByRole('button', { name: 'New request', exact: true }).first().click();
    await view.getByLabel('The idea', { exact: true }).fill(TITLE);
    await view.getByLabel('A little more context', { exact: true }).fill('Synthetic historical data only; no provider or billing claim.');
    await view.getByRole('button', { name: 'Add to the board', exact: true }).click();
    const card = view.locator('.cf-idea-card').filter({ hasText: TITLE });
    const ideaId = (await card.locator('.cf-idea-id').innerText()).trim();
    const note = await obsidian.eval(async ({ app }) => {
      const file = app.vault.getMarkdownFiles().find(file => file.path.startsWith('CoForge/Ideas/'));
      if (!file) throw new Error('Missing contained request note.');
      return { path: file.path, bytes: await app.vault.read(file) };
    });
    await obsidian.disablePlugin();
    await obsidian.eval(async ({ app, pluginId }, ideaId) => {
      const path = `.obsidian/plugins/${pluginId}/coforge-state.json`;
      const state = JSON.parse(await app.vault.adapter.read(path));
      const projectId = state.activeProjectId; const at = '2026-11-01T13:00:00Z';
      state.jobs = [{ id: 'synthetic-failed-build', ideaId, projectId, provider: 'codex', model: 'captured-synthetic-model', stage: 'implement',
        status: 'failed', startedAt: at, finishedAt: '2026-11-01T13:01:00Z', logs: [],
        error: 'Inspect retained conversation and workspace before an explicit retry.', costUsd: 1.25, usage: { inputTokens: 12, outputTokens: 0 } }];
      await app.vault.adapter.write(path, JSON.stringify(state, null, 2));
      for (const folder of ['CoForge', 'CoForge/AI-Costs']) if (!app.vault.getAbstractFileByPath(folder)) await app.vault.createFolder(folder);
      const base = { featureId: ideaId, featureTitle: 'Synthetic cost fixture', projectId, projectName: 'Synthetic project', stage: 'implement', startedAt: at,
        workflow: { runId: 'retained-synthetic-run', definitionRevision: 'captured-v1', stepId: 'build', stepName: 'Retained Build', attemptId: 'retained-attempt' } };
      const tasks = [
        { ...base, id: 'retained-manual', provider: 'claude', model: 'captured-manual-model', status: 'cancelled', manualUsd: '2.50', manualNote: 'Synthetic manual provenance', manualAt: at },
        { ...base, id: 'retained-unknown', provider: 'codex', status: 'failed' },
        { ...base, id: 'retained-demo', provider: 'demo', status: 'succeeded', reportedUsd: 999 },
        { ...base, id: 'foreign-project', projectId: 'CFP-999', provider: 'claude', model: 'FOREIGN_PROJECT_MODEL', status: 'failed', reportedUsd: 900 },
        { ...base, id: 'foreign-feature', featureId: 'CF-999', provider: 'claude', model: 'FOREIGN_FEATURE_MODEL', status: 'failed', reportedUsd: 800 },
      ];
      const ledger = `---\ntype: coforge-ai-costs\nversion: 1\ncurrency: USD\ntasks: ${JSON.stringify(tasks)}\n---\n\n# Synthetic retained ledger fixture\n`;
      const file = app.vault.getFileByPath('CoForge/AI-Costs/Ledger.md');
      if (file) await app.vault.modify(file, ledger); else await app.vault.create('CoForge/AI-Costs/Ledger.md', ledger);
    }, ideaId);
    await obsidian.enablePlugin(); view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await view.getByRole('button', { name: /^Idea board/ }).first().click();
    await view.getByRole('button', { name: `Sessions 1 parent attempt for ${ideaId}`, exact: true }).click();
    const drawer = view.getByRole('dialog', { name: TITLE, exact: true });
    const sections = drawer.getByRole('navigation', { name: 'Idea sections', exact: true });
    await browserExpect(sections.getByRole('button')).toHaveText(['Overview', 'Sessions', 'Plan & Design', 'Increment', 'Workflow runs', 'AI costs', 'Activity']);
    const failure = drawer.getByRole('region', { name: 'Recorded attempt failure', exact: true });
    await browserExpect(failure).toContainText('Specific cause was not recorded');
    await browserExpect(failure).toContainText('No response captured'); await browserExpect(failure).toContainText('No workspace captured');
    await browserExpect(failure).toContainText('No retained changes captured for this attempt');
    await browserExpect(failure.getByRole('button', { name: /Retry|Restart|Check original|Accept/i })).toHaveCount(0);
    await failure.getByRole('button', { name: 'Read original attempt details', exact: true }).click();
    const original = drawer.locator('[data-job-id="synthetic-failed-build"]');
    await browserExpect(original).toHaveJSProperty('open', true); await browserExpect(original.locator('summary').first()).toBeFocused();
    await browserExpect(original).toContainText('Chat history was not recorded');
    await sections.getByRole('button', { name: 'Sessions', exact: true }).click();
    await obsidian.screenshot('legacy-failure-with-explicit-missing-resources');
    await sections.getByRole('button', { name: 'AI costs', exact: true }).click();
    const costs = drawer.getByRole('region', { name: 'Request AI costs', exact: true });
    await browserExpect(costs.getByRole('button', { name: 'Refresh cost history', exact: true })).toBeEnabled();
    await costs.getByRole('button', { name: 'Refresh cost history', exact: true }).click();
    await browserExpect(costs.getByText('Known subtotal · USD', { exact: true }).locator('..').locator('dd')).toContainText(/3[,.]75/);
    await browserExpect(costs).toContainText('2 of 3'); await browserExpect(costs).toContainText('Manual fallback');
    await browserExpect(costs).toContainText('Synthetic manual provenance'); await browserExpect(costs).toContainText('Unavailable');
    await browserExpect(costs).not.toContainText('FOREIGN_PROJECT_MODEL'); await browserExpect(costs).not.toContainText('FOREIGN_FEATURE_MODEL');
    await browserExpect(costs.locator('input,textarea,select')).toHaveCount(0);
    for (const width of [1440, 760]) for (const theme of ['light', 'dark']) {
      await obsidian.page.setViewportSize({ width, height: 960 });
      await obsidian.eval((_context, theme) => { document.body.classList.toggle('theme-light', theme === 'light'); document.body.classList.toggle('theme-dark', theme === 'dark'); }, theme);
      await sections.getByRole('button', { name: 'Sessions', exact: true }).click();
      await browserExpect(failure).toBeVisible(); expect(await failure.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await obsidian.screenshot(`failure-${theme}-${width}`);
      await sections.getByRole('button', { name: 'AI costs', exact: true }).click();
      await costs.evaluate(element => element.scrollIntoView({ block: 'start' }));
      expect(await costs.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      expect((await new AxeBuilder({ page: obsidian.page }).setLegacyMode(true).include('[aria-label="Request AI costs"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
      await obsidian.screenshot(`request-costs-${theme}-${width}`);
      await costs.locator('.cf-idea-cost-attempts details').filter({ hasText: 'Synthetic manual provenance' }).locator('summary').click();
      await obsidian.screenshot(`request-cost-provenance-${theme}-${width}`);
    }
    expect(await obsidian.eval(({ app }, path) => app.vault.adapter.read(path), note.path)).toBe(note.bytes);
    expect(await obsidian.eval(async ({ app, pluginId }) => JSON.parse(await app.vault.adapter.read(`.obsidian/plugins/${pluginId}/coforge-state.json`)).jobs.length)).toBe(1);
    expect(obsidian.errors()).toEqual([]);
  });
});
