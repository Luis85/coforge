import { expect as browserExpect } from '@playwright/test';
import { describe, expect } from 'vitest';
import { test } from './support/obsidian-fixture';
import { appendAgentSessionEvent } from '../../../src/plugin/features/coforge/domain/agent-session';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const TITLE = 'Synthetic sessions observation fixture';
const AT = '2026-11-01T12:00:00Z';
function syntheticTrace() {
  let trace = appendAgentSessionEvent(undefined, { kind: 'session', sessionId: 'fixture-root', label: 'Synthetic coordinator', status: 'running' }, AT);
  trace = appendAgentSessionEvent(trace, { kind: 'session', sessionId: 'fixture-child', parentSessionId: 'fixture-root', label: 'Synthetic technical reviewer', status: 'running' }, AT);
  for (let index = 0; index < 12; index++) trace = appendAgentSessionEvent(trace, { kind: 'message', sessionId: 'fixture-root', text: `Synthetic retained observation ${index + 1}. No provider was invoked for this rendering fixture.\nLiteral text remains selectable and wrapped.` }, AT);
  trace = appendAgentSessionEvent(trace, { kind: 'message', sessionId: 'fixture-child', text: '<script>synthetic literal, never execute()</script>' }, AT);
  trace = appendAgentSessionEvent(trace, { kind: 'tool', sessionId: 'fixture-child', tool: 'coforge_read_file', status: 'completed' }, AT);
  trace = appendAgentSessionEvent(trace, { kind: 'session', sessionId: 'fixture-child', parentSessionId: 'fixture-root', label: 'Synthetic technical reviewer', status: 'completed', text: 'Synthetic child metadata only; no native assistant was dispatched.' }, AT);
  trace = appendAgentSessionEvent(trace, { kind: 'session', sessionId: 'fixture-root', label: 'Synthetic coordinator', status: 'completed', text: 'Synthetic recording only. No provider or verification command actually ran.' }, AT);
  trace.truncated = true;
  return trace;
}

describe('Private card Sessions and read-only Peek in the contained host', () => {
  test('reads a clearly synthetic historical trace through the card, keyboard, bounded scroll and theme/leaf layouts without dispatch or private diagnostics', async ({ obsidian }) => {
    let view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await view.locator('.cf-project-switcher').click();
    await view.getByRole('button', { name: 'Add project', exact: true }).click();
    await view.getByLabel('Project name', { exact: true }).fill('Synthetic sessions fixture');
    await view.getByLabel(/^Project path/).fill('/synthetic/readonly-sessions');
    await view.getByLabel('Description', { exact: true }).fill('Rendering only: captured metadata is synthetic; no model or command is dispatched.');
    await view.getByRole('button', { name: 'Create project', exact: true }).click();
    await view.getByRole('button', { name: /^Idea board/ }).first().click();
    await view.locator('.cf-board-page > .cf-page-heading').getByRole('button', { name: 'New request', exact: true }).click();
    const intake = view.getByRole('dialog');
    await intake.getByLabel('The idea', { exact: true }).fill(TITLE);
    await intake.getByLabel('A little more context', { exact: true }).fill('Read-only observation qualification with an explicitly synthetic historical session.');
    await intake.getByLabel('Contributor name', { exact: true }).fill('Synthetic fixture owner');
    await intake.getByRole('button', { name: 'Add to the board', exact: true }).click();
    await browserExpect(view.locator('.cf-idea-card').filter({ hasText: TITLE })).toBeVisible();
    const original = await obsidian.eval(async ({ app }) => {
      const note = app.vault.getMarkdownFiles().find(file => file.path.startsWith('CoForge/Ideas/'));
      if (!note) throw new Error('Synthetic request note missing.');
      return app.vault.read(note);
    });
    const ideaId = /^id:\s*(CF-\d+)\s*$/mu.exec(original)?.[1];
    if (!ideaId) throw new Error('Synthetic request identity missing.');
    await obsidian.disablePlugin();
    await obsidian.eval(async ({ app, pluginId }, fixture) => {
      const folder = app.plugins.manifests[pluginId]?.dir ?? `${app.vault.configDir}/plugins/${pluginId}`;
      const path = `${folder}/coforge-state.json`; const state = JSON.parse(await app.vault.adapter.read(path));
      if (state.jobs.length) throw new Error('Synthetic fixture cannot replace actual dispatched jobs.');
      state.jobs = [{ id: 'synthetic-parent', ideaId: fixture.ideaId, projectId: state.activeProjectId, provider: 'codex', model: 'gpt-6.1-sol', stage: 'implement', status: 'succeeded', startedAt: fixture.at, finishedAt: '2026-11-01T12:01:00Z', logs: ['PRIVATE_DIAGNOSTIC_NOT_SESSION_OUTPUT'], sessionTrace: fixture.trace,
        verification: [{ id: 'synthetic-check', runId: 'synthetic-run', attemptId: 'synthetic-attempt', projectId: state.activeProjectId, commandId: 'fixture', label: 'Synthetic fixture command', executable: 'node', args: ['fixture.cjs'], runtime: 'docker', imageId: 'sha256:' + 'a'.repeat(64), sourceHash: 'b'.repeat(64), startedAt: fixture.at, finishedAt: '2026-11-01T12:00:10Z', status: 'completed', exitCode: 0, output: 'Synthetic output only; no actual command was executed.', truncated: false }] }];
      await app.vault.adapter.write(path, JSON.stringify(state, null, 2));
    }, { ideaId, at: AT, trace: syntheticTrace() });
    await obsidian.enablePlugin(); view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await view.getByRole('button', { name: /^Idea board/ }).first().click();
    const sessions = view.getByRole('button', { name: `Sessions for ${ideaId}`, exact: true });
    await browserExpect(sessions).toContainText('1 parent attempt');
    await sessions.focus(); await obsidian.page.keyboard.press('Enter');
    const peek = view.getByRole('region', { name: 'Session Peek', exact: true });
    await browserExpect(peek).toContainText('Earlier observations were truncated');
    await browserExpect(peek).not.toContainText('PRIVATE_DIAGNOSTIC_NOT_SESSION_OUTPUT');
    await browserExpect(peek.locator('input,textarea')).toHaveCount(0);
    await browserExpect(view.getByRole('button', { name: 'Cancel run', exact: true })).toHaveCount(0);
    const stream = peek.getByRole('region', { name: 'Recorded session observations', exact: true });
    for (const width of [1440, 760]) for (const theme of ['light', 'dark']) {
      await obsidian.page.setViewportSize({ width, height: 960 });
      await obsidian.eval((_context, selected) => {
        document.body.classList.toggle('theme-light', selected === 'light');
        document.body.classList.toggle('theme-dark', selected === 'dark');
      }, theme);
      await view.locator('[data-parent-session-id="synthetic-parent"]').click();
      await peek.evaluate(element => element.scrollIntoView({ block: 'start' }));
      expect(await peek.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      expect(await stream.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await stream.focus(); await obsidian.page.keyboard.press('Home');
      await browserExpect(peek.getByRole('button', { name: /^Resume follow/ })).toBeVisible();
      const resume = peek.getByRole('button', { name: /^Resume follow/ });
      const measure = () => stream.evaluate(element => ({ top: element.scrollTop, client: element.clientHeight, height: element.scrollHeight, remaining: element.scrollHeight - element.clientHeight - element.scrollTop,
        scrollBehavior: getComputedStyle(element).scrollBehavior, overflowAnchor: getComputedStyle(element).getPropertyValue('overflow-anchor'), activeTag: document.activeElement?.tagName, activeClass: String(document.activeElement?.className),
        following: element.previousElementSibling?.textContent }));
      const before = await measure(); const observations: Awaited<ReturnType<typeof measure>>[] = [];
      await resume.focus(); await obsidian.page.keyboard.press('Enter');
      try {
        await browserExpect.poll(async () => { const measured = await measure(); observations.push(measured); return measured.remaining <= 1; }).toBe(true);
        await browserExpect(peek.getByRole('button', { name: 'Pause follow', exact: true })).toBeFocused();
      } catch (error) { await writeFile(join(obsidian.directory, 'follow-metrics.json'), JSON.stringify({ before, observations, after: await measure() }, null, 2)); throw error; }
      await obsidian.page.mouse.move(5, 5);
      await obsidian.screenshot(`sessions-parent-${theme}-${width}`);
      await view.locator('[data-native-session-id="fixture-child"]').click();
      await browserExpect(peek).toContainText('coforge_read_file');
      await browserExpect(peek).toContainText('<script>synthetic literal, never execute()</script>');
      await browserExpect(peek.locator('script')).toHaveCount(0);
      await obsidian.screenshot(`sessions-child-${theme}-${width}`);
    }
    await peek.getByRole('region', { name: 'Observed verification commands', exact: true }).locator('summary').click();
    await browserExpect(peek).toContainText('Synthetic output only; no actual command was executed.');
    await obsidian.page.keyboard.press('Escape'); await browserExpect(sessions).toBeFocused();
    expect(await obsidian.eval(async ({ app }) => {
      const note = app.vault.getMarkdownFiles().find(file => file.path.startsWith('CoForge/Ideas/'));
      return note ? app.vault.read(note) : null;
    })).toBe(original);
    expect(obsidian.errors()).toEqual([]);
  });
});
