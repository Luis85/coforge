import { expect as browserExpect } from '@playwright/test';
import { describe, expect } from 'vitest';
import { test, type ObsidianHarness } from './support/obsidian-fixture';
import { openWorkflowDisclosure, openWorkflowRuns, openWorkflowSettings } from '../../../tests/e2e/support/workflow-navigation';
import { defaultWorkflowDefinition } from '../../../src/plugin/features/coforge/domain/configured-workflow';
import { defaultSettings } from '../../../src/plugin/features/coforge/domain/seed';
import { parsePersistedStudio } from '../../../src/plugin/features/coforge/domain/persisted';

const TITLE = 'Review the captured lantern increment';

async function retainedEvidence(obsidian: ObsidianHarness) {
  const retained = await obsidian.eval(async ({ app, pluginId }) => {
    const directory = app.plugins.manifests[pluginId]?.dir ?? `${app.vault.configDir}/plugins/${pluginId}`;
    const note = app.vault.getMarkdownFiles().find(file => file.path.startsWith('CoForge/Ideas/'));
    if (!note) throw new Error('The request note is missing.');
    return { state: await app.vault.adapter.read(`${directory}/coforge-state.json`), note: await app.vault.read(note) };
  });
  return { state: parsePersistedStudio(JSON.parse(retained.state)), note: retained.note };
}

describe('Increment review handoff in the contained host', () => {
  test('keeps captured criteria and follow-up findings private, readable and keyboard accessible after reload', async ({ obsidian }) => {
    let view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await view.locator('.cf-project-switcher').click();
    await view.getByRole('button', { name: 'Add project', exact: true }).click();
    await view.getByLabel('Project name', { exact: true }).fill('Contained increment review');
    await view.getByLabel(/^Project path/).fill('/synthetic/increment-review');
    await view.getByLabel('Description', { exact: true }).fill('Verify private simulated review evidence without executing providers.');
    await view.getByRole('button', { name: 'Create project', exact: true }).click();
    await browserExpect(view.locator('.cf-project-switcher')).toContainText('Contained increment review');
    await openWorkflowSettings(view);
    const definition = defaultWorkflowDefinition(defaultSettings());
    definition.steps = definition.steps.map(step => step.kind === 'ai' ? { ...step, provider: 'demo', automatic: false, minVotes: 0 } : step);
    definition.steps.push({ id: 'assessment', name: 'Product assessment', kind: 'ai', output: 'markdown', access: 'readproject',
      provider: 'demo', model: 'sonnet', automatic: false, minVotes: 0, instructions: 'Assess the captured increment.', inputs: ['codechange'] });
    await openWorkflowDisclosure(view, 'Workflow tools');
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
    await dialog.getByLabel('A little more context', { exact: true }).fill('Keep the authored request intact while reviewing an illustrative change.');
    await dialog.getByLabel('Contributor name', { exact: true }).fill('Contained owner');
    await dialog.getByRole('button', { name: 'Add to the board', exact: true }).click();
    await browserExpect(view.locator('.cf-idea-card').filter({ hasText: TITLE })).toBeVisible();
    await openWorkflowRuns(view, view.locator('.cf-idea-card').filter({ hasText: TITLE }));
    const execution = view.getByRole('region', { name: 'Request workflow execution', exact: true });
    for (const [index, name] of ['Score', 'Plan', 'Design', 'Build', 'Product assessment'].entries()) {
      const run = execution.getByRole('button', { name: `${index === 0 ? 'Start' : 'Run'} · ${name}`, exact: true });
      await browserExpect(run).toBeEnabled();
      await run.click();
    }
    await browserExpect(execution.getByRole('button', { name: 'Review code changes', exact: true })).toBeVisible();
    await execution.getByRole('button', { name: 'Review code changes', exact: true }).click();
    await browserExpect(view.getByRole('region', { name: 'Post-build findings', exact: true })).toContainText('Simulated Product assessment');
    const saved = await retainedEvidence(obsidian);
    await obsidian.reloadPlugin();
    view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await view.getByRole('button', { name: /^Idea board/ }).first().click();
    await view.locator('.cf-idea-card').filter({ hasText: TITLE }).locator('.cf-idea-open').click();
    await view.getByRole('button', { name: 'Increment', exact: true }).click();
    const criteria = view.getByRole('region', { name: 'Planned acceptance criteria', exact: true });
    const findings = view.getByRole('region', { name: 'Post-build findings', exact: true });
    await browserExpect(criteria).toContainText('Saved plan · not verified');
    await browserExpect(findings).toContainText('Simulated assessment');
    await browserExpect(view.getByRole('button', { name: 'Accept increment', exact: true })).toBeEnabled();
    const disclosure = findings.locator('details');
    const summary = disclosure.locator('summary');
    const diff = view.getByRole('region', { name: 'Illustrative diff', exact: true });
    for (const width of [1280, 720]) for (const theme of ['light', 'dark']) {
      await obsidian.page.setViewportSize({ width, height: 900 });
      await obsidian.eval((_context, selected) => {
        document.body.classList.toggle('theme-light', selected === 'light');
        document.body.classList.toggle('theme-dark', selected === 'dark');
      }, theme);
      await summary.focus();
      await obsidian.page.keyboard.press('Enter');
      await browserExpect(disclosure).not.toHaveAttribute('open', '');
      await obsidian.page.keyboard.press('Enter');
      await browserExpect(disclosure).toHaveAttribute('open', '');
      await browserExpect(summary).toBeFocused();
      expect(await findings.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      expect(await criteria.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await findings.scrollIntoViewIfNeeded();
      await obsidian.screenshot(`increment-findings-${theme}-${width}`);
      await diff.focus();
      await browserExpect(diff).toBeFocused();
      expect(await diff.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await obsidian.screenshot(`increment-diff-${theme}-${width}`);
    }
    const reloaded = await retainedEvidence(obsidian);
    expect(reloaded.note).toBe(saved.note);
    expect(reloaded.state.jobs).toEqual(saved.state.jobs);
    expect(reloaded.state.increments).toEqual(saved.state.increments);
    expect(reloaded.state.events).toEqual(saved.state.events);
    expect(reloaded.state.requestOrigins).toEqual(saved.state.requestOrigins);
    expect(reloaded.state.votes).toEqual(saved.state.votes);
    expect(reloaded.state.integrity).toEqual(saved.state.integrity);
    expect(reloaded.state.manualHolds).toEqual(saved.state.manualHolds);
    expect(reloaded.state.population?.rewards).toEqual(saved.state.population?.rewards);
    expect(reloaded.state.population?.players).toEqual(saved.state.population?.players);
    // Opening the host legitimately records studio opening/detection, not new work.
    const before = saved.state.population;
    const after = reloaded.state.population;
    if (!before || !after) throw new Error('Expected the retained operation history.');
    expect(after.operations.slice(0, before.operations.length)).toEqual(before.operations);
    const arrivals = after.operations.slice(before.operations.length);
    expect(arrivals.every(operation => ['stream-studio-opened', 'obs-detection-requested', 'obs-detected'].includes(operation.code))).toBe(true);
    const expectedCounters = new Map(Object.entries(before.counters));
    for (const arrival of arrivals) expectedCounters.set(arrival.code, (expectedCounters.get(arrival.code) ?? 0) + arrival.count);
    expect(after.counters).toEqual(Object.fromEntries(expectedCounters));
    expect(after.nextSequence).toBe(before.nextSequence + arrivals.length);
    expect(obsidian.errors()).toEqual([]);
  });
});
