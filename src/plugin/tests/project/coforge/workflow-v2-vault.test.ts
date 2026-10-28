// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import { App, Plugin } from 'obsidian';
import { createTestApp } from '@test/obsidian';
import { CouncilCatalogue } from '../../../features/coforge/application/council-catalogue';
import { StudioService } from '../../../features/coforge/application/studio';
import { ExecutionKernel } from '../../../features/coforge/application/execution-kernel';
import { workflowV2Dispatch } from '../../../features/coforge/application/workflow-v2-execution';
import { emptyExecutionJournal } from '../../../features/coforge/domain/execution-run';
import { workflowDefinition } from '../../../features/coforge/domain/configured-workflow';
import { VaultStudioStorage } from '../../../infrastructure/coforge/vault-storage';
import { VaultCouncilDefinitions, DEFAULT_COUNCIL_FOLDERS } from '../../../infrastructure/coforge/vault-council-definitions';
import { CouncilSourceNotes } from '../../../infrastructure/coforge/council-source-notes';
import { CouncilWorkflowModule } from '../../../infrastructure/coforge/council-workflow-module';
import { nodeTimers } from './memory-storage';

it('saves v2 beside legacy workflow without rewriting annotations, preflights without dispatch and executes through the shared journal', async () => {
  const app = new App(); const kit = createTestApp({ app, layoutReady: true });
  class TestPlugin extends Plugin {}
  const plugin = new TestPlugin(app, { id: 'coforge', name: 'CoForge', version: '0.1.0', minAppVersion: '1.13.7', author: '', description: '' });
  const unavailable = async () => { throw new Error('Unexpected legacy invocation'); };
  const studio = new StudioService(new VaultStudioStorage(plugin), { timers: nodeTimers(), runners: { demo: unavailable, claude: unavailable }, probeRuntime: async () => ({ cliAvailable: false, projectPath: null, allowImplementation: false }) });
  try {
    await studio.start(); const project = await studio.createProject({ projectName: 'V2 project', projectBrief: 'Analytical inbox', projectPath: '/synthetic/project' });
    const projectFile = app.vault.getMarkdownFiles().find(file => file.path.startsWith('CoForge/Projects/'))!;
    await app.vault.process(projectFile, text => text.replace('type: coforge-project', 'custom: "exact bytes" # human\ntype: coforge-project') + '\r\n## Human annotations\r\nKeep this body.\r\n');
    const catalogue = new CouncilCatalogue(new VaultCouncilDefinitions(plugin, DEFAULT_COUNCIL_FOLDERS, async () => undefined));
    await catalogue.save({ schema: 'agent/v1', id: 'analyst', name: 'Analyst', enabled: true, role: 'Review', instructions: 'Analyze', provider: 'demo', model: 'sonnet', contextSources: [], requestedCapabilities: { project: 'none', messaging: false } });
    await catalogue.save({ schema: 'team/v1', id: 'team', name: 'Team', enabled: true, projectId: project.id, members: ['analyst'], pinnedContext: [], recentMessages: 10, allowedRecipients: [] });
    let journal = emptyExecutionJournal(); let calls = 0;
    const sources = new CouncilSourceNotes(app.vault, () => journal.runs);
    const kernel = new ExecutionKernel({ journal: { load: async () => journal, save: async next => { journal = structuredClone(next); } }, now: () => '2026-10-28T12:00:00.000Z', id: () => 'attempt',
      assertEligible: async () => undefined, resolveInvocation: workflowV2Dispatch, invoke: async () => { calls++; return { markdown: 'Analysis result', simulated: true }; }, publish: (run, artifact) => sources.project(run, artifact) });
    await kernel.load(); const workflows = new CouncilWorkflowModule(plugin, studio, kernel, sources, catalogue, async () => undefined, () => undefined);
    expect((await workflows.actions.load(project.id)).definition).toBeNull();
    await workflows.actions.save(project.id, { format: 'coforge-workflow/v2', revision: 'draft', name: 'Analyze', teamId: 'team', subjectMode: 'note', limits: { timeoutSeconds: 180, maxTurns: 12, maxBudgetUsd: 1, maxInvocations: 10 }, collections: [],
      steps: [{ kind: 'agent', id: 'analysis', name: 'Analyze', instructions: 'Review', agentId: 'analyst', access: 'none', output: 'markdown', inputs: [] }] }, '');
    expect(kit.read(projectFile.path)).toContain('custom: "exact bytes" # human');
    const legacy = workflowDefinition(project.settings); await studio.saveWorkflow(project.id, legacy, JSON.stringify(workflowDefinition(project.settings)));
    const preserved = kit.read(projectFile.path); expect(preserved).toContain('\r\n## Human annotations\r\nKeep this body.\r\n'); expect(preserved).toContain('coforge_workflow_v2:'); expect(preserved).toContain('workflow-definition:');
    await app.vault.createFolder('Private'); const source = await app.vault.create('Private/Proposal.md', 'Human proposal');
    const preview = await workflows.actions.preflight(project.id, source.path); expect(preview.invocations).toBe(1); expect(calls).toBe(0); expect(kit.read(source.path)).toBe('Human proposal');
    const run = await workflows.actions.start(project.id, source.path, true, 'CoForge/Tests/Workflow-test.md'); expect(calls).toBe(0); kernel.resume(); await kernel.step(run.id); expect(calls).toBe(1);
    expect(kit.read(source.path)).toBe('Human proposal'); expect(kit.read('CoForge/Tests/Workflow-test.md')).toContain('Analysis result'); expect(journal.runs[0]?.state).toBe('completed'); expect(kit.errors).toEqual([]);
  } finally { await studio.stop(); }
});
