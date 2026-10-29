// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import { App, Plugin } from 'obsidian';
import { createTestApp } from '@test/obsidian';
import { CouncilModule } from '../../../infrastructure/coforge/council-module';
import { workflowAgentTasks } from '../../../infrastructure/coforge/workflow-agent-task';
import { workflowTriggerHost } from '../../../infrastructure/coforge/workflow-trigger-host';
import { VaultProjects } from '../../../infrastructure/coforge/vault-projects';
import { defaultWorkflowDefinition, workflowDefinition } from '../../../features/coforge/domain/configured-workflow';
import type { WorkflowTriggerDraft, WorkflowTriggerOccurrence } from '../../../features/coforge/domain/workflow-triggers';
import { InvocationGate } from '../../../features/coforge/application/invocation-gate';
import { StudioService } from '../../../features/coforge/application/studio';
import { decodeCouncilPlan } from '../../../features/coforge/application/council-execution';
import { createSeed } from '../../../features/coforge/domain/seed';
import { MemoryStorage, nodeTimers } from './memory-storage';

it('admits one allowed project agent with captured context and tighter parent limits, preserving sources and rejecting replay', async () => {
  const app = new App(); const kit = createTestApp({ app, layoutReady: true });
  class TestPlugin extends Plugin {}
  const plugin = new TestPlugin(app, { id: 'coforge', name: 'CoForge', version: '0.1.0', minAppVersion: '1.13.7', author: '', description: '' });
  const timers = nodeTimers(); const gate = new InvocationGate();
  const studio = new StudioService(new MemoryStorage(createSeed()), { timers, runners: { demo: async () => ({}), claude: async () => ({}) }, probeRuntime: async () => ({ cliAvailable: true, projectPath: null, allowImplementation: false }) });
  await studio.start(); await studio.store.updateRuntime({ cliAvailable: true });
  const module = new CouncilModule(plugin, studio, timers, gate); await module.start(); await module.actions.designateExecutor();
  try {
    const projectId = studio.state().activeProjectId!;
    const setup = await module.actions.catalogue.setup(projectId);
    await module.actions.catalogue.save({ schema: 'agent/v1', id: 'reviewer', name: 'Reviewer', enabled: true, role: 'Review', instructions: 'Review supplied context.', provider: 'claude', model: 'sonnet', contextSources: [], requestedCapabilities: { project: 'none', messaging: false } });
    const entry = setup.valid.find(entry => entry.definition.schema === 'team/v1')!;
    if (entry.definition.schema !== 'team/v1') throw new Error('Expected team');
    await module.actions.catalogue.save({ ...entry.definition, members: ['reviewer'], allowedRecipients: ['reviewer'] }, entry.revision);
    // Keep the actual kernel paused; no provider is started by this admission integration test.
    const actions = { ...module.actions, snapshot: () => ({ ...module.actions.snapshot(), paused: false }) };
    const port = workflowAgentTasks(plugin, studio, actions);
    const input = { projectId, ideaId: 'CF-001', workflowRunId: 'workflow-one', attemptId: 'attempt-one', stepId: 'nudge', teamId: entry.definition.id, agentId: 'reviewer', prompt: 'Find risks.', context: '{"captured":"request"}', sourcePath: 'CoForge/Automations/nudge-attempt-one.md', limits: { timeoutSeconds: 30, maxTurns: 2, maxBudgetUsd: 0.2 }, signal: new AbortController().signal };
    const receipt = await port.create(input);
    const run = module.actions.snapshot().runs.find(run => run.id === receipt.runId)!;
    expect(decodeCouncilPlan(run).invocations.map(invocation => invocation.agent.id)).toEqual(['reviewer']);
    expect(run.limits).toMatchObject(input.limits);
    const original = kit.read(receipt.sourcePath); expect(original).toContain('Find risks.'); expect(original).toContain(input.context);
    await expect(port.create(input)).rejects.toThrow('already exists'); expect(kit.read(receipt.sourcePath)).toBe(original);
    await expect(port.create({ ...input, attemptId: 'attempt-two', sourcePath: 'CoForge/Automations/nudge-attempt-two.md', agentId: 'outsider' })).rejects.toThrow();
    expect(app.vault.getAbstractFileByPath('CoForge/Automations/nudge-attempt-two.md')).toBeNull();
    const host = workflowTriggerHost(plugin, studio, actions, () => undefined);
    const idea = studio.state().ideas.find(idea => idea.status === 'inbox')!;
    const definition = { ...defaultWorkflowDefinition(studio.state().settings), revision: 'event-manual', steps: [{ id: 'review', name: 'Review', instructions: 'Human decides.', kind: 'approval' as const }] };
    await studio.saveWorkflow(projectId, definition, JSON.stringify(workflowDefinition(studio.state().settings)));
    const draft: WorkflowTriggerDraft = { name: 'Request review', enabled: true, event: 'request-created', scope: 'project', projectId, workflow: 'v1', workflowRevision: workflowDefinition(studio.state().settings).revision, request: 'event', cooldownSeconds: 1 };
    const event = { id: 'event-one', type: 'request-created', at: new Date().toISOString(), projectId, ideaId: idea.id };
    const occurrence: WorkflowTriggerOccurrence = { id: 'event-occurrence', bindingId: 'binding-one', bindingRevision: 1, event, snapshot: draft, status: 'reserved', reason: 'Reserved', at: Date.now(), definitionJson: (await host.describe(draft)).definitionJson };
    const origin = { rootEventId: event.id, bindingIds: ['binding-one'] };
    const first = await host.dispatch(draft, occurrence, origin, input.signal);
    expect(studio.state().ideas.find(item => item.id === idea.id)?.workflowRun).toMatchObject({ id: first.runId, state: 'waiting-human', automationEvent: { origin } });
    await new VaultProjects(plugin).save(studio.state().projects ?? []);
    await module.actions.workflows.save(projectId, { format: 'coforge-workflow/v2', revision: 'event-v2', name: 'Event review', subjectMode: 'note', teamId: entry.definition.id, limits: { ...input.limits, maxInvocations: 1 }, collections: [], steps: [{ id: 'review', name: 'Review event', kind: 'approval', instructions: 'Inspect the event.' }] });
    const v2 = { ...draft, workflow: 'v2' as const, workflowRevision: (await module.actions.workflows.load(projectId)).definition!.revision };
    const second = await host.dispatch(v2, { ...occurrence, id: 'v2-occurrence', snapshot: v2, definitionJson: (await host.describe(v2)).definitionJson }, origin, input.signal);
    expect(module.actions.snapshot().runs.find(run => run.id === second.runId)).toMatchObject({ projectId, automationEvent: { origin }, subject: { kind: 'note' } });
    expect(second.sourcePath && kit.read(second.sourcePath)).toContain('event-one');
    await expect(host.dispatch(v2, { ...occurrence, definitionJson: '{}' }, origin, input.signal)).rejects.toThrow('changed');
    expect(kit.errors).toEqual([]);
  } finally { await module.dispose(); gate.dispose(); await studio.stop(); }
});
