import { expect as browserExpect } from '@playwright/test';
import { describe, expect } from 'vitest';
import { parse, stringify } from 'yaml';
import { test, type ObsidianHarness } from './support/obsidian-fixture';
import { parsePersistedStudio } from '../../../src/plugin/features/coforge/domain/persisted';
import { defaultSettings } from '../../../src/plugin/features/coforge/domain/seed';
import { defaultWorkflowDefinition } from '../../../src/plugin/features/coforge/domain/configured-workflow';
import { ideaProperties, parseIdeaNote } from '../../../src/plugin/features/coforge/domain/idea-note';
import { workflowArtifactHash, workflowProposalRevision, type WorkflowArtifact } from '../../../src/plugin/features/coforge/domain/configured-workflow-run';
import { workflowIntegrityKey, workflowMetadataFingerprint } from '../../../src/plugin/features/coforge/application/workflow-note-integrity';
import { ideaFingerprint } from '../../../src/plugin/features/coforge/domain/integrity';
import type { AgentJob, Idea, Increment } from '../../../src/plugin/features/coforge/domain/types';
import type { WorkflowVerificationRecord } from '../../../src/plugin/features/coforge/domain/workflow-verification';
import { splitNote } from '../../../src/plugin/infrastructure/coforge/markdown';
import { record } from '../../../src/plugin/features/coforge/domain/check';

const TITLE = 'SYNTHETIC verification rendering fixture';
async function stored(obsidian: ObsidianHarness) {
  return obsidian.eval(async ({ app, pluginId }) => {
    const folder = app.plugins.manifests[pluginId]?.dir ?? `${app.vault.configDir}/plugins/${pluginId}`;
    const file = app.vault.getMarkdownFiles().find(file => file.path.startsWith('CoForge/Ideas/'));
    if (!file) throw new Error('The synthetic request note is missing.');
    return { notePath: file.path, note: await app.vault.read(file), statePath: `${folder}/coforge-state.json`, state: await app.vault.adapter.read(`${folder}/coforge-state.json`) };
  });
}

/** Rendering data only: no Docker command, model request or native assistant was executed. */
function renderingFixture(source: Awaited<ReturnType<typeof stored>>) {
  const data = parsePersistedStudio(JSON.parse(source.state)); const split = splitNote(source.note);
  if (!split.yaml) throw new Error('The synthetic request lacks canonical frontmatter.');
  const frontmatter = record(parse(split.yaml)); const note = parseIdeaNote(frontmatter, split.body);
  const at = new Date(Date.now() - 120000).toISOString(); const reviewAt = new Date(Date.now() - 60000).toISOString(); const end = new Date(Date.now() - 1000).toISOString();
  const plan = { summary: 'SYNTHETIC UI fixture, not an execution report.', steps: ['Inspect stored rendering evidence.'], acceptanceCriteria: ['Keep synthetic provenance visible.'], risks: ['Fixture outcomes do not prove execution.'], markdown: '# Synthetic plan', createdAt: at };
  const idea: Idea = { ...note, status: 'review', voters: [], plan, updatedAt: end };
  const proposalRevision = workflowProposalRevision(idea); const workspaceId = 'synthetic-render-workspace'; const imageId = 'sha256:' + 'a'.repeat(64);
  const buildCommand = { id: 'synthetic-build', label: 'SYNTHETIC Build check', executable: 'node', args: ['--test', 'synthetic-build.cjs'] };
  const reviewCommand = { id: 'synthetic-review', label: 'SYNTHETIC Review check', executable: 'node', args: ['--test', 'synthetic-review.cjs'] };
  const planStep = { id: 'plan', name: 'Synthetic plan', kind: 'ai' as const, output: 'plan' as const, access: 'readproject' as const, provider: 'demo' as const, model: 'sonnet', instructions: 'Rendering fixture only.', automatic: false };
  const buildStep = { id: 'build', name: 'Synthetic Build', kind: 'ai' as const, output: 'codechange' as const, access: 'editworktree' as const, provider: 'claude' as const, model: 'sonnet', instructions: 'Rendering fixture only.', automatic: false, inputs: ['plan' as const] };
  const reviewStep = { id: 'review', name: 'Synthetic Quality review', kind: 'ai' as const, output: 'markdown' as const, access: 'readproject' as const, provider: 'claude' as const, model: 'sonnet', instructions: 'Rendering fixture only.', automatic: false, inputs: ['codechange' as const], nativeTools: { verification: { commandIds: [reviewCommand.id] } } };
  const definition = { ...defaultWorkflowDefinition(defaultSettings()), revision: 'synthetic-render-v1', name: 'SYNTHETIC rendering workflow', steps: [planStep, buildStep, reviewStep] };
  const commandRecord = (id: string, attemptId: string, command: typeof buildCommand, sourceHash: string, status: WorkflowVerificationRecord['status'] = 'completed'): WorkflowVerificationRecord => ({
    ...command, commandId: command.id, id, runId: 'synthetic-render-run', attemptId, projectId: idea.projectId!, workspaceId, runtime: 'docker', imageId, sourceHash, startedAt: attemptId === 'synthetic-review-attempt' ? reviewAt : at,
    finishedAt: end, status, ...(status === 'completed' ? { exitCode: 0 } : {}), output: 'SYNTHETIC UI FIXTURE: no command was executed.\n' + (status === 'unknown' ? 'Outcome unknown; this only exercises the disclosure.' : 'Example output for keyboard and layout review.'), truncated: false,
  });
  const increment: Increment = { summary: 'SYNTHETIC stored increment. No repository changes or checks were performed for this rendering proof.', files: [{ path: 'synthetic/fixture.cjs', additions: 1, deletions: 0 }],
    tests: ['Not run: shell tools are disabled. This stored line is a synthetic older Build note.'], diff: '+// SYNTHETIC UI FIXTURE ONLY', branch: 'synthetic/render', worktree: '/synthetic/render/worktree', snapshotHash: 'b'.repeat(64), verificationSourceHash: 'c'.repeat(64),
    verification: [commandRecord('synthetic-current', 'synthetic-build-attempt', buildCommand, 'c'.repeat(64)), commandRecord('synthetic-stale', 'synthetic-build-attempt', buildCommand, 'd'.repeat(64))], createdAt: at, simulated: false };
  const artifact = (id: string, stepId: string, output: WorkflowArtifact['output'], fields: Partial<WorkflowArtifact>): WorkflowArtifact => {
    const value = { id, stepId, output, runId: 'synthetic-render-run', attemptId: `synthetic-${stepId}-attempt`, proposalRevision, createdAt: at, ...fields };
    return { ...value, contentHash: workflowArtifactHash(value) };
  };
  const planArtifact = artifact('synthetic-plan', 'plan', 'plan', { plan });
  const buildArtifact = artifact('synthetic-build', 'build', 'codechange', { increment, summary: increment.summary, hostSnapshot: true });
  idea.increment = increment;
  idea.workflowRun = { id: 'synthetic-render-run', ideaId: idea.id, projectId: idea.projectId!, definition, proposalRevision, revision: 3, cursor: 2, state: 'attention', workspaceId,
    attempts: [{ id: 'synthetic-plan-attempt', stepId: 'plan', stepName: planStep.name, kind: 'ai', status: 'succeeded', inputs: [], startedAt: at, finishedAt: at },
      { id: 'synthetic-build-attempt', stepId: 'build', stepName: buildStep.name, kind: 'ai', status: 'succeeded', inputs: [planArtifact.id], startedAt: at, finishedAt: at },
      { id: 'synthetic-review-attempt', stepId: 'review', stepName: reviewStep.name, kind: 'ai', status: 'failed', inputs: [buildArtifact.id], startedAt: reviewAt, finishedAt: end, jobId: 'synthetic-review-job' }],
    artifacts: [planArtifact, buildArtifact], createdAt: at, updatedAt: end };
  const unknown = commandRecord('synthetic-unknown', 'synthetic-review-attempt', reviewCommand, 'c'.repeat(64), 'unknown');
  const truncated = { ...commandRecord('synthetic-truncated', 'synthetic-review-attempt', reviewCommand, 'd'.repeat(64)), truncated: true, output: 'SYNTHETIC UI FIXTURE: retained output is incomplete.\n' + 'Example wrapped output. '.repeat(30) };
  const job: AgentJob = { id: 'synthetic-review-job', ideaId: idea.id, projectId: idea.projectId, provider: 'claude', model: 'sonnet', stage: 'plan', status: 'failed', startedAt: reviewAt, finishedAt: end, logs: ['SYNTHETIC rendering record; no provider ran.'],
    workflow: { runId: idea.workflowRun.id, attemptId: 'synthetic-review-attempt', definitionRevision: definition.revision, proposalRevision, step: reviewStep, inputArtifacts: [buildArtifact], workspaceId,
      verificationProfile: { enabled: true, dockerBin: 'docker', imageId, timeoutSeconds: 30, maxRuns: 4, commands: [reviewCommand] } }, verification: [unknown, truncated],
    nativeProcess: { runId: idea.workflowRun.id, attemptId: 'synthetic-review-attempt', projectId: idea.projectId!, identity: { pid: 2147483646, platform: process.platform, birth: 'SYNTHETIC-no-provider-process', image: 'f'.repeat(64) }, phase: 'unknown', observedAt: end, operatorAcknowledgedAt: end } };
  const properties = { ...frontmatter, ...ideaProperties(idea, 'Synthetic rendering owner') };
  const noteText = `---\n${stringify(properties)}---\n${split.body}`;
  const reread = parseIdeaNote(record(parse(splitNote(noteText).yaml!)), split.body);
  data.jobs = [job]; data.increments[idea.id] = increment; data.integrity[idea.id] = ideaFingerprint(reread); data.integrity[workflowIntegrityKey(idea)] = workflowMetadataFingerprint(reread);
  const checked = parsePersistedStudio(JSON.parse(JSON.stringify(data)));
  return { noteText, stateText: JSON.stringify(checked, null, 2), jobs: checked.jobs, body: split.body };
}

describe('SYNTHETIC native verification evidence rendering in the contained host', () => {
  test('renders snapshot provenance, readonly Review outcomes and recovery without executing any fixture command', async ({ obsidian }) => {
    let view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await view.locator('.cf-project-switcher').click(); await view.getByRole('button', { name: 'Add project', exact: true }).click();
    await view.getByLabel('Project name', { exact: true }).fill('SYNTHETIC evidence rendering');
    await view.getByLabel(/^Project path/).fill('/synthetic/rendering-only');
    await view.getByLabel('Description', { exact: true }).fill('Stored UI fixture only. No provider, Docker command or native assistant is dispatched.');
    await view.getByRole('button', { name: 'Create project', exact: true }).click();
    await view.getByRole('button', { name: /^Idea board/ }).first().click();
    await view.locator('.cf-board-page > .cf-page-heading').getByRole('button', { name: 'New request', exact: true }).click();
    const dialog = view.getByRole('dialog'); await dialog.getByLabel('The idea', { exact: true }).fill(TITLE);
    await dialog.getByLabel('A little more context', { exact: true }).fill('SYNTHETIC rendering proof. Stored outcomes do not establish any executed command, provider or native assistant.');
    await dialog.getByLabel('Contributor name', { exact: true }).fill('Synthetic fixture owner');
    await dialog.getByRole('button', { name: 'Add to the board', exact: true }).click();
    await browserExpect(view.locator('.cf-idea-card').filter({ hasText: TITLE })).toBeVisible();
    await obsidian.disablePlugin(); const original = await stored(obsidian); const fixture = renderingFixture(original);
    await obsidian.eval(async ({ app }, input) => {
      const file = app.vault.getMarkdownFiles().find(file => file.path === input.notePath); if (!file) throw new Error('Synthetic note missing.');
      await app.vault.modify(file, input.noteText); await app.vault.adapter.write(input.statePath, input.stateText);
    }, { notePath: original.notePath, statePath: original.statePath, noteText: fixture.noteText, stateText: fixture.stateText });
    await obsidian.enablePlugin(); view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await view.getByRole('button', { name: /^Idea board/ }).first().click();
    await view.locator('.cf-idea-card').filter({ hasText: TITLE }).locator('.cf-idea-open').click();
    await view.getByRole('button', { name: 'Increment', exact: true }).click();
    const review = view.getByRole('region', { name: 'Post-build verification for Synthetic Quality review', exact: true });
    await browserExpect(review).toContainText('Synthetic Quality review · Failed'); await browserExpect(review).toContainText('Outcome unknown');
    await browserExpect(review).toContainText('Earlier source snapshot'); await browserExpect(view.getByText('Not run: shell tools are disabled.', { exact: false })).toHaveCount(0);
    const checks = view.locator('.cf-verification-evidence'); await browserExpect(checks).toHaveCount(4);
    for (const width of [1280, 720]) for (const theme of ['light', 'dark']) {
      await obsidian.page.setViewportSize({ width, height: 900 });
      await obsidian.eval((_context, selected) => { document.body.classList.toggle('theme-light', selected === 'light'); document.body.classList.toggle('theme-dark', selected === 'dark'); }, theme);
      for (const check of await checks.all()) if (await check.getAttribute('open') !== null) {
        await check.locator('summary').focus(); await obsidian.page.keyboard.press('Enter');
      }
      await review.getByRole('heading', { name: 'Synthetic Quality review · Failed', exact: true }).evaluate(element => element.scrollIntoView({ block: 'start' }));
      await obsidian.screenshot(`synthetic-readonly-review-summary-${theme}-${width}`);
      for (const check of await checks.all()) {
        const summary = check.locator('summary'); await summary.focus();
        if (await check.getAttribute('open') === null) await obsidian.page.keyboard.press('Enter');
        const command = check.getByRole('region', { name: /^Recorded command for/ }); const output = check.getByRole('region', { name: /^Recorded output for/ });
        await command.focus(); await browserExpect(command).toBeFocused(); await obsidian.page.keyboard.press('Tab'); await browserExpect(output).toBeFocused();
        expect(await check.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      }
      await browserExpect(review).toContainText('synthetic-review-attempt'); await browserExpect(review).toContainText('Output was truncated');
      await review.scrollIntoViewIfNeeded(); await obsidian.screenshot(`synthetic-readonly-review-${theme}-${width}`);
      const build = checks.filter({ hasText: 'synthetic-build-attempt' });
      await browserExpect(build.filter({ hasText: 'Matches the captured source snapshot' })).toHaveCount(1);
      await browserExpect(build.filter({ hasText: 'Earlier source snapshot' })).toHaveCount(1);
      await build.first().scrollIntoViewIfNeeded(); await obsidian.screenshot(`synthetic-build-verification-${theme}-${width}`);
      await view.getByRole('button', { name: 'Workflow runs', exact: true }).click();
      const recovery = view.getByRole('region', { name: 'Original native execution recovery', exact: true });
      await browserExpect(recovery).toContainText('not OS termination proof'); await recovery.scrollIntoViewIfNeeded();
      expect(await recovery.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await obsidian.screenshot(`synthetic-native-recovery-${theme}-${width}`);
      await view.getByRole('button', { name: 'Increment', exact: true }).click();
    }
    const settingsWindow = obsidian.page.context().waitForEvent('page'); await obsidian.runCommand('app:open-settings'); const settings = await settingsWindow;
    await settings.waitForLoadState('domcontentloaded'); await settings.locator('.vertical-tab-nav-item').filter({ hasText: /^CoForge$/ }).last().click();
    const hostGrant = settings.getByRole('region', { name: 'Isolated workflow verification', exact: true });
    await browserExpect(hostGrant).toContainText('/usr/local/bin/node'); await browserExpect(hostGrant).toContainText('/opt/coforge/node_modules');
    await browserExpect(hostGrant).toContainText('Host dependencies are never copied');
    for (const width of [1280, 720]) for (const theme of ['light', 'dark']) {
      await settings.setViewportSize({ width, height: 900 });
      await settings.evaluate(selected => { document.body.classList.toggle('theme-light', selected === 'light'); document.body.classList.toggle('theme-dark', selected === 'dark'); }, theme);
      await settings.getByLabel('Verification image ID', { exact: true }).focus();
      await browserExpect(settings.getByLabel('Verification image ID', { exact: true })).toBeFocused();
      expect(await hostGrant.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await hostGrant.scrollIntoViewIfNeeded(); await settings.screenshot({ path: `${obsidian.directory}/synthetic-rendering-image-requirements-${theme}-${width}.png` });
    }
    await settings.close();
    const after = await stored(obsidian); expect(splitNote(after.note).body).toBe(fixture.body);
    expect(parsePersistedStudio(JSON.parse(after.state)).jobs).toEqual(fixture.jobs);
    expect(obsidian.errors()).toEqual([]);
  });
});
