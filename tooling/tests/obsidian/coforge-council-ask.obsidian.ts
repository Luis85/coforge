import { expect as browserExpect } from '@playwright/test';
import { describe, expect } from 'vitest';
import { test, type ObsidianHarness } from './support/obsidian-fixture';
import { defaultCouncilDefinition, type AgentDefinition, type TeamDefinition } from '../../../src/plugin/features/coforge/domain/council-definitions';
import { writeCouncilDefinitionNote } from '../../../src/plugin/infrastructure/coforge/council-definition-notes';
import { executionJournalCheck } from '../../../src/plugin/features/coforge/domain/execution-run';

function definitions(projectId: string) {
  const agents: AgentDefinition[] = ['a', 'b'].map(id => ({ schema: 'agent/v1', id: `native-adviser-${id}`, name: `Native adviser ${id.toUpperCase()}`, enabled: true, role: 'Independent adviser', instructions: 'Assess assumptions, open gaps and next steps. Preserve disagreements.', provider: 'demo', model: 'sonnet', contextSources: [], requestedCapabilities: { project: 'none', messaging: false } }));
  const team: TeamDefinition = { schema: 'team/v1', id: 'native-advice-team', name: 'Native advice team', enabled: true, projectId, members: agents.map(agent => agent.id), pinnedContext: [], recentMessages: 0, allowedRecipients: [] };
  const council = defaultCouncilDefinition('native-advice', 'Native Advice Council', team, team.members);
  council.rounds[0]!.promptOrder = 'fan-out';
  council.rounds[1]!.promptOrder = 'round-robin';
  return [...agents.map(agent => ({ path: `CoForge/Agents/${agent.id}.md`, text: writeCouncilDefinitionNote('', agent) })), { path: 'CoForge/Teams/native-advice-team.md', text: writeCouncilDefinitionNote('', team) }, { path: 'CoForge/Councils/native-advice.md', text: writeCouncilDefinitionNote('', council) }];
}
async function journal(obsidian: ObsidianHarness) {
  const payload: unknown = await obsidian.eval(async ({ app, pluginId }) => {
    const path = `${app.vault.configDir}/plugins/${pluginId}/coforge-execution-v2.json`;
    if (!await app.vault.adapter.exists(path)) return { format: 'coforge-execution/v2', revision: 0, runs: [], submissions: [] };
    const envelope = JSON.parse(await app.vault.adapter.read(path));
    return typeof envelope.payload === 'string' ? JSON.parse(envelope.payload) : envelope.payload;
  });
  return executionJournalCheck(payload);
}

describe('Ask the Council in the contained host', () => {
  test('saves a question, runs explicit mixed-order simulation, retains history and attributes every attempt', async ({ obsidian }) => {
    let view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await view.locator('.cf-project-switcher').click();
    await view.getByRole('button', { name: 'Add project', exact: true }).click();
    await view.getByLabel('Project name', { exact: true }).fill('Native advice project');
    await view.getByLabel(/^Project path/).fill('/synthetic/advice');
    await view.getByLabel('Description', { exact: true }).fill('A contained project for independent Council advice.');
    await view.getByRole('button', { name: 'Create project', exact: true }).click();
    await browserExpect(view.locator('.cf-project-switcher')).toContainText('Native advice project');
    const projectId = await obsidian.eval(async ({ app, pluginId }) => {
      const state = JSON.parse(await app.vault.adapter.read(`${app.vault.configDir}/plugins/${pluginId}/coforge-state.json`));
      if (typeof state.activeProjectId !== 'string') throw new Error('Project identity is unavailable.');
      return state.activeProjectId;
    });
    await obsidian.eval(async ({ app }, notes) => {
      for (const folder of ['CoForge/Agents', 'CoForge/Teams', 'CoForge/Councils'])
        if (!app.vault.getAbstractFileByPath(folder)) await app.vault.createFolder(folder);
      for (const note of notes) await app.vault.create(note.path, note.text);
    }, definitions(projectId));
    await view.getByRole('button', { name: 'The Council', exact: true }).click();
    const intake = view.getByRole('region', { name: 'Ask the Council for advice', exact: true });
    await browserExpect(intake).toBeVisible();
    await browserExpect(view.locator('.cf-council-advanced')).not.toHaveAttribute('open', '');
    await view.getByRole('button', { name: 'Refresh Council', exact: true }).click();
    await intake.getByLabel('Task title', { exact: true }).fill('Council architecture advice');
    const question = 'Compare two approaches.\n\nPreserve this **human question** and identify open gaps.';
    await intake.getByLabel('Your question or task', { exact: true }).fill(question);
    await obsidian.eval(async ({ app }) => { await app.vault.create('Council context.md', '# Context\nKeep these bytes.\n'); });
    await intake.getByText('Add vault files', { exact: true }).click();
    await intake.getByRole('searchbox', { name: 'Search vault files', exact: true }).fill('Council context');
    await intake.getByRole('checkbox', { name: 'Council context.md', exact: true }).check();
    await intake.getByRole('button', { name: 'Add 1 wikilink to input', exact: true }).click();
    await browserExpect(intake.getByLabel('Your question or task', { exact: true })).toHaveValue(`${question}\n\n- [[Council context]]`);
    await intake.getByRole('combobox', { name: 'Project team', exact: true }).selectOption('native-advice-team');
    await intake.getByRole('combobox', { name: 'Council', exact: true }).selectOption('native-advice');
    await intake.getByRole('button', { name: 'Save task and review', exact: true }).click();
    await browserExpect(view.getByRole('region', { name: 'Invocation preview', exact: true })).toContainText('4 invocations');
    await browserExpect(view.getByRole('region', { name: 'Round prompt order', exact: true })).toContainText('Opinions · Fan out (concurrent)');
    expect((await journal(obsidian)).runs).toHaveLength(0);
    const saved = await obsidian.eval(async ({ app }) => {
      const files = app.vault.getMarkdownFiles().filter(file => file.path.startsWith('CoForge/CouncilTasks/'));
      if (files.length !== 1) throw new Error('Expected one canonical Council task.');
      return { path: files[0]!.path, text: await app.vault.read(files[0]!) };
    });
    expect(saved.text).toContain(question);
    expect(saved.text).toContain('- [[Council context]]');
    expect(saved.text).toContain('coforge_task:');
    await view.getByRole('button', { name: 'Use this desktop for execution', exact: true }).click();
    await view.getByRole('button', { name: 'Queue simulation', exact: true }).click();
    const history = view.getByRole('region', { name: 'Council task history', exact: true });
    await browserExpect(history).toContainText('Council architecture advice');
    await browserExpect(history).toContainText('Simulation · queued · execution paused');
    await expect.poll(async () => (await journal(obsidian)).runs[0]?.state).toBe('queued');
    expect((await journal(obsidian)).runs[0]).toMatchObject({ state: 'queued', attempts: [], limits: { simulation: true } });
    await view.getByRole('button', { name: 'Resume Council execution', exact: true }).click();
    await expect.poll(async () => (await journal(obsidian)).runs[0]?.state, { timeout: 30000 }).toBe('completed');
    const run = (await journal(obsidian)).runs[0]!;
    expect(run.attempts).toHaveLength(4); expect(run.artifacts).toHaveLength(4);
    expect(run.invocations.map(invocation => invocation.promptOrder)).toEqual(['fan-out', 'fan-out', 'round-robin', 'round-robin']);
    const opinions = run.artifacts.filter(artifact => artifact.roundId === 'opinions');
    for (const attempt of run.attempts.filter(attempt => run.invocations.find(invocation => invocation.id === attempt.invocationId)?.roundId === 'opinions'))
      expect(attempt.dispatch.inputArtifactIds).toEqual([]);
    for (const attempt of run.attempts.filter(attempt => run.invocations.find(invocation => invocation.id === attempt.invocationId)?.roundId === 'solutions'))
      expect(attempt.dispatch.inputArtifactIds).toEqual(opinions.map(artifact => artifact.id));
    expect(await obsidian.eval(({ app }, path) => app.vault.adapter.read(path), saved.path)).toBe(saved.text);
    expect(await obsidian.eval(({ app }) => app.vault.getMarkdownFiles().filter(file => file.path.startsWith('CoForge/Ideas/')).length)).toBe(0);
    await obsidian.reloadPlugin();
    view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await view.getByRole('button', { name: 'The Council', exact: true }).click();
    await browserExpect(view.getByRole('region', { name: 'Council task history', exact: true })).toContainText('Council architecture advice');
    expect((await journal(obsidian)).runs[0]?.attempts).toHaveLength(4);
    await view.getByRole('button', { name: 'AI costs', exact: true }).click();
    await view.getByRole('button', { name: 'Refresh', exact: true }).click();
    const costs = view.getByRole('region', { name: 'Agent, team and Council cost attribution', exact: true });
    await browserExpect(costs).toContainText('Native adviser A');
    await browserExpect(costs).toContainText('Native adviser B');
    await costs.getByRole('button', { name: 'By team', exact: true }).click();
    await browserExpect(costs).toContainText('Native advice team');
    await costs.getByRole('button', { name: 'By Council', exact: true }).click();
    await browserExpect(costs).toContainText('Native Advice Council');
    expect(obsidian.errors()).toEqual([]);
    await obsidian.screenshot('council-advice-mixed-order-and-costs');
  });
});
