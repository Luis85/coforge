import { expect as browserExpect } from '@playwright/test';
import { describe, expect } from 'vitest';
import { test } from './support/obsidian-fixture';
import { openWorkflowDisclosure, openWorkflowSettings } from '../../../tests/e2e/support/workflow-navigation';
import { parsePersistedStudio } from '../../../src/plugin/features/coforge/domain/persisted';
import { parse } from 'yaml';
import { record } from '../../../src/plugin/features/coforge/domain/check';
import { parseProjectNote } from '../../../src/plugin/features/coforge/domain/project-note';
import { splitNote } from '../../../src/plugin/infrastructure/coforge/markdown';

describe('Native workflow tools authoring in the contained host', () => {
  test('authors normal native coding without Docker setup or dispatch, preserving the explicit limit and keyboard layout across reload', async ({ obsidian }) => {
    let view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await view.locator('.cf-project-switcher').click();
    await view.getByRole('button', { name: 'Add project', exact: true }).click();
    await view.getByLabel('Project name', { exact: true }).fill('Native tools authoring');
    await view.getByLabel(/^Project path/).fill('/synthetic/native-tools-ui');
    await view.getByLabel('Description', { exact: true }).fill('Authoring only: no model, Docker command or image availability claim.');
    await view.getByRole('button', { name: 'Create project', exact: true }).click();
    await openWorkflowSettings(view);
    await view.locator('[data-step-id="implement"] .cf-workflow-step-select').click();
    await openWorkflowDisclosure(view, 'Agent and project access');
    await view.getByLabel('AI provider', { exact: true }).selectOption('codex');
    await view.getByLabel('Maximum concurrent native assistants', { exact: true }).fill('3');
    await view.getByRole('button', { name: 'Save workflow', exact: true }).click();
    await browserExpect(view.locator('.cf-workflow-editor-notice')).toContainText('Workflow saved.');
    await obsidian.reloadPlugin();
    view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await openWorkflowSettings(view);
    await view.locator('[data-step-id="implement"] .cf-workflow-step-select').click();
    await browserExpect(view.getByLabel('Allow provider-native assistants', { exact: true })).toHaveCount(0);
    await browserExpect(view.getByLabel('AI model', { exact: true })).toHaveValue('gpt-6.1-sol');
    await browserExpect(view.getByLabel('Maximum concurrent native assistants', { exact: true })).toHaveValue('3');
    const tools = view.getByRole('region', { name: 'Native workflow tools', exact: true });
    await browserExpect(tools).toContainText('global AGENTS.md and skills');
    await browserExpect(tools).toContainText('do not grant tools');
    await browserExpect(tools.getByRole('region', { name: 'Native worktree coding', exact: true })).toContainText('normal file tools, shell, project tests');
    await browserExpect(tools.getByRole('region', { name: 'Native worktree coding', exact: true })).toContainText('Internet research is allowed');
    await browserExpect(tools).not.toContainText('Configure isolated Docker verification');
    for (const width of [1360, 760]) for (const theme of ['light', 'dark']) {
      await obsidian.page.setViewportSize({ width, height: 900 });
      await obsidian.eval((_context, selected) => {
        document.body.classList.toggle('theme-light', selected === 'light');
        document.body.classList.toggle('theme-dark', selected === 'dark');
      }, theme);
      const execution = view.getByLabel('Build execution policy', { exact: true });
      await execution.focus(); await browserExpect(execution).toBeFocused();
      await obsidian.page.keyboard.press('Tab');
      const concurrency = tools.getByLabel('Maximum concurrent native assistants', { exact: true });
      await browserExpect(concurrency).toBeFocused();
      await obsidian.page.keyboard.press('ArrowUp');
      await browserExpect(concurrency).toHaveValue('4');
      await obsidian.page.keyboard.press('ArrowDown');
      await browserExpect(concurrency).toHaveValue('3');
      expect(await tools.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await tools.scrollIntoViewIfNeeded();
      await obsidian.screenshot(`native-tools-${theme}-${width}`);
    }
    const data = await obsidian.eval(async ({ app, pluginId }) => {
      const folder = app.plugins.manifests[pluginId]?.dir ?? `${app.vault.configDir}/plugins/${pluginId}`;
      return app.vault.adapter.read(`${folder}/coforge-state.json`);
    });
    const saved = parsePersistedStudio(JSON.parse(data));
    expect(saved.jobs).toEqual([]);
    expect(saved.integration.workflowVerification).toBeUndefined();
    const projectNotes = await obsidian.eval(async ({ app }) => Promise.all(app.vault.getMarkdownFiles().filter(file => file.path.startsWith('CoForge/Projects/')).map(file => app.vault.read(file))));
    const project = projectNotes.map(text => parseProjectNote(record(parse(splitNote(text).yaml ?? '')))).find(project => project.settings.projectName === 'Native tools authoring');
    const build = project?.settings.workflow?.steps.find(step => step.id === 'implement');
    if (!build || build.kind !== 'ai') throw new Error('Missing captured workflow definition.');
    expect(build.nativeTools).toEqual({ delegation: { maxConcurrent: 3 } });
    expect(obsidian.errors()).toEqual([]);
  });
});
